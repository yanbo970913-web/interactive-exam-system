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
    ai_enabled: !!process.env.NVIDIA_API_KEY,
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

// ── 自動同步英文單字題庫：題目數不足時自動重建 ─────────
function autoSyncVocabulary() {
  try {
    const db = require('./database/db');

    // 找英文科目
    const subject = db.prepare("SELECT id, name FROM subjects WHERE name LIKE '%英文%'").get();
    if (!subject) return; // 尚未初始化，跳過

    // 載入最新 vocabulary.js
    const vocabPath = require.resolve('./data/vocabulary');
    delete require.cache[vocabPath];
    const vocabulary = require('./data/vocabulary');

    // 計算唯一單字數（去重）
    const seen = new Map();
    for (const v of vocabulary) {
      const key = v.word.toLowerCase();
      if (!seen.has(key) || v.level < seen.get(key).level) seen.set(key, v);
    }
    const uniqueVocab = [...seen.values()];
    const expectedMin = uniqueVocab.length * 2; // 每字2題

    // 現有題目數
    const currentCount = Number(
      db.prepare('SELECT COUNT(*) as c FROM questions WHERE subject_id = ?').get(subject.id).c
    );

    if (currentCount >= expectedMin) {
      console.log(`✅ 英文單字題庫已是最新（${currentCount} 題，${uniqueVocab.length} 個單字）`);
      return;
    }

    console.log(`🔄 偵測到英文題庫過舊（現有 ${currentCount} 題，預期 ${expectedMin} 題），自動同步中...`);

    function shuffleArray(arr) {
      const a = [...arr];
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    }

    // 取得管理員 id（用於 created_by）
    const admin = db.prepare("SELECT id FROM users WHERE role='superadmin' LIMIT 1").get();
    const adminId = admin ? admin.id : 1;

    db.exec('BEGIN');
    try {
      db.prepare('DELETE FROM questions WHERE subject_id = ?').run(subject.id);
      const insert = db.prepare(`
        INSERT INTO questions (subject_id, level, type, question_text, options, correct_answer, explanation, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      let count = 0;
      for (const vocab of uniqueVocab) {
        insert.run(subject.id, vocab.level, 'fill',
          `請拼出以下中文意思對應的英文單字：\n「${vocab.translation}」`,
          null, vocab.word.toLowerCase(),
          `正確答案是「${vocab.word}」（${vocab.translation}）。Level ${vocab.level} 單字，請熟記拼法。`,
          adminId);
        const sameLevel = uniqueVocab.filter(v => v.level === vocab.level && v.word !== vocab.word);
        const distractors = shuffleArray(sameLevel).slice(0, 3).map(v => v.translation);
        const allOptions = shuffleArray([vocab.translation, ...distractors]);
        insert.run(subject.id, vocab.level, 'choice',
          `英文單字「${vocab.word}」的中文意思是？`,
          JSON.stringify(allOptions), vocab.translation,
          `「${vocab.word}」的中文意思是「${vocab.translation}」。Level ${vocab.level} 單字。`,
          adminId);
        count += 2;
      }
      db.exec('COMMIT');
      console.log(`✅ 英文單字題庫自動同步完成：${uniqueVocab.length} 個單字，共 ${count} 題`);
    } catch (e) {
      db.exec('ROLLBACK');
      console.error('❌ 自動同步失敗:', e.message);
    }
  } catch (err) {
    console.error('❌ 自動同步檢查失敗:', err.message);
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
  // 每次啟動都檢查英文題庫是否需要更新
  autoSyncVocabulary();
});

module.exports = app;
