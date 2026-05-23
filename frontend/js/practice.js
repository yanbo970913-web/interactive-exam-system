/**
 * 快速練習模式（無時間限制）
 */
const PracticeModule = {
  selectedSubject: null,
  questions: [],
  answers: {},
  currentIndex: 0,
  submitted: false,

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

      document.getElementById('practiceSetup').classList.add('hidden');
      document.getElementById('practiceSession').classList.remove('hidden');
      this.renderPractice();
    } catch (err) {
      Toast.error('載入題目失敗：' + err.message);
    } finally {
      Loading.hide();
    }
  },

  renderPractice() {
    const session = document.getElementById('practiceSession');
    const q = this.questions[this.currentIndex];
    const userAnswer = this.answers[this.currentIndex] || '';
    const isLast = this.currentIndex === this.questions.length - 1;

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
          autocomplete="off" />
        <div class="fill-hint">不區分大小寫</div>
      </div>`;
    }

    session.innerHTML = `
      <div class="practice-header" style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;flex-wrap:wrap;gap:12px">
        <h3 style="font-size:1rem;color:#94A3B8">練習模式 — 第 ${this.currentIndex+1}/${this.questions.length} 題</h3>
        <button class="btn-secondary-outline" onclick="PracticeModule.resetToSetup()">↩ 重新選擇</button>
      </div>
      <div class="progress-track" style="margin-bottom:20px">
        <div class="progress-fill" style="width:${(this.currentIndex+1)/this.questions.length*100}%"></div>
      </div>
      <div class="question-card">
        <div class="question-number">
          第 ${this.currentIndex+1} 題 <span class="question-level-badge">Lv.${q.level}</span>
        </div>
        <div class="question-text">${escapeHtml(q.question_text)}</div>
        ${inputHTML}
      </div>
      <div style="display:flex;gap:12px;margin-top:20px;justify-content:center;flex-wrap:wrap">
        ${this.currentIndex > 0 ? `<button class="btn-prev-q" onclick="PracticeModule.prev()">← 上一題</button>` : ''}
        ${!isLast
          ? `<button class="btn-next-q" onclick="PracticeModule.next()">下一題 →</button>`
          : `<button class="btn-submit-exam" style="clip-path:none;padding:12px 32px" onclick="PracticeModule.submit()">📊 查看結果</button>`
        }
      </div>
    `;
  },

  select(opt) {
    this.answers[this.currentIndex] = opt;
    this.renderPractice();
  },

  prev() {
    if (this.currentIndex > 0) { this.currentIndex--; this.renderPractice(); }
  },

  next() {
    // 自動抓取 fill input
    const inp = document.getElementById('practiceInput');
    if (inp) this.answers[this.currentIndex] = inp.value;
    if (this.currentIndex < this.questions.length - 1) { this.currentIndex++; this.renderPractice(); }
  },

  submit() {
    const inp = document.getElementById('practiceInput');
    if (inp) this.answers[this.currentIndex] = inp.value;

    let correct = 0;
    const session = document.getElementById('practiceSession');
    const detailHTML = this.questions.map((q, i) => {
      const userAns = (this.answers[i] || '').trim();
      const isCorrect = q.type === 'fill'
        ? userAns.toLowerCase() === q.correct_answer.trim().toLowerCase()
        : userAns === q.correct_answer.trim();
      if (isCorrect) correct++;
      return `
        <div class="question-result-card ${isCorrect ? 'correct' : 'wrong'}" style="margin-bottom:12px">
          <div class="result-card-header">
            <span class="result-icon">${isCorrect ? '✅' : '❌'}</span>
            <div class="result-q-text">${escapeHtml(q.question_text)}</div>
          </div>
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
        </div>
      `;
    }).join('');

    const score = Math.round(correct / this.questions.length * 100);
    const color = score >= 60 ? '#10B981' : '#EF4444';

    session.innerHTML = `
      <div style="text-align:center;padding:32px 0 24px">
        <div style="font-size:3rem;font-weight:900;color:${color}">${score} 分</div>
        <div style="color:#94A3B8;margin-top:8px">答對 ${correct}/${this.questions.length} 題</div>
      </div>
      <div style="display:flex;gap:12px;justify-content:center;margin-bottom:28px;flex-wrap:wrap">
        <button class="btn-start-practice" style="padding:12px 28px" onclick="PracticeModule.resetToSetup()">🔄 再練一次</button>
        <button class="btn-secondary-outline" onclick="App.navigate('exams')">🏠 返回考試列表</button>
      </div>
      <h3 style="margin-bottom:16px;font-size:1rem;font-weight:700">📝 題目解析</h3>
      ${detailHTML}
    `;
  },

  resetToSetup() {
    document.getElementById('practiceSetup').classList.remove('hidden');
    document.getElementById('practiceSession').classList.add('hidden');
    // 清除選中狀態
    document.querySelectorAll('.subject-btn').forEach(b => b.classList.remove('selected'));
    this.selectedSubject = null;
  }
};
