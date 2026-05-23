# 🎓 趣味互動考試系統

> 支援多科目、AI 針對性解惑、藍底白字精美 UI、完整雙身份管理

---

## 📂 專案目錄結構

```
考試系統/
├── backend/
│   ├── server.js                 # Express 主伺服器
│   ├── database/
│   │   ├── db.js                 # SQLite 資料庫初始化與 Schema
│   │   └── seed.js               # 資料播種（單字庫、題目、示範考試）
│   ├── data/
│   │   ├── vocabulary.js         # 7000 英文單字庫（Level 1~7）
│   │   ├── python_questions.js   # Python 程式設計題庫
│   │   └── digital_logic_questions.js  # 數位邏輯題庫
│   ├── middleware/
│   │   └── auth.js               # JWT 身分驗證中介軟體
│   └── routes/
│       ├── auth.js               # 登入、改密碼、個人資料
│       ├── users.js              # 使用者管理（Admin）
│       ├── questions.js          # 題庫管理
│       ├── exams.js              # 考試管理、作答、提交
│       └── ai.js                 # AI 解惑（Anthropic API + Fallback）
├── frontend/
│   ├── index.html                # 單頁應用（SPA）主殼
│   ├── css/
│   │   └── styles.css            # 全域藍底白字樣式（RWD）
│   └── js/
│       ├── api.js                # API 客戶端
│       ├── app.js                # 路由、狀態、全域工具
│       ├── exam.js               # 考試進行中模組
│       ├── results.js            # 成績結果＋AI解惑
│       ├── admin.js              # 管理者後台（題庫/考試/使用者）
│       ├── practice.js           # 快速練習模式
│       └── profile.js            # 個人設定
├── data/                         # 執行後自動建立（SQLite 資料庫存放處）
├── .env.example                  # 環境變數範本
├── .gitignore
├── package.json
└── README.md
```

---

## 🚀 快速啟動

### 1. 安裝依賴

```bash
npm install
```

> **注意（Windows 使用者）**：`better-sqlite3` 需要 C++ 編譯工具。
> 請確保已安裝 [Node.js](https://nodejs.org) 18+ 及 [Windows Build Tools](https://github.com/nodejs/node-gyp#on-windows)：
> ```bash
> npm install --global windows-build-tools
> ```
> 或透過 Visual Studio Installer 安裝「C++ 桌面開發」工作負載。

### 2. 設定環境變數

```bash
# 複製範本
copy .env.example .env

# 以文字編輯器開啟並填入必要設定
notepad .env
```

**必填項目：**
- `ADMIN_USERNAME` — 管理者登入帳號
- `ADMIN_PASSWORD` — 管理者登入密碼（建議 8 字元以上）
- `JWT_SECRET` — 請改為至少 32 字元的隨機字串

### 3. 初始化資料庫（首次執行必做）

```bash
npm run seed
```

輸出範例：
```
🌱 開始初始化資料庫...
  ✅ 管理者帳號建立完成（帳號：your_admin_username）
  ✅ 科目建立完成：英文單字、Python 程式設計、數位邏輯
  ✅ 英文單字題目建立完成：700 題
  ✅ Python 程式設計題目建立完成：15 題
  ✅ 數位邏輯題目建立完成：14 題
  ✅ 示範考試建立完成：3 場考試
```

### 4. 啟動伺服器

```bash
# 生產模式
npm start

# 開發模式（自動重啟）
npm run dev
```

瀏覽器開啟：**http://localhost:3000**

---

## 👤 帳號說明

帳號在執行 `npm run seed` 時依據 `.env` 設定自動建立：

| 環境變數 | 說明 |
|----------|------|
| `ADMIN_USERNAME` | 管理者帳號（自訂） |
| `ADMIN_PASSWORD` | 管理者密碼（自訂） |

> ⚠️ 密碼以 bcrypt（salt 12）雜湊後儲存於資料庫，`.env` 已列入 `.gitignore`，絕不上傳至版本控制。

---

## ✨ 系統功能

### 管理者功能
- **總覽儀表板**：即時統計學生人數、考試場數、平均分數、最近作答記錄
- **題庫管理**：新增/編輯/停用/刪除選擇題與填充題，支援多科目篩選
- **考試管理**：建立考試、設定開始/截止時間、抽題數量、倒數分鐘數
- **使用者管理**：建立學生帳號、重設密碼、管理身分

### 學生功能
- **考試列表**：查看可參加的考試、開放狀態、截止時間
- **作答介面**：倒數計時器（接近時限有動態警示）、題目小圓點導航
- **交卷確認**：二次確認 Modal，顯示未作答題數
- **成績反饋**：即時分數動畫、詳細題目解析、正確答案對照
- **AI 解惑**：針對每道錯題，AI 分析學習盲點並給出記憶技巧
- **快速練習**：無時間限制的自由練習模式
- **個人設定**：修改顯示名稱、頭像顏色、密碼；查看作答歷史
- **排行榜**：查看本次考試的 Top 20 名次

---

## 🤖 AI 解惑設定

系統使用 [Anthropic Claude API](https://www.anthropic.com) 提供針對性錯題分析。

```env
ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxxxx
ANTHROPIC_MODEL=claude-sonnet-4-6
```

**未設定 API Key 時**：系統自動切換為「模擬 AI 模式」，根據科目特性產生通用分析文字，功能完整可用。

---

## 📊 科目與題庫

| 科目 | 題目數量 | 說明 |
|------|--------|------|
| 英文單字 | 350+ 單字 × 2 = 700 題 | Level 1~7，填充（看中文拼英文）+ 選擇（看英文選中文）|
| Python 程式設計 | 15 題 | 選擇題 + 填充題，涵蓋 Level 1~4 |
| 數位邏輯 | 14 題 | 選擇題 + 填充題，涵蓋 Level 1~3 |

> 管理者可在後台隨時新增/修改/停用任何題目。

---

## 🔒 安全設計

- 管理者密碼以 **bcrypt（salt rounds 12）** 雜湊儲存，前端無任何明文密碼
- 所有 API 使用 **JWT Bearer Token** 驗證
- 管理者操作（新增/刪除）有 **角色守衛（requireAdmin）** 保護
- 考題正確答案僅存於伺服器端，作答時不傳送到前端

---

## 🌐 部署到 GitHub

```bash
# 在專案目錄中初始化 Git
git init
git add .
git commit -m "初始化趣味互動考試系統"

# 建立 GitHub 遠端儲存庫後
git remote add origin https://github.com/你的帳號/考試系統.git
git branch -M main
git push -u origin main
```

### 部署到雲端（Railway / Render / Fly.io）

1. 將 `data/` 目錄掛載為持久儲存（SQLite 資料庫）
2. 設定環境變數（PORT、JWT_SECRET、ANTHROPIC_API_KEY）
3. 設定啟動命令：`npm run seed && npm start`

---

## 🛠 技術棧

| 層次 | 技術 |
|------|------|
| 後端  | Node.js 18+, Express 4, better-sqlite3 |
| 認證  | JSON Web Token (JWT), bcryptjs |
| 前端  | 原生 HTML5 / CSS3 / ES6+ JavaScript (無框架) |
| AI    | Anthropic Claude API（@anthropic-ai/sdk） |
| 資料庫| SQLite 3（透過 better-sqlite3） |
| 字型  | Google Fonts - Noto Sans TC, JetBrains Mono |

---

## 📝 授權

MIT License — 自由使用、修改與分發。
