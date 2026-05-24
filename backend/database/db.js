require('dotenv').config();
const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');

const dbDir = path.join(__dirname, '../../data');
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const dbPath = process.env.DB_PATH
  ? path.resolve(process.env.DB_PATH)
  : path.join(dbDir, 'exam_system.db');

// 確保自訂 DB_PATH 的上層目錄存在（Railway Volume 掛載時必要）
const dbPathDir = path.dirname(dbPath);
if (!fs.existsSync(dbPathDir)) {
  fs.mkdirSync(dbPathDir, { recursive: true });
}

const db = new DatabaseSync(dbPath);

// ── SQLite 效能調校
db.exec('PRAGMA journal_mode = WAL');      // 提升並行讀寫
db.exec('PRAGMA foreign_keys = ON');       // 外鍵約束
db.exec('PRAGMA busy_timeout = 5000');     // 鎖定等待 5 秒再報錯
db.exec('PRAGMA cache_size = -8000');      // 8 MB 頁面快取
db.exec('PRAGMA synchronous = NORMAL');    // WAL 模式下安全且更快
db.exec('PRAGMA temp_store = MEMORY');     // 暫存表放記憶體

function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      display_name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'student',
      avatar_color TEXT DEFAULT '#3B82F6',
      avatar_image TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS subjects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      name_en TEXT,
      description TEXT,
      icon TEXT DEFAULT '📚',
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS questions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      subject_id INTEGER NOT NULL,
      level INTEGER NOT NULL DEFAULT 1,
      type TEXT NOT NULL CHECK(type IN ('choice','fill')),
      question_text TEXT NOT NULL,
      options TEXT,
      correct_answer TEXT NOT NULL,
      explanation TEXT,
      is_active INTEGER DEFAULT 1,
      created_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (subject_id) REFERENCES subjects(id),
      FOREIGN KEY (created_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS exams (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      subject_id INTEGER NOT NULL,
      level_filter TEXT DEFAULT 'all',
      question_count INTEGER NOT NULL DEFAULT 10,
      start_time DATETIME,
      end_time DATETIME,
      duration_minutes INTEGER NOT NULL DEFAULT 30,
      shuffle_questions INTEGER DEFAULT 1,
      shuffle_options INTEGER DEFAULT 1,
      passing_score INTEGER DEFAULT 60,
      is_active INTEGER DEFAULT 1,
      created_by INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (subject_id) REFERENCES subjects(id),
      FOREIGN KEY (created_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS exam_attempts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      exam_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      submitted_at DATETIME,
      score INTEGER,
      total_questions INTEGER,
      correct_count INTEGER,
      time_spent_seconds INTEGER,
      answers TEXT,
      question_snapshot TEXT,
      status TEXT DEFAULT 'in_progress',
      FOREIGN KEY (exam_id) REFERENCES exams(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS leaderboard_cache (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      exam_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      display_name TEXT NOT NULL,
      score INTEGER NOT NULL,
      time_spent_seconds INTEGER,
      submitted_at DATETIME,
      FOREIGN KEY (exam_id) REFERENCES exams(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE INDEX IF NOT EXISTS idx_questions_subject ON questions(subject_id);
    CREATE INDEX IF NOT EXISTS idx_questions_level ON questions(level);
    CREATE INDEX IF NOT EXISTS idx_attempts_exam ON exam_attempts(exam_id);
    CREATE INDEX IF NOT EXISTS idx_attempts_user ON exam_attempts(user_id);
  `);
}

initSchema();

// 遷移：若舊資料庫缺少 avatar_image 欄位則新增
try { db.exec('ALTER TABLE users ADD COLUMN avatar_image TEXT'); } catch (_) {}

// 遷移：舊 admin 角色升級為 superadmin（三層身份系統）
try { db.exec("UPDATE users SET role='superadmin' WHERE role='admin'"); } catch (_) {}

// 遷移：確保 ADMIN_USERNAME 帳號永遠是 superadmin（修正角色錯誤）
try {
  if (process.env.ADMIN_USERNAME) {
    db.prepare("UPDATE users SET role='superadmin' WHERE username=?")
      .run(process.env.ADMIN_USERNAME);
  }
} catch (_) {}

// 遷移：新增 max_attempts 欄位（NULL = 無限次）
try { db.exec('ALTER TABLE exams ADD COLUMN max_attempts INTEGER DEFAULT NULL'); } catch (_) {}

// 遷移：指定學生考試分配表
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS exam_assignments (
      id       INTEGER PRIMARY KEY AUTOINCREMENT,
      exam_id  INTEGER NOT NULL,
      user_id  INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (exam_id) REFERENCES exams(id),
      FOREIGN KEY (user_id) REFERENCES users(id),
      UNIQUE(exam_id, user_id)
    );
    CREATE INDEX IF NOT EXISTS idx_assignments_exam ON exam_assignments(exam_id);
    CREATE INDEX IF NOT EXISTS idx_assignments_user ON exam_assignments(user_id);
  `);
} catch (_) {}

// 一次性清理：刪除 Python 程式設計、數位邏輯 科目及其所有題目
try {
  const toRemove = ['Python 程式設計', '數位邏輯'];
  for (const name of toRemove) {
    const subj = db.prepare("SELECT id FROM subjects WHERE name = ?").get(name);
    if (subj) {
      db.exec('BEGIN');
      try {
        db.prepare('DELETE FROM questions WHERE subject_id = ?').run(subj.id);
        db.prepare('DELETE FROM subjects  WHERE id = ?').run(subj.id);
        db.exec('COMMIT');
        console.log(`🗑️  已自動清除科目「${name}」及其所有題目`);
      } catch (e) {
        db.exec('ROLLBACK');
        console.error(`清除科目「${name}」失敗:`, e.message);
      }
    }
  }
} catch (_) {}

module.exports = db;
