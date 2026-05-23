require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const bcrypt = require('bcryptjs');
const db = require('./db');
const vocabulary = require('../data/vocabulary');
const pythonQuestions = require('../data/python_questions');
const digitalLogicQuestions = require('../data/digital_logic_questions');

function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function runSeed() {
  const adminUsername = process.env.ADMIN_USERNAME;
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminUsername || !adminPassword) {
    const msg = '❌ 請在 .env 中設定 ADMIN_USERNAME 與 ADMIN_PASSWORD';
    throw new Error(msg);
  }

  console.log('🌱 開始初始化資料庫...');

  // ── 1. 清空舊資料
  db.exec(`
    DELETE FROM leaderboard_cache;
    DELETE FROM exam_attempts;
    DELETE FROM exams;
    DELETE FROM questions;
    DELETE FROM subjects;
    DELETE FROM users;
  `);

  // ── 2. 建立管理者帳號（密碼從環境變數讀取）
  const adminPasswordHash = bcrypt.hashSync(adminPassword, 12);
  const insertUser = db.prepare(`
    INSERT INTO users (username, password_hash, display_name, role, avatar_color)
    VALUES (?, ?, ?, ?, ?)
  `);
  const adminResult = insertUser.run(
    adminUsername, adminPasswordHash,
    process.env.ADMIN_DISPLAY_NAME || '系統管理員',
    'superadmin', '#7C3AED'
  );
  const adminId = Number(adminResult.lastInsertRowid);
  console.log(`  ✅ 管理者帳號建立完成（帳號：${adminUsername}）`);

  // ── 3. 建立科目
  const insertSubject = db.prepare(
    'INSERT INTO subjects (name, name_en, description, icon) VALUES (?, ?, ?, ?)'
  );
  const engSubjectId = Number(insertSubject.run('英文單字', 'English Vocabulary',
    '基於 7000 單字表，按難度分為 Level 1~7，包含拼字與翻譯練習。', '🔤').lastInsertRowid);
  const pySubjectId = Number(insertSubject.run('Python 程式設計', 'Python Programming',
    '涵蓋 Python 基礎語法、資料結構、函數與進階特性。', '🐍').lastInsertRowid);
  const dlSubjectId = Number(insertSubject.run('數位邏輯', 'Digital Logic',
    '包含布林代數、邏輯閘、卡諾圖、正反器等數位電路基礎。', '💡').lastInsertRowid);
  console.log('  ✅ 科目建立完成：英文單字、Python 程式設計、數位邏輯');

  // ── 4. 英文單字題目
  const insertQuestion = db.prepare(`
    INSERT INTO questions (subject_id, level, type, question_text, options, correct_answer, explanation, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  let vocabCount = 0;
  for (const vocab of vocabulary) {
    insertQuestion.run(engSubjectId, vocab.level, 'fill',
      `請拼出以下中文意思對應的英文單字：\n「${vocab.translation}」`,
      null, vocab.word.toLowerCase(),
      `正確答案是「${vocab.word}」（${vocab.translation}）。Level ${vocab.level} 單字，請熟記拼法。`,
      adminId);

    const distractors = shuffleArray(
      vocabulary.filter(v => v.level === vocab.level && v.word !== vocab.word)
    ).slice(0, 3).map(v => v.translation);
    const allOptions = shuffleArray([vocab.translation, ...distractors]);
    insertQuestion.run(engSubjectId, vocab.level, 'choice',
      `英文單字「${vocab.word}」的中文意思是？`,
      JSON.stringify(allOptions), vocab.translation,
      `「${vocab.word}」的中文意思是「${vocab.translation}」。Level ${vocab.level} 單字。`,
      adminId);
    vocabCount += 2;
  }
  console.log(`  ✅ 英文單字題目建立完成：${vocabCount} 題`);

  // ── 5. Python 題目
  for (const q of pythonQuestions) {
    insertQuestion.run(pySubjectId, q.level, q.type, q.question_text,
      q.options || null, q.correct_answer, q.explanation, adminId);
  }
  console.log(`  ✅ Python 程式設計題目建立完成：${pythonQuestions.length} 題`);

  // ── 6. 數位邏輯題目
  for (const q of digitalLogicQuestions) {
    insertQuestion.run(dlSubjectId, q.level, q.type, q.question_text,
      q.options || null, q.correct_answer, q.explanation, adminId);
  }
  console.log(`  ✅ 數位邏輯題目建立完成：${digitalLogicQuestions.length} 題`);

  // ── 7. 示範考試
  const now = new Date();
  const nextYear = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
  const insertExam = db.prepare(`
    INSERT INTO exams (title, description, subject_id, level_filter, question_count, start_time, end_time, duration_minutes, passing_score, max_attempts, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insertExam.run('Level 1-2 英文單字入門測驗', '測試 Level 1 與 Level 2 基礎英文單字，包含拼字與翻譯。',
    engSubjectId, '1,2', 10, now.toISOString(), nextYear.toISOString(), 15, 60, 3, adminId);
  insertExam.run('Level 3-4 英文單字進階測驗', '測試 Level 3 與 Level 4 中級英文單字。',
    engSubjectId, '3,4', 15, now.toISOString(), nextYear.toISOString(), 20, 60, null, adminId);
  insertExam.run('Level 5-7 英文單字挑戰測驗', '挑戰 Level 5~7 高難度英文單字。',
    engSubjectId, '5,6,7', 20, now.toISOString(), nextYear.toISOString(), 25, 60, 2, adminId);
  insertExam.run('Python 基礎概念測驗', '測試 Python 基礎語法、資料型別與基本操作。',
    pySubjectId, 'all', 10, now.toISOString(), nextYear.toISOString(), 20, 60, null, adminId);
  insertExam.run('數位邏輯基礎測驗', '測試布林代數、邏輯閘真值表與進制轉換。',
    dlSubjectId, 'all', 10, now.toISOString(), nextYear.toISOString(), 20, 60, null, adminId);
  console.log('  ✅ 示範考試建立完成：5 場考試（含次數限制示範）');

  console.log('\n🎉 資料庫初始化完成！');
  console.log('─'.repeat(50));
  console.log(`  管理者帳號: ${adminUsername}`);
  console.log('─'.repeat(50));
}

// ── 匯出供 server.js 自動初始化呼叫
module.exports = { runSeed };

// ── 直接執行 node seed.js 時的 CLI 模式
if (require.main === module) {
  try {
    db.exec('BEGIN');
    runSeed();
    db.exec('COMMIT');
    console.log('\n▶  執行 npm start 啟動伺服器');
  } catch (err) {
    db.exec('ROLLBACK');
    console.error('❌ 初始化失敗:', err.message);
    process.exit(1);
  }
}
