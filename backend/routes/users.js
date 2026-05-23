const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../database/db');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

router.get('/', requireAdmin, (req, res) => {
  const users = db.prepare(
    'SELECT id, username, display_name, role, avatar_color, avatar_image, created_at FROM users ORDER BY role DESC, created_at ASC'
  ).all();
  res.json(users.map(u => ({ ...u, id: Number(u.id) })));
});

router.post('/', requireAdmin, (req, res) => {
  const { username, password, display_name, role = 'student' } = req.body;
  if (!username || !password || !display_name)
    return res.status(400).json({ error: '請填寫帳號、密碼與顯示名稱' });
  if (password.length < 6) return res.status(400).json({ error: '密碼長度至少需要 6 個字元' });
  if (!['admin','student'].includes(role)) return res.status(400).json({ error: '無效的身分類型' });

  if (db.prepare('SELECT id FROM users WHERE username=?').get(username.trim()))
    return res.status(409).json({ error: '此帳號名稱已被使用' });

  const hash = bcrypt.hashSync(password, 10);
  const colors = ['#3B82F6','#10B981','#F59E0B','#EF4444','#8B5CF6','#06B6D4','#F97316'];
  const avatarColor = colors[Math.floor(Math.random() * colors.length)];
  const result = db.prepare(
    'INSERT INTO users (username,password_hash,display_name,role,avatar_color) VALUES (?,?,?,?,?)'
  ).run(username.trim(), hash, display_name.trim(), role, avatarColor);

  res.status(201).json({ id: Number(result.lastInsertRowid), username: username.trim(), display_name: display_name.trim(), role, avatar_color: avatarColor, message: '使用者建立成功' });
});

router.put('/:id', requireAdmin, (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id=?').get(req.params.id);
  if (!user) return res.status(404).json({ error: '找不到此使用者' });

  const { display_name, role, new_password } = req.body;
  if (display_name)
    db.prepare('UPDATE users SET display_name=?, updated_at=CURRENT_TIMESTAMP WHERE id=?').run(display_name.trim(), req.params.id);
  if (role && ['admin','student'].includes(role))
    db.prepare('UPDATE users SET role=?, updated_at=CURRENT_TIMESTAMP WHERE id=?').run(role, req.params.id);
  if (new_password) {
    if (new_password.length < 6) return res.status(400).json({ error: '密碼長度至少需要 6 個字元' });
    db.prepare('UPDATE users SET password_hash=?, updated_at=CURRENT_TIMESTAMP WHERE id=?').run(bcrypt.hashSync(new_password, 10), req.params.id);
  }
  res.json({ message: '使用者資料更新成功' });
});

router.delete('/:id', requireAdmin, (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id=?').get(req.params.id);
  if (!user) return res.status(404).json({ error: '找不到此使用者' });
  if (user.username === 'wesley970913') return res.status(403).json({ error: '不能刪除系統主要管理者帳號' });
  db.prepare('DELETE FROM users WHERE id=?').run(req.params.id);
  res.json({ message: '使用者已刪除' });
});

router.get('/:id/stats', requireAdmin, (req, res) => {
  const stats = db.prepare(`
    SELECT COUNT(*) as total_attempts,
           COUNT(CASE WHEN status='submitted' THEN 1 END) as completed_attempts,
           AVG(CASE WHEN status='submitted' THEN score END) as avg_score,
           MAX(CASE WHEN status='submitted' THEN score END) as best_score,
           SUM(CASE WHEN status='submitted' THEN time_spent_seconds END) as total_time
    FROM exam_attempts WHERE user_id=?
  `).get(req.params.id);
  res.json(stats);
});

module.exports = router;
