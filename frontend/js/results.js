/**
 * 成績結果頁模組
 */
const ResultsModule = {
  async show(result, questions, subjectName) {
    App.navigate('results');
    const container = document.getElementById('resultsContainer');

    const { score, correct_count, total_questions, time_spent_seconds, passed, results } = result;
    const scoreColor = score >= 90 ? '#10B981' : score >= 60 ? '#3B82F6' : '#EF4444';
    const emoji = score >= 90 ? '🏆' : score >= 60 ? '👏' : '💪';
    const titleMsg = score >= 90 ? '太厲害了！滿分達人！' : score >= 60 ? '恭喜通過！繼續加油！' : '繼續努力，下次會更好！';

    // 計算圓環進度
    const circumference = 2 * Math.PI * 52;
    const strokeDashoffset = circumference * (1 - score / 100);

    container.innerHTML = `
      <div class="results-hero">
        <div class="score-display">
          <svg class="score-ring" viewBox="0 0 120 120">
            <circle fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="8" cx="60" cy="60" r="52"/>
            <circle fill="none" stroke="${scoreColor}" stroke-width="8" cx="60" cy="60" r="52"
              stroke-linecap="round"
              stroke-dasharray="${circumference}"
              stroke-dashoffset="${strokeDashoffset}"
              transform="rotate(-90 60 60)"
              style="transition: stroke-dashoffset 1.5s cubic-bezier(0.4,0,0.2,1);"
            />
          </svg>
          <div>
            <div class="score-number" style="color:${scoreColor}" id="animatedScore">0</div>
            <div class="score-unit">分</div>
          </div>
        </div>
        <div class="results-title">${emoji} ${titleMsg}</div>
        <div class="results-meta">
          作答時間：${formatDuration(time_spent_seconds)} ｜ 答對 ${correct_count}/${total_questions} 題
        </div>
        <div class="pass-badge ${passed ? 'passed' : 'failed'}">
          ${passed ? '✅ 通過' : '❌ 未通過（需要 60 分）'}
        </div>
      </div>

      <div class="results-stats">
        <div class="result-stat-card">
          <div class="result-stat-value" style="color:${scoreColor}">${score}</div>
          <div class="result-stat-label">總得分</div>
        </div>
        <div class="result-stat-card">
          <div class="result-stat-value" style="color:#10B981">${correct_count}</div>
          <div class="result-stat-label">答對題數</div>
        </div>
        <div class="result-stat-card">
          <div class="result-stat-value" style="color:#F59E0B">${total_questions - correct_count}</div>
          <div class="result-stat-label">答錯題數</div>
        </div>
      </div>

      <div class="results-actions">
        <button class="btn-retry" onclick="ExamModule.startExam(${ExamModule.examInfo ? 'null' : 'null'}); App.navigate('exams')">📋 返回考試列表</button>
        <button class="btn-back-list" onclick="App.navigate('exams')">🏠 回首頁</button>
        ${result.attempt_id ? `<button class="btn-retry" style="background:linear-gradient(135deg,#1E3A5F,#2563EB)" onclick="ResultsModule.showLeaderboard()">🏆 查看排行榜</button>` : ''}
      </div>

      <div id="leaderboardSection" class="hidden" style="margin-bottom:28px"></div>

      <h3 style="margin-bottom:16px;font-size:1.1rem;font-weight:700">📝 詳細題目解析</h3>
      <div class="question-results" id="questionResultsList">
        ${results.map((r, i) => this.renderQuestionResult(r, i, subjectName)).join('')}
      </div>
    `;

    // 分數動畫
    this.animateScore(0, score, 1200);

    // 通過時撒彩帶
    if (passed && typeof launchConfetti === 'function') {
      setTimeout(() => launchConfetti(score >= 90 ? 4000 : 2800), 600);
    }
  },

  animateScore(from, to, duration) {
    const el = document.getElementById('animatedScore');
    if (!el) return;
    const start = performance.now();
    const update = (now) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      el.textContent = Math.round(from + (to - from) * eased);
      if (progress < 1) requestAnimationFrame(update);
    };
    requestAnimationFrame(update);
  },

  renderQuestionResult(r, index, subjectName) {
    const isCorrect = r.is_correct;
    const icon = isCorrect ? '✅' : '❌';

    const optionsPreview = r.options && Array.isArray(r.options)
      ? `<div style="margin-top:8px;font-size:0.8rem;color:#64748B">選項：${r.options.map((o,i)=>`${['A','B','C','D'][i]}.${escapeHtml(o)}`).join('、')}</div>` : '';

    return `
      <div class="question-result-card ${isCorrect ? 'correct' : 'wrong'}" id="resultCard_${index}">
        <div class="result-card-header">
          <span class="result-icon">${icon}</span>
          <div class="result-q-text">${escapeHtml(r.question_text)}</div>
          <span class="result-q-number">#${index + 1}</span>
        </div>
        ${optionsPreview}
        <div class="result-answers">
          <div class="result-answer-row">
            <span class="answer-tag tag-correct">正確答案</span>
            <span>${escapeHtml(r.correct_answer)}</span>
          </div>
          <div class="result-answer-row">
            <span class="answer-tag ${isCorrect ? 'tag-correct' : 'tag-user'}">${isCorrect ? '你的答案 ✓' : '你的答案 ✗'}</span>
            <span>${r.user_answer ? escapeHtml(r.user_answer) : '<em style="color:#64748B">（未作答）</em>'}</span>
          </div>
        </div>
        ${r.explanation ? `<div class="result-explanation">💡 <strong>說明：</strong>${escapeHtml(r.explanation)}</div>` : ''}
        ${!isCorrect ? `
          <button class="btn-ai-explain" id="aiBtn_${index}"
            onclick="ResultsModule.requestAI(${index}, this)">
            🤖 AI 家教幫我分析這題
          </button>
          <div id="aiResponse_${index}" class="hidden"></div>
        ` : ''}
      </div>
    `;
  },

  async requestAI(index, btn) {
    const resultsContainer = document.getElementById('questionResultsList');
    const cards = resultsContainer.querySelectorAll('.question-result-card');
    const card = document.getElementById(`resultCard_${index}`);
    if (!card) return;

    // 取出題目資訊（從 DOM 讀取已渲染內容）
    const questionText = card.querySelector('.result-q-text')?.textContent || '';
    const answerRows = card.querySelectorAll('.result-answer-row');
    const correctAnswer = answerRows[0]?.querySelector('span:last-child')?.textContent || '';
    const userAnswer = answerRows[1]?.querySelector('span:last-child')?.textContent || '';

    const responseBox = document.getElementById(`aiResponse_${index}`);
    btn.disabled = true;
    btn.textContent = '🤖 AI 思考中...';
    btn.style.opacity = '0.6';

    try {
      const data = await API.ai.explain({
        question_text: questionText,
        correct_answer: correctAnswer,
        user_answer: userAnswer,
        subject_name: ExamModule.subjectName || ''
      });

      responseBox.classList.remove('hidden');
      responseBox.innerHTML = `
        <div class="ai-response-box">
          <div class="ai-response-content">${renderMarkdown(data.response)}</div>
          ${data.is_fallback ? `<div class="ai-fallback-notice">⚠️ 目前使用模擬 AI 模式。設定 ANTHROPIC_API_KEY 可獲得更精準的個人化分析。</div>` : ''}
        </div>
      `;

      btn.textContent = '✅ AI 分析完成';
      btn.style.background = 'linear-gradient(135deg, #065F46, #047857)';
    } catch (err) {
      btn.disabled = false;
      btn.textContent = '🤖 AI 家教幫我分析這題';
      btn.style.opacity = '';
      Toast.error('AI 請求失敗：' + err.message);
    }
  },

  async showLeaderboard() {
    const section = document.getElementById('leaderboardSection');
    section.classList.remove('hidden');
    section.innerHTML = '<div class="loading-spinner" style="width:28px;height:28px;margin:16px auto"></div>';

    try {
      // 從當前考試 ID（透過 ExamModule 的 attemptId 我們不能直接得到 examId）
      // 排行榜透過 attempt 的 exam_id 取得
      // 這邊從 URL 或透過 API 用 attemptId 拿
      const examId = ExamModule._lastExamId;
      if (!examId) { section.innerHTML = ''; return; }

      const board = await API.exams.leaderboard(examId);
      if (board.length === 0) {
        section.innerHTML = '<div class="empty-state"><p>目前還沒有排行榜資料</p></div>';
        return;
      }

      const medals = ['🥇','🥈','🥉'];
      section.innerHTML = `
        <div class="leaderboard">
          <div class="leaderboard-header">🏆 本次考試排行榜 TOP 20</div>
          ${board.map((row, i) => `
            <div class="leaderboard-row ${row.is_me ? 'is-me' : ''}">
              <div class="lb-rank lb-rank-${i+1}">${medals[i] || (i+1)}</div>
              <div class="lb-name">${escapeHtml(row.display_name)} ${row.is_me ? '（你）' : ''}</div>
              <div class="lb-score">${row.score} 分</div>
              <div class="lb-time">${formatDuration(row.time_spent_seconds)}</div>
            </div>
          `).join('')}
        </div>
      `;
    } catch (err) {
      section.innerHTML = '';
    }
  }
};

// 在 startExam 時記錄 examId
const _origStart = ExamModule.startExam.bind(ExamModule);
ExamModule.startExam = async function(examId) {
  ExamModule._lastExamId = examId;
  return _origStart(examId);
};
