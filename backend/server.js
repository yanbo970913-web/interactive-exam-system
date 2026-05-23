require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// ── 中介軟體
app.use(cors({
  origin: process.env.NODE_ENV === 'production' ? false : '*',
  credentials: true
}));
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));

// ── 靜態前端
app.use(express.static(path.join(__dirname, '../frontend')));

// ── API 路由
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/questions', require('./routes/questions'));
app.use('/api/exams', require('./routes/exams'));
app.use('/api/ai', require('./routes/ai'));
app.use('/api/admin', require('./routes/admin'));

// ── 健康檢查
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    time: new Date().toISOString(),
    ai_enabled: !!process.env.ANTHROPIC_API_KEY,
    version: '1.0.0'
  });
});

// ── SPA fallback（所有未匹配路由回傳 index.html）
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// ── 全域錯誤處理
app.use((err, req, res, next) => {
  console.error('伺服器錯誤:', err.stack);
  res.status(500).json({ error: '伺服器內部錯誤，請稍後再試' });
});

app.listen(PORT, () => {
  console.log('');
  console.log('╔══════════════════════════════════════════╗');
  console.log('║  🎓  趣味互動考試系統  已啟動             ║');
  console.log(`║  📍  http://localhost:${PORT}               ║`);
  console.log(`║  🤖  AI 模式: ${process.env.ANTHROPIC_API_KEY ? '✅ 已啟用' : '⚠️  Fallback 模擬'}         ║`);
  console.log('╚══════════════════════════════════════════╝');
  console.log('');
});

module.exports = app;
