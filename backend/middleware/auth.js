const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_dev_secret_change_in_production_32chars';

function requireAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return res.status(401).json({ error: '未授權：缺少身分驗證令牌' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError')
      return res.status(401).json({ error: '令牌已過期，請重新登入' });
    return res.status(403).json({ error: '無效的身分驗證令牌' });
  }
}

/** 僅最高管理員 */
function requireSuperAdmin(req, res, next) {
  requireAuth(req, res, () => {
    if (req.user.role !== 'superadmin')
      return res.status(403).json({ error: '權限不足：需要最高管理員身分' });
    next();
  });
}

/** 最高管理員 或 老師 */
function requireStaff(req, res, next) {
  requireAuth(req, res, () => {
    if (!['superadmin', 'teacher'].includes(req.user.role))
      return res.status(403).json({ error: '權限不足：需要老師或管理員身分' });
    next();
  });
}

/** 向下相容舊程式碼：等同 requireSuperAdmin */
const requireAdmin = requireSuperAdmin;

module.exports = { requireAuth, requireSuperAdmin, requireStaff, requireAdmin, JWT_SECRET };
