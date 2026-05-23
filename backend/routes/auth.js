const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../database/db');
const { requireAuth, JWT_SECRET } = require('../middleware/auth');

const router = express.Router();
const JWT_EXPIRES = process.env.JWT_EXPIRES_IN || '8h';

// POST /api/auth/login
router.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: '請填寫帳號與密碼' });
  }

  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username.trim());
  if (!user) return res.status(401).json({ error: '帳號或密碼錯誤' });

  const valid = bcrypt.compareSync(password, user.password_hash);
  if (!valid) return res.status(401).json({ error: '帳號或密碼錯誤' });

  const payload = {
    id: Number(user.id),
    username: user.username,
    display_name: user.display_name,
    role: user.role,
    avatar_color: user.avatar_color
  };

  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES });
  res.json({ token, user: payload });
});

// POST /api/auth/change-password
router.post('/change-password', requireAuth, (req, res) => {
  const { current_password, new_password } = req.body;
  if (!current_password || !new_password) {
    return res.status(400).json({ error: '請填寫目前密碼與新密碼' });
  }
  if (new_password.length < 6) {
    return res.status(400).json({ error: '新密碼長度至少需要 6 個字元' });
  }

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  const valid = bcrypt.compareSync(current_password, user.password_hash);
  if (!valid) return res.status(401).json({ error: '目前密碼不正確' });

  const newHash = bcrypt.hashSync(new_password, 10);
  db.prepare('UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
    .run(newHash, req.user.id);

  res.json({ message: '密碼更新成功' });
});

// POST /api/auth/update-profile
router.post('/update-profile', requireAuth, (req, res) => {
  const { display_name, avatar_color, avatar_image } = req.body;
  if (!display_name || display_name.trim().length === 0) {
    return res.status(400).json({ error: '顯示名稱不能為空' });
  }
  // avatar_image 為 base64 data URL，限制大小 2MB
  if (avatar_image && avatar_image.length > 2 * 1024 * 1024 * 1.37) {
    return res.status(400).json({ error: '圖片檔案過大，請壓縮後再上傳（建議小於 1.5MB）' });
  }
  const imgValue = avatar_image === null ? null : (avatar_image || undefined);

  if (imgValue !== undefined) {
    db.prepare('UPDATE users SET display_name = ?, avatar_color = ?, avatar_image = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(display_name.trim(), avatar_color || '#3B82F6', imgValue, req.user.id);
  } else {
    db.prepare('UPDATE users SET display_name = ?, avatar_color = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(display_name.trim(), avatar_color || '#3B82F6', req.user.id);
  }

  res.json({ message: '個人資料更新成功', display_name: display_name.trim() });
});

// GET /api/auth/me
router.get('/me', requireAuth, (req, res) => {
  const user = db.prepare(
    'SELECT id, username, display_name, role, avatar_color, avatar_image, created_at FROM users WHERE id = ?'
  ).get(req.user.id);
  if (!user) return res.status(404).json({ error: '找不到使用者' });
  res.json({ ...user, id: Number(user.id) });
});

module.exports = router;
