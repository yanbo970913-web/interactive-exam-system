/**
 * AI 解題路由 — 使用 NVIDIA API (google/gemma-2-2b-it)
 * 設定方式：在 Railway 環境變數中加入 NVIDIA_API_KEY
 */
const express = require('express');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

const NVIDIA_BASE_URL = 'https://integrate.api.nvidia.com/v1';
const NVIDIA_MODEL    = process.env.NVIDIA_MODEL || 'google/gemma-2-2b-it';

/* ── NVIDIA API 呼叫（OpenAI 相容格式）─────────────── */
async function callNvidiaAI(messages, maxTokens = 1024) {
  const apiKey = process.env.NVIDIA_API_KEY;
  if (!apiKey) throw new Error('NVIDIA_API_KEY 未設定');

  const res = await fetch(`${NVIDIA_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model:       NVIDIA_MODEL,
      messages,
      temperature: 0.3,
      top_p:       0.7,
      max_tokens:  maxTokens,
      stream:      false
    })
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`NVIDIA API 錯誤 ${res.status}: ${txt.slice(0, 200)}`);
  }

  const json = await res.json();
  return json.choices?.[0]?.message?.content || '';
}

/* ── Fallback（API 未設定時）────────────────────────── */
function generateFallbackResponse(questionText, correctAnswer, userAnswer, subjectName) {
  const isVocab   = subjectName?.includes('英文');
  const isPython  = subjectName?.includes('Python');
  const isDigital = subjectName?.includes('數位');

  let r = `## 🎓 學習分析\n\n`;
  r += `**你的答案：** ${userAnswer || '（未作答）'}\n`;
  r += `**正確答案：** ${correctAnswer}\n\n`;

  if (!userAnswer?.trim()) {
    r += `### ⚠️ 你沒有作答這題\n即使不確定，也請勇敢嘗試——猜對永遠比留白好！\n\n`;
  } else if (isVocab) {
    r += `### 🔍 拼字分析\n你寫了「${userAnswer}」，正確是「${correctAnswer}」。\n\n`;
    r += `### 💡 記憶技巧\n1. **拆字記憶**：把單字拆成音節來記\n2. **造句練習**：把單字放入句子中反覆使用\n3. **重複複習**：按遺忘曲線：1天、3天、7天後複習\n\n`;
  } else if (isPython) {
    r += `### 🔍 概念分析\n你對這個 Python 語法的理解需要加強。\n\n`;
    r += `### 💡 學習建議\n1. 打開 Python 直接執行這段程式碼\n2. 閱讀 docs.python.org 官方文件\n3. 理解原理，不要死記硬背\n\n`;
  } else if (isDigital) {
    r += `### 🔍 邏輯分析\n你對這個數位邏輯概念需要複習。\n\n`;
    r += `### 💡 學習建議\n1. 親手畫出真值表\n2. 反覆練習進制轉換\n3. 用 Logisim 模擬器實際設計電路\n\n`;
  } else {
    r += `### 🔍 分析\n你對這個概念的理解有偏差，建議重新複習相關材料。\n\n`;
  }

  r += `### ✅ 正確觀念\n正確答案是 **「${correctAnswer}」**，請牢記這個答案！\n\n`;
  r += `\n> 💡 在 Railway 環境變數設定 **NVIDIA_API_KEY** 可獲得 AI 個人化分析`;
  return r;
}

/* ── POST /api/ai/explain ────────────────────────── */
router.post('/explain', requireAuth, async (req, res) => {
  const { question_text, correct_answer, user_answer, subject_name, explanation } = req.body;

  if (!question_text || !correct_answer)
    return res.status(400).json({ error: '缺少必要的題目資訊' });

  if (!process.env.NVIDIA_API_KEY) {
    const fb = generateFallbackResponse(question_text, correct_answer, user_answer, subject_name);
    return res.json({ response: fb, is_fallback: true });
  }

  try {
    const prompt = `你是一位耐心的繁體中文家教老師。請分析以下錯題並給出學習建議。

科目：${subject_name || '未指定'}
題目：${question_text}
正確答案：${correct_answer}
學生答案：${user_answer || '（未作答）'}
${explanation ? `說明：${explanation}` : ''}

請用繁體中文回答，格式：
1. 錯誤分析（學生為何答錯）
2. 正確觀念說明
3. 記憶技巧或學習建議

回答請控制在 200 字以內，精簡有力。`;

    const content = await callNvidiaAI([{ role: 'user', content: prompt }], 512);
    res.json({ response: content, is_fallback: false });

  } catch (err) {
    console.error('NVIDIA AI 錯誤:', err.message);
    const fb = generateFallbackResponse(question_text, correct_answer, user_answer, subject_name);
    res.json({ response: fb, is_fallback: true, error: err.message });
  }
});

/* ── POST /api/ai/quick-hint ─────────────────────── */
router.post('/quick-hint', requireAuth, async (req, res) => {
  const { question_text, subject_name } = req.body;
  if (!question_text) return res.status(400).json({ error: '缺少題目資訊' });

  if (!process.env.NVIDIA_API_KEY) {
    return res.json({ response: '💡 提示：仔細思考題目的關鍵字，回想相關概念。', is_fallback: true });
  }

  try {
    const prompt = `請用繁體中文為以下題目提供一個提示（不要直接給答案，最多 40 字）：\n${question_text}`;
    const content = await callNvidiaAI([{ role: 'user', content: prompt }], 100);
    res.json({ response: `💡 ${content.trim()}`, is_fallback: false });
  } catch (err) {
    res.json({ response: '💡 提示：仔細閱讀題目，找出關鍵字。', is_fallback: true });
  }
});

module.exports = router;
