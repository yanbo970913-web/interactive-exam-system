const express = require('express');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// 模擬 AI 回覆邏輯（當 API Key 未設定時使用）
function generateFallbackResponse(questionText, correctAnswer, userAnswer, subjectName) {
  const isVocab = subjectName && subjectName.includes('英文');
  const isPython = subjectName && subjectName.includes('Python');
  const isDigital = subjectName && subjectName.includes('數位');

  let response = `## 🎓 家教老師的分析\n\n`;
  response += `### 📌 你的錯誤在哪裡？\n\n`;
  response += `你的答案：**「${userAnswer || '（未作答）'}」**\n`;
  response += `正確答案：**「${correctAnswer}」**\n\n`;

  if (!userAnswer || userAnswer.trim() === '') {
    response += `你這題**沒有作答**。這通常有兩個原因：\n`;
    response += `1. 時間不夠，來不及思考\n`;
    response += `2. 對這個概念完全沒有印象\n\n`;
    response += `**建議：** 即使不確定答案，也要嘗試填答——猜對的機會永遠大於留白！\n\n`;
  } else if (isVocab) {
    const wordMatch = questionText.match(/「(.+?)」/);
    const word = wordMatch ? wordMatch[1] : correctAnswer;
    response += `### 🔍 學習盲點分析\n\n`;
    response += `你把「${correctAnswer}」寫成了「${userAnswer}」。\n\n`;
    response += `常見的拼字錯誤類型：\n`;
    response += `- **字母順序記錯**：容易把中間的字母弄混\n`;
    response += `- **相似單字干擾**：可能和其他長相相似的單字搞混了\n`;
    response += `- **發音與拼法不一致**：英文發音有時和拼法不同\n\n`;
    response += `### 💡 記憶技巧\n\n`;
    response += `1. **字根分析法**：把單字拆解成更小的部分來記憶\n`;
    response += `2. **例句記憶法**：把單字放入句子中，有情境更好記\n`;
    response += `3. **聯想記憶法**：用中文的音或義來聯想\n`;
    response += `4. **反覆複習**：根據遺忘曲線，在 1天、3天、7天後複習\n\n`;
  } else if (isPython) {
    response += `### 🔍 學習盲點分析\n\n`;
    response += `你對這個 Python 概念的理解有些偏差。\n\n`;
    response += `你答了「${userAnswer}」，這說明你可能：\n`;
    response += `- 混淆了相似的語法結構\n`;
    response += `- 對 Python 的執行順序有誤解\n`;
    response += `- 沒有實際動手測試過這段程式碼\n\n`;
    response += `### 💡 學習建議\n\n`;
    response += `1. **動手實作**：打開 Python IDLE 或 Jupyter Notebook，親自執行這段程式碼\n`;
    response += `2. **理解原理**：不要只背答案，要理解 Python 為什麼這樣運作\n`;
    response += `3. **查閱官方文件**：Python 官方文件 docs.python.org 是最佳參考資源\n\n`;
  } else if (isDigital) {
    response += `### 🔍 學習盲點分析\n\n`;
    response += `你對這個數位邏輯概念還需要加強。\n\n`;
    response += `你答了「${userAnswer}」，這說明你可能：\n`;
    response += `- 沒有熟記真值表\n`;
    response += `- 對進制轉換步驟不熟悉\n`;
    response += `- 混淆了不同邏輯閘的功能\n\n`;
    response += `### 💡 學習建議\n\n`;
    response += `1. **畫出真值表**：親手畫出各個邏輯閘的完整真值表\n`;
    response += `2. **練習進制轉換**：反覆練習二進位、十六進位與十進位的互相轉換\n`;
    response += `3. **動手設計電路**：用邏輯模擬器（如 Logisim）實際設計電路\n\n`;
  } else {
    response += `### 🔍 學習盲點分析\n\n`;
    response += `你答了「${userAnswer}」，正確答案是「${correctAnswer}」。\n\n`;
    response += `這個錯誤表示你對這個概念還需要加強複習。\n\n`;
    response += `### 💡 學習建議\n\n`;
    response += `1. 重新閱讀相關的學習材料\n`;
    response += `2. 嘗試用自己的話解釋這個概念\n`;
    response += `3. 找類似的練習題反覆練習\n\n`;
  }

  response += `### ✅ 正確觀念總結\n\n`;
  response += `正確答案是 **「${correctAnswer}」**。\n`;
  response += `請把這個答案記在腦海中，下次遇到類似題目時，你一定能答對！\n\n`;
  response += `*（提示：設定 ANTHROPIC_API_KEY 可獲得更精準的 AI 分析）*`;

  return response;
}

