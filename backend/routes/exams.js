const express = require('express');
const db = require('../database/db');
const { requireAuth, requireStaff } = require('../middleware/auth');

const router = express.Router();

function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// GET /api/exams/stats/overview — 必須在 /:id 之前
router.get('/stats/overview', requireStaff, (req, res) => {
  const stats = {
    total_users:    Number(db.prepare("SELECT COUNT(*) as c FROM users WHERE role='student'").get().c),
    total_exams:    Number(db.prepare('SELECT COUNT(*) as c FROM exams').get().c),
    total_questions:Number(db.prepare('SELECT COUNT(*) as c FROM questions WHERE is_active=1').get().c),
    total_attempts: Number(db.prepare("SELECT COUNT(*) as c FROM exam_attempts WHERE status='submitted'").get().c),
    avg_score:      db.prepare("SELECT AVG(score) as avg FROM exam_attempts WHERE status='submitted'").get().avg || 0,
    recent_attempts: db.prepare(`
      SELECT ea.score, ea.submitted_at, ea.time_spent_seconds, ea.correct_count, ea.total_questions,
             u.display_name, e.title as exam_title
      FROM exam_attempts ea
      JOIN users u ON ea.user_id = u.id
      JOIN exams e ON ea.exam_id = e.id
      WHERE ea.status = 'submitted'
      ORDER BY ea.submitted_at DESC LIMIT 10
    `).all()
  };
  res.json(stats);
});

// GET /api/exams
router.get('/', requireAuth, (req, res) => {
  const now = new Date().toISOString();
  const isAdmin = req.user.role === 'admin';

  let sql = `
    SELECT e.*,
           s.name as subject_name, s.icon as subject_icon,
           u.display_name as creator_name,
           (SELECT COUNT(*) FROM exam_attempts WHERE exam_id=e.id AND user_id=? AND status='submitted') as my_attempt_count,
           (SELECT score FROM exam_attempts WHERE exam_id=e.id AND user_id=? AND status='submitted' ORDER BY score DESC LIMIT 1) as my_best_score
    FROM exams e
    JOIN subjects s ON e.subject_id = s.id
    JOIN users u ON e.created_by = u.id
    WHERE 1=1
  `;
  const params = [req.user.id, req.user.id];

  if (!isAdmin) {
    sql += ` AND e.is_active=1 AND (e.start_time IS NULL OR e.start_time<=?) AND (e.end_time IS NULL OR e.end_time>=?)`;
    params.push(now, now);
  }
  sql += ' ORDER BY e.created_at DESC';

  const exams = db.prepare(sql).all(...params);
  res.json(exams);
});

// GET /api/exams/:id/leaderboard
router.get('/:id/leaderboard', requireAuth, (req, res) => {
  const leaderboard = db.prepare(`
    SELECT l.display_name, l.score, l.time_spent_seconds, l.submitted_at,
           CASE WHEN l.user_id=? THEN 1 ELSE 0 END as is_me
    FROM leaderboard_cache l
    WHERE l.exam_id=?
    ORDER BY l.score DESC, l.time_spent_seconds ASC LIMIT 20
  `).all(req.user.id, req.params.id);
  res.json(leaderboard);
});

// GET /api/exams/:id/my-attempts
router.get('/:id/my-attempts', requireAuth, (req, res) => {
  const attempts = db.prepare(`
    SELECT id, score, correct_count, total_questions, time_spent_seconds, submitted_at, status
    FROM exam_attempts
    WHERE exam_id=? AND user_id=? AND status='submitted'
    ORDER BY submitted_at DESC LIMIT 10
  `).all(req.params.id, req.user.id);
  res.json(attempts);
});

// GET /api/exams/:id
router.get('/:id', requireAuth, (req, res) => {
  const exam = db.prepare(`
    SELECT e.*, s.name as subject_name, s.icon as subject_icon
    FROM exams e JOIN subjects s ON e.subject_id=s.id WHERE e.id=?
  `).get(req.params.id);

  if (!exam) return res.status(404).json({ error: '找不到此考試' });

  if (req.user.role !== 'admin') {
    const now = new Date();
    if (!exam.is_active) return res.status(403).json({ error: '此考試目前不開放' });
    if (exam.start_time && new Date(exam.start_time) > now)
      return res.status(403).json({ error: '考試尚未開始', start_time: exam.start_time });
    if (exam.end_time && new Date(exam.end_time) < now)
      return res.status(403).json({ error: '考試已截止', end_time: exam.end_time });
  }
  res.json(exam);
});

