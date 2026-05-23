const express = require('express');
const db = require('../database/db');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

// GET /api/admin/attempts — 所有已提交作答記錄（含學生資訊）
router.get('/attempts', requireAdmin, (req, res) => {
  const { user_id, exam_id, page = 1, limit = 50 } = req.query;
  const conditions = ["ea.status = 'submitted'"];
  const params = [];

  if (user_id) { conditions.push('ea.user_id = ?'); params.push(user_id); }
  if (exam_id) { conditions.push('ea.exam_id = ?'); params.push(exam_id); }

  const where = conditions.join(' AND ');
  const offset = (parseInt(page) - 1) * parseInt(limit);

  const attempts = db.prepare(`
    SELECT ea.id, ea.score, ea.correct_count, ea.total_questions,
           ea.time_spent_seconds, ea.submitted_at, ea.exam_id,
           u.id as user_id, u.display_name, u.avatar_color, u.avatar_image, u.username,
           e.title as exam_title, s.name as subject_name, s.icon as subject_icon
    FROM exam_attempts ea
    JOIN users u ON ea.user_id = u.id
    JOIN exams e ON ea.exam_id = e.id
    JOIN subjects s ON e.subject_id = s.id
    WHERE ${where}
    ORDER BY ea.submitted_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, parseInt(limit), offset);

  const total = db.prepare(`
    SELECT COUNT(*) as c FROM exam_attempts ea WHERE ${where}
  `).get(...params);

  res.json({
    attempts: attempts.map(a => ({ ...a, id: Number(a.id), user_id: Number(a.user_id), exam_id: Number(a.exam_id) })),
    total: Number(total.c),
    page: parseInt(page),
    limit: parseInt(limit)
  });
});

// GET /api/admin/attempts/:id — 單次作答的完整錯題詳情
router.get('/attempts/:id', requireAdmin, (req, res) => {
  const attempt = db.prepare(`
    SELECT ea.*,
           u.display_name, u.avatar_color, u.avatar_image, u.username, u.id as uid,
           e.title as exam_title, e.passing_score,
           s.name as subject_name, s.icon as subject_icon
    FROM exam_attempts ea
    JOIN users u ON ea.user_id = u.id
    JOIN exams e ON ea.exam_id = e.id
    JOIN subjects s ON e.subject_id = s.id
    WHERE ea.id = ? AND ea.status = 'submitted'
  `).get(req.params.id);

  if (!attempt) return res.status(404).json({ error: '找不到此作答記錄' });

  const snapshot = JSON.parse(attempt.question_snapshot || '[]');
  const answers = JSON.parse(attempt.answers || '{}');

  const results = snapshot.map(q => {
    const ua = answers[q.id] !== undefined ? answers[q.id] : '';
    const isCorrect = q.type === 'fill'
      ? ua.trim().toLowerCase() === q.correct_answer.trim().toLowerCase()
      : ua.trim() === q.correct_answer.trim();
    return {
      question_id: Number(q.id),
      question_text: q.question_text,
      type: q.type,
      options: q.options ? (typeof q.options === 'string' ? JSON.parse(q.options) : q.options) : null,
      correct_answer: q.correct_answer,
      user_answer: ua,
      is_correct: isCorrect,
      explanation: q.explanation || '',
      level: q.level
    };
  });

  res.json({
    attempt_id: Number(attempt.id),
    user: {
      id: Number(attempt.uid),
      username: attempt.username,
      display_name: attempt.display_name,
      avatar_color: attempt.avatar_color,
      avatar_image: attempt.avatar_image
    },
    exam: {
      id: Number(attempt.exam_id),
      title: attempt.exam_title,
      subject_name: attempt.subject_name,
      subject_icon: attempt.subject_icon,
      passing_score: attempt.passing_score
    },
    score: attempt.score,
    correct_count: attempt.correct_count,
    total_questions: attempt.total_questions,
    time_spent_seconds: attempt.time_spent_seconds,
    submitted_at: attempt.submitted_at,
    passed: attempt.score >= (attempt.passing_score || 60),
    results
  });
});

// ── 科目管理 ────────────────────────────────────────────────

// GET /api/admin/subjects — 所有科目（含停用）
router.get('/subjects', requireAdmin, (req, res) => {
  const subjects = db.prepare(`
    SELECT s.*,
      (SELECT COUNT(*) FROM questions q WHERE q.subject_id = s.id) as question_count,
      (SELECT COUNT(*) FROM exams    e WHERE e.subject_id = s.id) as exam_count
    FROM subjects s ORDER BY s.id
  `).all();
  res.json(subjects.map(s => ({ ...s, id: Number(s.id) })));
});

// POST /api/admin/subjects — 新增科目
router.post('/subjects', requireAdmin, (req, res) => {
  const { name, name_en, description, icon } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: '科目名稱為必填' });
  const result = db.prepare(
    'INSERT INTO subjects (name, name_en, description, icon) VALUES (?, ?, ?, ?)'
  ).run(name.trim(), name_en?.trim() || null, description?.trim() || null, icon?.trim() || '📚');
  res.status(201).json({ id: Number(result.lastInsertRowid), message: '科目新增成功' });
});

// PUT /api/admin/subjects/:id — 更新科目
router.put('/subjects/:id', requireAdmin, (req, res) => {
  const s = db.prepare('SELECT id FROM subjects WHERE id = ?').get(req.params.id);
  if (!s) return res.status(404).json({ error: '找不到此科目' });
  const { name, name_en, description, icon } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: '科目名稱為必填' });
  db.prepare(
    'UPDATE subjects SET name=?, name_en=?, description=?, icon=? WHERE id=?'
  ).run(name.trim(), name_en?.trim() || null, description?.trim() || null, icon?.trim() || '📚', req.params.id);
  res.json({ message: '科目更新成功' });
});

// PATCH /api/admin/subjects/:id/toggle — 啟用/停用科目
router.patch('/subjects/:id/toggle', requireAdmin, (req, res) => {
  const s = db.prepare('SELECT id, is_active FROM subjects WHERE id = ?').get(req.params.id);
  if (!s) return res.status(404).json({ error: '找不到此科目' });
  const newStatus = s.is_active ? 0 : 1;
  db.prepare('UPDATE subjects SET is_active = ? WHERE id = ?').run(newStatus, req.params.id);
  res.json({ message: newStatus ? '科目已啟用' : '科目已停用', is_active: newStatus });
});

// DELETE /api/admin/subjects/:id — 刪除科目
router.delete('/subjects/:id', requireAdmin, (req, res) => {
  const s = db.prepare('SELECT id FROM subjects WHERE id = ?').get(req.params.id);
  if (!s) return res.status(404).json({ error: '找不到此科目' });
  const qCount = Number(db.prepare('SELECT COUNT(*) as c FROM questions WHERE subject_id = ?').get(req.params.id).c);
  const eCount = Number(db.prepare('SELECT COUNT(*) as c FROM exams    WHERE subject_id = ?').get(req.params.id).c);
  if (qCount > 0 || eCount > 0) {
    return res.status(409).json({
      error: `此科目尚有 ${qCount} 題題目、${eCount} 場考試，請先刪除後再移除科目。`
    });
  }
  db.prepare('DELETE FROM subjects WHERE id = ?').run(req.params.id);
  res.json({ message: '科目已刪除' });
});

// GET /api/admin/students — 所有學生的成績摘要
router.get('/students', requireAdmin, (req, res) => {
  const students = db.prepare(`
    SELECT u.id, u.username, u.display_name, u.avatar_color, u.avatar_image,
           COUNT(ea.id) as attempt_count,
           AVG(CASE WHEN ea.status='submitted' THEN ea.score END) as avg_score,
           MAX(CASE WHEN ea.status='submitted' THEN ea.score END) as best_score,
           SUM(CASE WHEN ea.status='submitted' THEN ea.time_spent_seconds END) as total_time
    FROM users u
    LEFT JOIN exam_attempts ea ON u.id = ea.user_id
    WHERE u.role = 'student'
    GROUP BY u.id
    ORDER BY attempt_count DESC
  `).all();

  res.json(students.map(s => ({ ...s, id: Number(s.id) })));
});

module.exports = router;