// POST /api/ai/explain — 請求 AI 解析錯題
router.post('/explain', requireAuth, async (req, res) => {
  const { question_text, correct_answer, user_answer, subject_name, explanation } = req.body;

  if (!question_text || !correct_answer) {
    return res.status(400).json({ error: '缺少必要的題目資訊' });
  }

  // 未設定 API Key → 使用 fallback
  if (!process.env.ANTHROPIC_API_KEY) {
    const fallback = generateFallbackResponse(question_text, correct_answer, user_answer, subject_name);
    return res.json({ response: fallback, is_fallback: true });
  }

  try {
    const Anthropic = require('@anthropic-ai/sdk');
    const client = new Anthropic.default({ apiKey: process.env.ANTHROPIC_API_KEY });

    const systemPrompt = `你是一位嚴謹且有耐心的家教老師，專門幫助學生分析錯題並找出學習盲點。

你的職責：
1. **精準分析**：找出學生為什麼會寫出那個錯誤答案——是概念誤解、粗心大意、還是記憶模糊？
2. **針對性解說**：不要泛泛而談，要針對學生的「具體錯誤」進行分析
3. **正確觀念**：清楚解釋正確答案背後的邏輯與概念
4. **記憶技巧**：提供實用的記憶方法，確保學生不會再犯第二次錯

回覆格式要求：
- 使用繁體中文
- 使用 Markdown 格式（# ## ### 標題、**粗體**、列表）
- 結構要清晰：盲點分析 → 正確觀念 → 記憶技巧
- 語氣：嚴謹但有耐心，像一位好老師對學生說話
- 長度：200~400 字，不要過長也不要過短`;

    const userMessage = `請幫我分析以下錯題：

**科目**：${subject_name || '未指定'}

**題目**：
${question_text}

**正確答案**：${correct_answer}

**學生的錯誤答案**：${user_answer || '（未作答）'}

${explanation ? `**題目說明**：${explanation}` : ''}

請分析這個學生為什麼會寫出這個錯誤答案，找出他的學習盲點，並解釋正確概念，確保他下次不會再犯同樣的錯誤。`;

    const message = await client.messages.create({
      model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }]
    });

    const aiResponse = message.content[0].text;
    res.json({ response: aiResponse, is_fallback: false });

  } catch (err) {
    console.error('AI API 錯誤:', err.message);
    // API 呼叫失敗時 fallback
    const fallback = generateFallbackResponse(question_text, correct_answer, user_answer, subject_name);
    res.json({ response: fallback, is_fallback: true, error: err.message });
  }
});

// POST /api/ai/quick-hint — 快速提示（練習模式）
router.post('/quick-hint', requireAuth, async (req, res) => {
  const { question_text, subject_name } = req.body;
  if (!question_text) return res.status(400).json({ error: '缺少題目資訊' });

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.json({
      response: '💡 提示：仔細思考題目中的關鍵字，回想相關的概念或規則。（設定 API Key 可獲得更詳細的提示）',
      is_fallback: true
    });
  }

  try {
    const Anthropic = require('@anthropic-ai/sdk');
    const client = new Anthropic.default({ apiKey: process.env.ANTHROPIC_API_KEY });

    const message = await client.messages.create({
      model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6',
      max_tokens: 200,
      messages: [{
        role: 'user',
        content: `請為以下題目提供一個提示（不要直接給出答案，用繁體中文回答，不超過 50 字）：\n\n${question_text}`
      }]
    });

    res.json({ response: message.content[0].text, is_fallback: false });
  } catch (err) {
    res.json({ response: '💡 提示：仔細閱讀題目，找出關鍵概念。', is_fallback: true });
  }
});

module.exports = router;
