/**
 * 快速練習模式（無時間限制）
 */
const PracticeModule = {
  selectedSubject: null,
  questions: [],
  answers: {},
  currentIndex: 0,
  submitted: false,
  startTime: 0,
  _keyHandler: null,

  async init() {
    const subjectSel = document.getElementById('practiceSubjectSelect');
    subjectSel.innerHTML = AppState.subjects.map(s =>
      `<button class="subject-btn" data-id="${s.id}" onclick="PracticeModule.selectSubject(${s.id}, this)">
        ${s.icon} ${escapeHtml(s.name)}
      </button>`
    ).join('');

    document.getElementById('practiceSetup').classList.remove('hidden');
    document.getElementById('practiceSession').classList.add('hidden');
  },

  selectSubject(id, btn) {
    this.selectedSubject = id;
    document.querySelectorAll('.subject-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
  },

  async start() {
    if (!this.selectedSubject) {
      Toast.warning('請先選擇科目');
      return;
    }
    const level = document.getElementById('practiceLevelSelect').value;
    const count = parseInt(document.getElementById('practiceCountSelect').value);

    Loading.show('準備練習題目...');
    try {
      const params = { subject_id: this.selectedSubject, limit: 200 };
      if (level !== 'all') params.level = level;
      const data = await API.questions.list(params);

      if (data.questions.length === 0) {
        Toast.warning('此條件下沒有可用題目');
        return;
      }

      // 隨機抽題
      const shuffled = [...data.questions].sort(() => Math.random() - 0.5);
      this.questions = shuffled.slice(0, Math.min(count, shuffled.length)).map(q => ({
        ...q,
        options: q.options ? (typeof q.options === 'string' ? JSON.parse(q.options) : q.options) : null
      }));
      this.answers = {};
      this.currentIndex = 0;
      this.submitted = false;
      this.startTime = Date.now();

      document.getElementById('practiceSetup').classList.add('hidden');
      document.getElementById('practiceSession').classList.remove('hidden');
      this._attachKeyboard();
      this.renderPractice();
    } catch (err) {
      Toast.error('載入題目失敗：' + err.message);
    } finally {
      Loading.hide();
    }
  },

  /* ── 鍵盤快捷鍵 ── */
  _attachKeyboard() {
    this._detachKeyboard();
    this._keyHandler = (e) => {
      if (this.submitted) return;
      // A/B/C/D 快速選答
      const q = this.questions[this.currentIndex];
      if (q && q.type === 'choice' && q.options) {
        const idx = ['a','b','c','d','e'].indexOf(e.key.toLowerCase());
        if (idx >= 0 && idx < q.options.length) {
          this.answers[this.currentIndex] = q.options[idx];
          this.renderPractice();
          return;
        }
      }
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        this.next();
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        this.prev();
      } else if (e.key === 'Enter' && this.currentIndex === this.questions.length - 1) {
        e.preventDefault();
        this.submit();
      }
    };
    document.addEventListener('keydown', this._keyHandler);
  },

  _detachKeyboard() {
    if (this._keyHandler) {
      document.removeEventListener('keydown', this._keyHandler);
      this._keyHandler = null;
    }
  },

  renderPractice() {
    const session = document.getElementById('practiceSession');
    const q = this.questions[this.currentIndex];
    const userAnswer = this.answers[this.currentIndex] || '';
    const isLast = this.currentIndex === this.questions.length - 1;
    const answeredCount = Object.values(this.answers).filter(v => v !== '').length;

    let inputHTML = '';
    if (q.type === 'choice' && q.options) {
      inputHTML = `<div class="options-list">` +
        q.options.map((opt, i) => {
          const label = ['A','B','C','D','E'][i] || String(i+1);
          const sel = userAnswer === opt ? 'selected' : '';
          return `<div class="option-item ${sel}" onclick="PracticeModule.select('${escapeHtml(opt).replace(/'/g,"\\'")}')">
            <div class="option-label">${label}</div>
            <div class="option-text">${escapeHtml(opt)}</div>
          </div>`;
        }).join('') + `</div>`;
    } else {
      inputHTML = `<div class="fill-input-wrapper">
        <input type="text" class="fill-input" id="practiceInput"
          placeholder="請輸入答案" value="${escapeHtml(userAnswer)}"
          oninput="PracticeModule.answers[PracticeModule.currentIndex]=this.value"
          autocomplete="off" spellcheck="false" />
        <div class="fill-hint">不區分大小寫 ｜ 可用 ← → 切換題目</div>
      </div>`;
    }

    session.innerHTML = `
      <div class="practice-header" style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;flex-wrap:wrap;gap:12px">
        <h3 style="font-size:1rem;color:#94A3B8">
          練習模式 — 第 <strong style="color:#F8FAFC">${this.currentIndex+1}</strong>/${this.questions.length} 題
          <span style="margin-left:12px;font-size:0.82rem;color:#64748B">已作答 ${answeredCount} 題</span>
        </h3>
        <button class="btn-secondary-outline" onclick="PracticeModule.resetToSetup()">↩ 重新選擇</button>
      </div>
      <div class="progress-track" style="margin-bottom:20px">
        <div class="progress-fill" style="width:${(this.currentIndex+1)/this.questions.length*100}%"></div>
      </div>
      <div class="question-card">
        <div class="question-number">
          第 ${this.currentIndex+1} 題 <span class="question-level-badge">Lv.${q.level}</span>
          <span style="float:right;font-size:0.78rem;color:#64748B">${q.type === 'choice' ? '選擇題' : '填充題'}</span>
        </div>
        <div class="question-text">${escapeHtml(q.question_text)}</div>
        ${inputHTML}
      </div>
      <!-- 題目快速跳轉 -->
      <div class="question-dots" style="justify-content:center;margin-top:16px">
        ${this.questions.map((_, i) => {
          let cls = 'q-dot';
          if (i === this.currentIndex) cls += ' current';
          else if (this.answers[i] && this.answers[i] !== '') cls += ' answered';
          else cls += ' unanswered';
          return `<div class="${cls}" onclick="PracticeModule.goTo(${i})" title="第${i+1}題"></div>`;
        }).join('')}
      </div>
      <div style="display:flex;gap:12px;margin-top:20px;justify-content:center;flex-wrap:wrap">
        ${this.currentIndex > 0 ? `<button class="btn-prev-q" onclick="PracticeModule.prev()">← 上一題</button>` : ''}
        ${!isLast
          ? `<button class="btn-next-q" onclick="PracticeModule.next()">下一題 →</button>`
          : `<button class="btn-submit-exam" style="clip-path:none;padding:12px 32px" onclick="PracticeModule.submit()">📊 查看結果</button>`
        }
      </div>
    `;

    // 自動聚焦填充輸入框
    if (q.type === 'fill') {
      setTimeout(() => document.getElementById('practiceInput')?.focus(), 50);
    }
  },

  goTo(i) {
    const inp = document.getElementById('practiceInput');
    if (inp) this.answers[this.currentIndex] = inp.value;
    this.currentIndex = i;
    this.renderPractice();
  },

  select(opt) {
    this.answers[this.currentIndex] = opt;
    // 短暫延遲後自動跳下一題（提升流暢感）
    this.renderPractice();
    if (this.currentIndex < this.questions.length - 1) {
      setTimeout(() => this.next(), 300);
    }
  },

  prev() {
    const inp = document.getElementById('practiceInput');
    if (inp) this.answers[this.currentIndex] = inp.value;
    if (this.currentIndex > 0) { this.currentIndex--; this.renderPractice(); }
  },

  next() {
    const inp = document.getElementById('practiceInput');
    if (inp) this.answers[this.currentIndex] = inp.value;
    if (this.currentIndex < this.questions.length - 1) { this.currentIndex++; this.renderPractice(); }
  },

  submit() {
    if (this.submitted) return;
    this.submitted = true;
    this._detachKeyboard();

    const inp = document.getElementById('practiceInput');
    if (inp) this.answers[this.currentIndex] = inp.value;

    // ── 計算成績 ──
    let correct = 0;
    const checks = this.questions.map((q, i) => {
      const userAns = (this.answers[i] || '').trim();
      const isCorrect = q.type === 'fill'
        ? userAns.toLowerCase() === q.correct_answer.trim().toLowerCase()
        : userAns === q.correct_answer.trim();
      if (isCorrect) correct++;
      return { q, i, userAns, isCorrect };
    });

    const score = Math.round(correct / this.questions.length * 100);
    const passed = score >= 60;
    const elapsed = Math.floor((Date.now() - this.startTime) / 1000);

    // ── 預先填入 overlay mini-stats ──
    const miniStats = document.getElementById('resultsMiniStats');
    if (miniStats) {
      miniStats.innerHTML = `
        <div class="result-mini-card">
          <div class="mini-val">${correct}/${this.questions.length}</div>
          <div class="mini-label">答對題數</div>
        </div>
        <div class="result-mini-card">
          <div class="mini-val">${formatDuration(elapsed)}</div>
          <div class="mini-label">練習用時</div>
        </div>
        <div class="result-mini-card">
          <div class="mini-val">${passed ? '🌟' : '💪'}</div>
          <div class="mini-label">${passed ? '表現優秀' : '繼續加油'}</div>
        </div>
      `;
    }

    // ── 定義結果渲染函式（動畫結束後呼叫）──
    const renderResults = () => {
      const session = document.getElementById('practiceSession');
      const color = score >= 90 ? '#10B981' : score >= 60 ? '#3B82F6' : '#EF4444';
      const emoji = score >= 90 ? '🏆' : score >= 60 ? '🎉' : '💪';
      const message = score >= 90 ? '完美！繼續保持！' : score >= 60 ? '通過了！做得很好！' : '再練幾次，一定進步！';

      const detailHTML = checks.map(({ q, userAns, isCorrect }) => `
        <div class="question-result-card ${isCorrect ? 'correct' : 'wrong'}" style="margin-bottom:12px">
          <div class="result-card-header">
            <span class="result-icon">${isCorrect ? '✅' : '❌'}</span>
            <div class="result-q-text">${escapeHtml(q.question_text)}</div>
          </div>
          ${q.options && q.type === 'choice' ? `
            <div style="margin-top:8px;font-size:0.8rem;color:#64748B">
              選項：${q.options.map((o,i) => `${['A','B','C','D'][i]}.${escapeHtml(o)}`).join('、')}
            </div>` : ''}
          <div class="result-answers">
            <div class="result-answer-row">
              <span class="answer-tag tag-correct">正確答案</span>
              <span>${escapeHtml(q.correct_answer)}</span>
            </div>
            <div class="result-answer-row">
              <span class="answer-tag ${isCorrect ? 'tag-correct' : 'tag-user'}">${isCorrect ? '你的答案 ✓' : '你的答案 ✗'}</span>
              <span>${userAns || '<em style="color:#64748B">（未作答）</em>'}</span>
            </div>
          </div>
          ${q.explanation ? `<div class="result-explanation">💡 ${escapeHtml(q.explanation)}</div>` : ''}
          ${!isCorrect ? `
            <button class="btn-ai-explain" id="pAiBtn_${q.id}"
              onclick="PracticeModule.requestAI('${escapeHtml(q.question_text).replace(/'/g,"\\'")}','${escapeHtml(q.correct_answer).replace(/'/g,"\\'")}','${escapeHtml(userAns).replace(/'/g,"\\'")}',${q.id})">
              🤖 AI 家教幫我分析這題
            </button>
            <div id="pAiResp_${q.id}" class="hidden"></div>
          ` : ''}
        </div>
      `).join('');

      session.innerHTML = `
        <div style="text-align:center;padding:40px 0 28px">
          <div style="font-size:3.5rem;margin-bottom:8px">${emoji}</div>
          <div style="font-size:3rem;font-weight:900;color:${color};line-height:1">${score}</div>
          <div style="font-size:1.1rem;color:${color};font-weight:600;margin-top:4px">分</div>
          <div style="color:#94A3B8;margin-top:12px;font-size:0.95rem">${message}</div>
          <div style="color:#64748B;margin-top:6px;font-size:0.85rem">
            答對 <strong style="color:#10B981">${correct}</strong>/${this.questions.length} 題 ｜ 用時 ${formatDuration(elapsed)}
          </div>
        </div>
        <div style="display:flex;gap:12px;justify-content:center;margin-bottom:32px;flex-wrap:wrap">
          <button class="btn-start-practice" style="padding:12px 28px" onclick="PracticeModule.restart()">🔄 再練一次</button>
          <button class="btn-secondary-outline" onclick="App.navigate('exams')">🏠 返回考試列表</button>
        </div>
        <h3 style="margin-bottom:16px;font-size:1rem;font-weight:700">📝 題目解析</h3>
        ${detailHTML}
      `;
    };

    // ── 觸發 12 秒成績動畫 ──
    if (typeof ResultsAnimation !== 'undefined') {
      ResultsAnimation.show(score, passed, renderResults);
    } else {
      renderResults();
    }
  },

  restart() {
    this.submitted = false;
    this.answers = {};
    this.currentIndex = 0;
    this.startTime = Date.now();
    // 重新洗牌同樣題目
    this.questions = [...this.questions].sort(() => Math.random() - 0.5);
    this._attachKeyboard();
    this.renderPractice();
  },

  resetToSetup() {
    this._detachKeyboard();
    this.submitted = false;
    document.getElementById('practiceSetup').classList.remove('hidden');
    document.getElementById('practiceSession').classList.add('hidden');
    document.querySelectorAll('.subject-btn').forEach(b => b.classList.remove('selected'));
    this.selectedSubject = null;
  },

  /* ── AI 家教（練習模式）── */
  async requestAI(questionText, correctAnswer, userAnswer, qId) {
    const btn = document.getElementById(`pAiBtn_${qId}`);
    const box = document.getElementById(`pAiResp_${qId}`);
    if (!btn || !box) return;

    btn.disabled = true;
    btn.textContent = '🤖 AI 思考中...';
    btn.style.opacity = '0.6';

    try {
      const subject = AppState.subjects.find(s => s.id === this.selectedSubject);
      const data = await API.ai.explain({
        question_text:  questionText,
        correct_answer: correctAnswer,
        user_answer:    userAnswer,
        subject_name:   subject?.name || ''
      });

      box.classList.remove('hidden');
      box.innerHTML = `
        <div class="ai-response-box">
          <div class="ai-response-content">${renderMarkdown(data.response)}</div>
          ${data.is_fallback ? `<div class="ai-fallback-notice">⚠️ 目前使用模擬 AI 模式。設定 NVIDIA_API_KEY 可獲得個人化分析。</div>` : ''}
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
  }
};