// POST /api/exams
router.post('/', requireStaff, (req, res) => {
  const {
    title, description, subject_id, level_filter = 'all',
    question_count = 10, start_time, end_time,
    duration_minutes = 30, shuffle_questions = 1, shuffle_options = 1, passing_score = 60
  } = req.body;

  if (!title || !subject_id) return res.status(400).json({ error: '請填寫考試名稱與科目' });

  const result = db.prepare(`
    INSERT INTO exams (title,description,subject_id,level_filter,question_count,start_time,end_time,
                       duration_minutes,shuffle_questions,shuffle_options,passing_score,created_by)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
  `).run(title, description||null, subject_id, level_filter, question_count,
    start_time||null, end_time||null, duration_minutes,
    shuffle_questions?1:0, shuffle_options?1:0, passing_score, req.user.id);

  res.status(201).json({ id: Number(result.lastInsertRowid), message: '考試建立成功' });
});

// PUT /api/exams/:id
router.put('/:id', requireStaff, (req, res) => {
  const exam = db.prepare('SELECT * FROM exams WHERE id=?').get(req.params.id);
  if (!exam) return res.status(404).json({ error: '找不到此考試' });

  const fields = ['title','description','subject_id','level_filter','question_count',
    'start_time','end_time','duration_minutes','shuffle_questions','shuffle_options','passing_score','is_active'];
  const updates = [];
  const values = [];
  for (const f of fields) {
    if (req.body[f] !== undefined) { updates.push(`${f}=?`); values.push(req.body[f]); }
  }
  if (!updates.length) return res.status(400).json({ error: '沒有提供要更新的欄位' });
  values.push(req.params.id);
  db.prepare(`UPDATE exams SET ${updates.join(',')}, updated_at=CURRENT_TIMESTAMP WHERE id=?`).run(...values);
  res.json({ message: '考試更新成功' });
});

// DELETE /api/exams/:id
router.delete('/:id', requireStaff, (req, res) => {
  if (!db.prepare('SELECT id FROM exams WHERE id=?').get(req.params.id))
    return res.status(404).json({ error: '找不到此考試' });
  db.prepare('DELETE FROM exam_attempts WHERE exam_id=?').run(req.params.id);
  db.prepare('DELETE FROM leaderboard_cache WHERE exam_id=?').run(req.params.id);
  db.prepare('DELETE FROM exams WHERE id=?').run(req.params.id);
  res.json({ message: '考試已刪除' });
});

// POST /api/exams/:id/start
router.post('/:id/start', requireAuth, (req, res) => {
  const exam = db.prepare(`
    SELECT e.*, s.name as subject_name
    FROM exams e JOIN subjects s ON e.subject_id=s.id WHERE e.id=?
  `).get(req.params.id);

  if (!exam) return res.status(404).json({ error: '找不到此考試' });

  const now = new Date();
  if (req.user.role !== 'admin') {
    if (!exam.is_active) return res.status(403).json({ error: '此考試目前不開放' });
    if (exam.start_time && new Date(exam.start_time) > now)
      return res.status(403).json({ error: '考試尚未開始' });
    if (exam.end_time && new Date(exam.end_time) < now)
      return res.status(403).json({ error: '考試已截止' });
  }

  // 進行中的作答
  const existing = db.prepare(
    "SELECT * FROM exam_attempts WHERE exam_id=? AND user_id=? AND status='in_progress'"
  ).get(req.params.id, req.user.id);

  if (existing) {
    const snapshot = JSON.parse(existing.question_snapshot);
    const elapsed = Math.floor((now - new Date(existing.started_at)) / 1000);
    const remaining = exam.duration_minutes * 60 - elapsed;
    if (remaining <= 0) {
      db.prepare(`UPDATE exam_attempts SET submitted_at=?,score=0,correct_count=0,time_spent_seconds=?,answers='{}',status='submitted' WHERE id=?`)
        .run(now.toISOString(), elapsed, existing.id);
      return res.status(403).json({ error: '作答時間已到，已自動交卷' });
    }
    const questionSnapshot = snapshot.map(q => ({ id:q.id, type:q.type, question_text:q.question_text, options:q.options, level:q.level }));
    return res.json({
      attempt_id: Number(existing.id),
      questions: questionSnapshot,
      remaining_seconds: remaining,
      started_at: existing.started_at,
      exam: { title: exam.title, duration_minutes: exam.duration_minutes, subject_name: exam.subject_name }
    });
  }

  // 抽題
  let levelCondition = '';
  const levelParams = [exam.subject_id];
  if (exam.level_filter && exam.level_filter !== 'all') {
    const levels = exam.level_filter.split(',').map(l => parseInt(l.trim())).filter(Boolean);
    if (levels.length > 0) {
      levelCondition = `AND q.level IN (${levels.map(() => '?').join(',')})`;
      levelParams.push(...levels);
    }
  }

  const available = db.prepare(`
    SELECT q.id,q.type,q.question_text,q.options,q.correct_answer,q.explanation,q.level
    FROM questions q WHERE q.subject_id=? AND q.is_active=1 ${levelCondition}
  `).all(...levelParams);

  if (!available.length) return res.status(400).json({ error: '此考試目前沒有可用題目' });

  let selected = shuffleArray(available).slice(0, Math.min(exam.question_count, available.length));

  if (exam.shuffle_options) {
    selected = selected.map(q => {
      if (q.type === 'choice' && q.options) {
        const opts = typeof q.options === 'string' ? JSON.parse(q.options) : q.options;
        return { ...q, options: JSON.stringify(shuffleArray(opts)) };
      }
      return q;
    });
  }

  const fullSnapshot = selected.map(q => ({
    id: Number(q.id), type: q.type, question_text: q.question_text,
    options: q.options ? (typeof q.options === 'string' ? JSON.parse(q.options) : q.options) : null,
    correct_answer: q.correct_answer, explanation: q.explanation, level: q.level
  }));

  const questionSnapshot = fullSnapshot.map(q =>
    ({ id: q.id, type: q.type, question_text: q.question_text, options: q.options, level: q.level })
  );

  const attemptResult = db.prepare(`
    INSERT INTO exam_attempts (exam_id,user_id,started_at,total_questions,question_snapshot,status)
    VALUES (?,?,?,?,?,'in_progress')
  `).run(req.params.id, req.user.id, now.toISOString(), selected.length, JSON.stringify(fullSnapshot));

  res.json({
    attempt_id: Number(attemptResult.lastInsertRowid),
    questions: questionSnapshot,
    remaining_seconds: exam.duration_minutes * 60,
    started_at: now.toISOString(),
    exam: { title: exam.title, duration_minutes: exam.duration_minutes, subject_name: exam.subject_name }
  });
});

