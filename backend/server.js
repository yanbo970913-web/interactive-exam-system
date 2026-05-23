require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// ── 中介軟體
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true
}));
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));

// ── 靜態前端
app.use(express.static(path.join(__dirname, '../frontend')));

// ── API 路由
app.use('/api/auth',      require('./routes/auth'));
app.use('/api/users',     require('./routes/users'));
app.use('/api/questions', require('./routes/questions'));
app.use('/api/exams',     require('./routes/exams'));
app.use('/api/ai',        require('./routes/ai'));
app.use('/api/admin',     require('./routes/admin'));
app.use('/api/live',      require('./routes/live'));

// ── 健康檢查
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    time: new Date().toISOString(),
    ai_enabled: !!process.env.ANTHROPIC_API_KEY,
    version: '1.0.0'
  });
});

// ── SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// ── 全域錯誤處理
app.use((err, req, res, next) => {
  console.error('伺服器錯誤:', err.stack);
  res.status(500).json({ error: '伺服器內部錯誤，請稍後再試' });
});

// ── 自動初始化：資料庫為空時自動執行 seed ─────────────
function autoSeedIfEmpty() {
  try {
    const db = require('./database/db');
    const count = Number(db.prepare('SELECT COUNT(*) as c FROM users').get().c);
    if (count === 0) {
      if (!process.env.ADMIN_USERNAME || !process.env.ADMIN_PASSWORD) {
        console.warn('⚠️  資料庫為空，但未設定 ADMIN_USERNAME / ADMIN_PASSWORD，跳過自動初始化。');
        return;
      }
      console.log('🌱 偵測到空資料庫，自動執行初始化...');
      const { runSeed } = require('./database/seed');
      db.exec('BEGIN');
      try {
        runSeed();
        db.exec('COMMIT');
        console.log('✅ 自動初始化完成');
      } catch (e) {
        db.exec('ROLLBACK');
        throw e;
      }
    }
  } catch (err) {
    console.error('❌ 自動初始化失敗:', err.message);
  }
}

app.listen(PORT, () => {
  console.log('');
  console.log('╔══════════════════════════════════════════╗');
  console.log('║  🎓  趣味互動考試系統  已啟動             ║');
  console.log(`║  📍  Port ${PORT.toString().padEnd(31)}║`);
  console.log(`║  🤖  AI: ${(process.env.NVIDIA_API_KEY ? '✅ NVIDIA 已啟用' : '⚠️  Fallback 模擬').padEnd(28)}║`);
  console.log('╚══════════════════════════════════════════╝');
  console.log('');
  autoSeedIfEmpty();
});

module.exports = app;
