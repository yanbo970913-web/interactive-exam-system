const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../database/db');
const { requireSuperAdmin, requireStaff } = require('../middleware/auth');

const router = express.Router();

// ── 工具：判斷操作者是否有權限管理目標角色
function canManage(operatorRole, targetRole) {
  if (operatorRole === 'superadmin') return true;          // 最高管理員可管理所有人
  if (operatorRole === 'teacher' && targetRole === 'student') return true; // 老師只能管理學生
  return false;
}

// GET / — 列出使用者
//   superadmin：看全部（超管、老師、學生）
//   teacher：只看學生
router.get('/', requireStaff, (req, res) => {
  const isSuperAdmin = req.user.role === 'superadmin';
  const users = isSuperAdmin
    ? db.prepare(
        "SELECT id, username, display_name, role, avatar_color, avatar_image, created_at FROM users ORDER BY CASE role WHEN 'superadmin' THEN 0 WHEN 'teacher' THEN 1 ELSE 2 END, created_at ASC"
      ).all()
    : db.prepare(
        "SELECT id, username, display_name, role, avatar_color, avatar_image, created_at FROM users WHERE role='student' ORDER BY created_at ASC"
      ).all();
  res.json(users.map(u => ({ ...u, id: Number(u.id) })));
});

// POST / — 新增使用者
//   superadmin：可建立 teacher / student
//   teacher：只能建立 student
router.post('/', requireStaff, (req, res) => {
  const { username, password, display_name, role = 'student' } = req.body;
  if (!username || !password || !display_name)
    return res.status(400).json({ error: '請填寫帳號、密碼與顯示名稱' });
  if (password.length < 6)
    return res.status(400).json({ error: '密碼長度至少需要 6 個字元' });

  // 可建立的角色限制
  const allowed = req.user.role === 'superadmin' ? ['teacher', 'student'] : ['student'];
  if (!allowed.includes(role))
    return res.status(403).json({ error: `您無權建立「${role}」身份帳號` });

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

// PUT /:id — 更新使用者
router.put('/:id', requireStaff, (req, res) => {
  const target = db.prepare('SELECT * FROM users WHERE id=?').get(req.params.id);
  if (!target) return res.status(404).json({ error: '找不到此使用者' });
  // superadmin 只能自己改自己的顯示名稱/密碼，不能被他人修改角色
  if (target.role === 'superadmin' && req.user.id !== Number(target.id))
    return res.status(403).json({ error: '不能修改最高管理員帳號' });
  if (!canManage(req.user.role, target.role))
    return res.status(403).json({ error: '權限不足：無法修改此帳號' });

  const { display_name, role, new_password } = req.body;

  if (display_name)
    db.prepare('UPDATE users SET display_name=?, updated_at=CURRENT_TIMESTAMP WHERE id=?')
      .run(display_name.trim(), req.params.id);

  // 角色變更：superadmin 才能做，且不能升降 superadmin
  if (role && req.user.role === 'superadmin') {
    if (['teacher', 'student'].includes(role) && target.role !== 'superadmin')
      db.prepare('UPDATE users SET role=?, updated_at=CURRENT_TIMESTAMP WHERE id=?')
        .run(role, req.params.id);
  }

  if (new_password) {
    if (new_password.length < 6) return res.status(400).json({ error: '密碼長度至少需要 6 個字元' });
    db.prepare('UPDATE users SET password_hash=?, updated_at=CURRENT_TIMESTAMP WHERE id=?')
      .run(bcrypt.hashSync(new_password, 10), req.params.id);
  }
  res.json({ message: '使用者資料更新成功' });
});

// DELETE /:id — 刪除使用者
router.delete('/:id', requireStaff, (req, res) => {
  const target = db.prepare('SELECT * FROM users WHERE id=?').get(req.params.id);
  if (!target) return res.status(404).json({ error: '找不到此使用者' });
  // superadmin 帳號絕對不可刪除（雙重保護：角色 + 環境變數帳號）
  if (target.role === 'superadmin')
    return res.status(403).json({ error: '不能刪除最高管理員帳號' });
  if (process.env.ADMIN_USERNAME && target.username === process.env.ADMIN_USERNAME)
    return res.status(403).json({ error: '不能刪除系統主要管理員帳號' });
  if (!canManage(req.user.role, target.role))
    return res.status(403).json({ error: '權限不足：無法刪除此帳號' });
  db.prepare('DELETE FROM users WHERE id=?').run(req.params.id);
  res.json({ message: '使用者已刪除' });
});

// GET /:id/stats
router.get('/:id/stats', requireStaff, (req, res) => {
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