// POST /api/exams/attempts/:attemptId/submit
router.post('/attempts/:attemptId/submit', requireAuth, (req, res) => {
  const { answers } = req.body;
  const attempt = db.prepare('SELECT * FROM exam_attempts WHERE id=?').get(req.params.attemptId);
  if (!attempt) return res.status(404).json({ error: '找不到此作答記錄' });
  if (Number(attempt.user_id) !== req.user.id && req.user.role !== 'admin')
    return res.status(403).json({ error: '無權操作此作答記錄' });
  if (attempt.status === 'submitted') return res.status(400).json({ error: '此次作答已提交' });

  const exam = db.prepare('SELECT * FROM exams WHERE id=?').get(attempt.exam_id);
  const snapshot = JSON.parse(attempt.question_snapshot);
  const now = new Date();
  const timeSpent = Math.floor((now - new Date(attempt.started_at)) / 1000);

  let correctCount = 0;
  const results = snapshot.map(q => {
    const ua = answers[q.id] || '';
    const isCorrect = q.type === 'fill'
      ? ua.trim().toLowerCase() === q.correct_answer.trim().toLowerCase()
      : ua.trim() === q.correct_answer.trim();
    if (isCorrect) correctCount++;
    return {
      question_id: q.id, question_text: q.question_text, type: q.type,
      options: q.options, correct_answer: q.correct_answer,
      user_answer: ua, is_correct: isCorrect, explanation: q.explanation, level: q.level
    };
  });

  const score = Math.round((correctCount / snapshot.length) * 100);

  db.prepare(`
    UPDATE exam_attempts
    SET submitted_at=?,score=?,correct_count=?,time_spent_seconds=?,answers=?,status='submitted'
    WHERE id=?
  `).run(now.toISOString(), score, correctCount, timeSpent, JSON.stringify(answers), attempt.id);

  // 排行榜更新
  const existingLeader = db.prepare(
    'SELECT id, score FROM leaderboard_cache WHERE exam_id=? AND user_id=?'
  ).get(attempt.exam_id, req.user.id);
  const userRow = db.prepare('SELECT display_name FROM users WHERE id=?').get(req.user.id);

  if (!existingLeader || score > Number(existingLeader.score)) {
    if (existingLeader) db.prepare('DELETE FROM leaderboard_cache WHERE id=?').run(existingLeader.id);
    db.prepare(`
      INSERT INTO leaderboard_cache (exam_id,user_id,display_name,score,time_spent_seconds,submitted_at)
      VALUES (?,?,?,?,?,?)
    `).run(attempt.exam_id, req.user.id, userRow.display_name, score, timeSpent, now.toISOString());
  }

  res.json({
    score, correct_count: correctCount,
    total_questions: snapshot.length,
    time_spent_seconds: timeSpent,
    passed: score >= (Number(exam.passing_score) || 60),
    results, attempt_id: Number(attempt.id)
  });
});

module.exports = router;
