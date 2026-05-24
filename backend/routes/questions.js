const express = require('express');
const db = require('../database/db');
const { requireAuth, requireStaff } = require('../middleware/auth');

const router = express.Router();

// GET /api/questions/subjects/list — 必須在 /:id 路由之前
router.get('/subjects/list', requireAuth, (req, res) => {
  const subjects = db.prepare('SELECT * FROM subjects WHERE is_active = 1 ORDER BY id').all();
  res.json(subjects);
});

// GET /api/questions
router.get('/', requireAuth, (req, res) => {
  const { subject_id, level, type, search, page = 1, limit = 50 } = req.query;
  const isAdmin = req.user.role === 'superadmin' || req.user.role === 'admin' || req.user.role === 'teacher';

  const conditions = ['1=1'];
  const countParams = [];
  const params = [];

  if (!isAdmin) { conditions.push('q.is_active = 1'); }
  if (subject_id) { conditions.push('q.subject_id = ?'); countParams.push(subject_id); }
  if (level)      { conditions.push('q.level = ?');      countParams.push(parseInt(level)); }
  if (type)       { conditions.push('q.type = ?');        countParams.push(type); }
  if (search)     { conditions.push('q.question_text LIKE ?'); countParams.push(`%${search}%`); }

  const where = conditions.join(' AND ');
  params.push(...countParams, parseInt(limit), (parseInt(page) - 1) * parseInt(limit));

  const questions = db.prepare(`
    SELECT q.*, s.name as subject_name
    FROM questions q JOIN subjects s ON q.subject_id = s.id
    WHERE ${where}
    ORDER BY q.subject_id, q.level, q.id
    LIMIT ? OFFSET ?
  `).all(...params);

  const total = db.prepare(`
    SELECT COUNT(*) as count FROM questions q WHERE ${where}
  `).get(...countParams);

  res.json({ questions, total: Number(total.count), page: parseInt(page), limit: parseInt(limit) });
});

// GET /api/questions/:id
router.get('/:id', requireStaff, (req, res) => {
  const q = db.prepare('SELECT * FROM questions WHERE id = ?').get(req.params.id);
  if (!q) return res.status(404).json({ error: '找不到此題目' });
  res.json(q);
});

// POST /api/questions
router.post('/', requireStaff, (req, res) => {
  const { subject_id, level, type, question_text, options, correct_answer, explanation } = req.body;
  if (!subject_id || !level || !type || !question_text || !correct_answer) {
    return res.status(400).json({ error: '缺少必填欄位' });
  }
  if (!['choice', 'fill'].includes(type)) return res.status(400).json({ error: '題型必須為 choice 或 fill' });
  if (type === 'choice' && !options)      return res.status(400).json({ error: '選擇題需要提供選項' });

  const optionsJson = options ? JSON.stringify(Array.isArray(options) ? options : JSON.parse(options)) : null;
  const result = db.prepare(`
    INSERT INTO questions (subject_id, level, type, question_text, options, correct_answer, explanation, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(subject_id, parseInt(level), type, question_text, optionsJson, correct_answer, explanation || null, req.user.id);

  res.status(201).json({ id: Number(result.lastInsertRowid), message: '題目新增成功' });
});

// PUT /api/questions/:id
router.put('/:id', requireStaff, (req, res) => {
  const q = db.prepare('SELECT * FROM questions WHERE id = ?').get(req.params.id);
  if (!q) return res.status(404).json({ error: '找不到此題目' });

  const { subject_id, level, type, question_text, options, correct_answer, explanation, is_active } = req.body;
  const optionsJson = options ? JSON.stringify(Array.isArray(options) ? options : JSON.parse(options)) : q.options;

  db.prepare(`
    UPDATE questions
    SET subject_id=?, level=?, type=?, question_text=?, options=?, correct_answer=?, explanation=?, is_active=?, updated_at=CURRENT_TIMESTAMP
    WHERE id=?
  `).run(
    subject_id || q.subject_id, parseInt(level) || q.level, type || q.type,
    question_text || q.question_text, optionsJson,
    correct_answer || q.correct_answer,
    explanation !== undefined ? explanation : q.explanation,
    is_active !== undefined ? (is_active ? 1 : 0) : q.is_active,
    req.params.id
  );

  res.json({ message: '題目更新成功' });
});

// DELETE /api/questions/:id
router.delete('/:id', requireStaff, (req, res) => {
  const q = db.prepare('SELECT id FROM questions WHERE id = ?').get(req.params.id);
  if (!q) return res.status(404).json({ error: '找不到此題目' });
  db.prepare('DELETE FROM questions WHERE id = ?').run(req.params.id);
  res.json({ message: '題目已刪除' });
});

// PATCH /api/questions/:id/toggle
router.patch('/:id/toggle', requireStaff, (req, res) => {
  const q = db.prepare('SELECT * FROM questions WHERE id = ?').get(req.params.id);
  if (!q) return res.status(404).json({ error: '找不到此題目' });
  const newStatus = q.is_active ? 0 : 1;
  db.prepare('UPDATE questions SET is_active = ? WHERE id = ?').run(newStatus, req.params.id);
  res.json({ message: newStatus ? '題目已啟用' : '題目已停用', is_active: newStatus });
});

module.exports = router;
