/**
 * 考試列表 + 考試進行中模組
 */

// ─── 考試列表 ─────────────────────────────────────────
const ExamsListModule = {
  async load() {
    const grid = document.getElementById('examGrid');
    const statsBar = document.getElementById('studentStatsBar');
    grid.innerHTML = '<div class="empty-state"><div class="loading-spinner" style="width:32px;height:32px"></div></div>';

    try {
      const exams = await API.exams.list();

      // 統計列
      const done = exams.filter(e => e.my_attempt_count > 0).length;
      const avgScore = exams.filter(e => e.my_best_score).length
        ? Math.round(exams.filter(e => e.my_best_score).reduce((s, e) => s + e.my_best_score, 0) / exams.filter(e => e.my_best_score).length)
        : 0;
      statsBar.innerHTML = `
        <div class="stat-card"><span class="stat-icon">📋</span><div><div class="stat-label">可參加考試</div><div class="stat-value">${exams.length}</div></div></div>
        <div class="stat-card"><span class="stat-icon">✅</span><div><div class="stat-label">已完成</div><div class="stat-value">${done}</div></div></div>
        <div class="stat-card"><span class="stat-icon">🏆</span><div><div class="stat-label">平均分數</div><div class="stat-value">${avgScore > 0 ? avgScore + '分' : '—'}</div></div></div>
      `;

      if (exams.length === 0) {
        grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><div class="empty-state-icon">📭</div><h3>目前沒有可參加的考試</h3><p>請等待管理員建立考試</p></div>`;
        return;
      }

      grid.innerHTML = exams.map(exam => this.renderCard(exam)).join('');
    } catch (err) {
      grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><div class="empty-state-icon">❌</div><h3>載入失敗</h3><p>${escapeHtml(err.message)}</p></div>`;
    }
  },

  renderCard(exam) {
    const now = new Date();
    const start = exam.start_time ? new Date(exam.start_time) : null;
    const end   = exam.end_time   ? new Date(exam.end_time)   : null;
    let status = 'open', statusLabel = '開放中';
    if (start && start > now)    { status = 'upcoming'; statusLabel = '尚未開始'; }
    else if (end && end < now)   { status = 'closed';   statusLabel = '已截止'; }
    else if (exam.my_attempt_count > 0) { status = 'done'; statusLabel = '已作答'; }

    const canStart = status === 'open' || status === 'done';
    const levelText = exam.level_filter === 'all' ? '全等級' : `Level ${exam.level_filter}`;

    return `
      <div class="exam-card" onclick="${canStart ? `ExamModule.startExam(${exam.id})` : 'void(0)'}">
        <div class="exam-card-header">
          <span class="exam-card-icon">${exam.subject_icon || '📚'}</span>
          <span class="exam-card-status status-${status}">${statusLabel}</span>
        </div>
        <div>
          <div class="exam-card-title">${escapeHtml(exam.title)}</div>
          ${exam.description ? `<div class="exam-card-desc">${escapeHtml(exam.description)}</div>` : ''}
        </div>
        <div class="exam-card-meta">
          <span class="meta-tag">📚 ${escapeHtml(exam.subject_name)}</span>
          <span class="meta-tag">⏱ ${exam.duration_minutes} 分鐘</span>
          <span class="meta-tag">📝 ${exam.question_count} 題</span>
          <span class="meta-tag">🎯 ${levelText}</span>
        </div>
        ${exam.start_time ? `<div class="meta-tag" style="font-size:0.72rem">📅 ${formatDate(exam.start_time)} ~ ${formatDate(exam.end_time)}</div>` : ''}
        ${exam.my_best_score != null ? `<div class="exam-card-score">🏆 最高分：${exam.my_best_score} 分</div>` : ''}
        <button class="btn-start-exam" ${!canStart ? 'disabled' : ''}>
          ${status === 'done' ? '🔄 重新參加' : '▶ 開始作答'}
        </button>
      </div>
    `;
  }
};

// ─── 考試進行中 ──────────────────────────────────────
const ExamModule = {
  attemptId: null,
  examInfo: null,
  questions: [],
  answers: {},
  currentIndex: 0,
  timerInterval: null,
  remainingSeconds: 0,
  subjectName: '',

  async startExam(examId) {
    Loading.show('準備考題中...');
    try {
      const data = await API.exams.start(examId);
      this.attemptId = data.attempt_id;
      this.examInfo = data.exam;
      this.questions = data.questions;
      this.answers = {};
      this.currentIndex = 0;
      this.remainingSeconds = data.remaining_seconds;
      this.subjectName = data.exam.subject_name || '';

      document.getElementById('examTitle').textContent = data.exam.title;
      document.getElementById('examSubject').textContent = data.exam.subject_name;

      this.render();
      this.startTimer();
      App.navigate('exam-taking');
    } catch (err) {
      Toast.error(err.message || '無法開始考試');
    } finally {
      Loading.hide();
    }
  },

  render() {
    this.renderQuestion();
    this.updateProgress();
    this.updateDots();
  },

  renderQuestion() {
    const q = this.questions[this.currentIndex];
    if (!q) return;
    const container = document.getElementById('questionContainer');
    const userAnswer = this.answers[q.id] || '';

    let inputHTML = '';
    if (q.type === 'choice') {
      const opts = Array.isArray(q.options) ? q.options : [];
      inputHTML = `<div class="options-list">` +
        opts.map((opt, i) => {
          const label = ['A','B','C','D','E'][i] || String(i+1);
          const selected = userAnswer === opt ? 'selected' : '';
          return `<div class="option-item ${selected}" onclick="ExamModule.selectOption(${q.id}, '${escapeHtml(opt).replace(/'/g, "\\'")}')" data-opt="${escapeHtml(opt)}">
            <div class="option-label">${label}</div>
            <div class="option-text">${escapeHtml(opt)}</div>
          </div>`;
        }).join('') + `</div>`;
    } else {
      inputHTML = `<div class="fill-input-wrapper">
        <input type="text" class="fill-input" id="fillInput_${q.id}"
          placeholder="請在此輸入答案" value="${escapeHtml(userAnswer)}"
          oninput="ExamModule.fillAnswer(${q.id}, this.value)"
          autocomplete="off" spellcheck="false" />
        <div class="fill-hint">提示：不區分大小寫</div>
      </div>`;
    }

    container.innerHTML = `
      <div class="question-card">
        <div class="question-number">
          第 ${this.currentIndex + 1} 題 / 共 ${this.questions.length} 題
          <span class="question-level-badge">Lv.${q.level || '?'}</span>
        </div>
        <div class="question-text">${escapeHtml(q.question_text)}</div>
        ${inputHTML}
      </div>
    `;

    document.getElementById('btnPrevQ').disabled = this.currentIndex === 0;
    document.getElementById('btnNextQ').textContent = this.currentIndex === this.questions.length - 1 ? '完成 ✓' : '下一題 →';
  },

  selectOption(qId, value) {
    this.answers[qId] = value;
    this.renderQuestion();
    this.updateDots();
  },

  fillAnswer(qId, value) {
    this.answers[qId] = value;
    this.updateDots();
  },

  prevQuestion() {
    if (this.currentIndex > 0) {
      this.currentIndex--;
      this.render();
    }
  },

  nextQuestion() {
    if (this.currentIndex < this.questions.length - 1) {
      this.currentIndex++;
      this.render();
    } else {
      this.confirmSubmit();
    }
  },

  updateProgress() {
    const answered = Object.keys(this.answers).filter(k => this.answers[k] !== '').length;
    const pct = (this.currentIndex + 1) / this.questions.length * 100;
    document.getElementById('examProgressFill').style.width = pct + '%';
    document.getElementById('examProgressLabel').textContent = `已回答 ${answered}/${this.questions.length} 題`;
  },

  updateDots() {
    const container = document.getElementById('questionDots');
    container.innerHTML = this.questions.map((q, i) => {
      let cls = 'q-dot';
      if (i === this.currentIndex) cls += ' current';
      else if (this.answers[q.id] && this.answers[q.id] !== '') cls += ' answered';
      else cls += ' unanswered';
      return `<div class="${cls}" onclick="ExamModule.goToQuestion(${i})" title="第 ${i+1} 題"></div>`;
    }).join('');
    this.updateProgress();
  },

  goToQuestion(index) {
    this.currentIndex = index;
    this.render();
  },

  startTimer() {
    const total = this.remainingSeconds;
    const circumference = 2 * Math.PI * 40;
    const progressEl = document.getElementById('timerProgress');
    progressEl.style.strokeDasharray = circumference;

    const update = () => {
      const mins = Math.floor(this.remainingSeconds / 60);
      const secs = this.remainingSeconds % 60;
      document.getElementById('timerText').textContent =
        `${String(mins).padStart(2,'0')}:${String(secs).padStart(2,'0')}`;

      const pct = this.remainingSeconds / total;
      progressEl.style.strokeDashoffset = circumference * (1 - pct);

      const circle = document.getElementById('timerCircle');
      if (this.remainingSeconds <= 60)  { circle.className = 'timer-circle danger'; }
      else if (this.remainingSeconds <= 300) { circle.className = 'timer-circle warning'; }
      else { circle.className = 'timer-circle'; }
    };

    update();
    this.timerInterval = setInterval(() => {
      this.remainingSeconds--;
      update();
      if (this.remainingSeconds <= 0) {
        clearInterval(this.timerInterval);
        Toast.warning('時間到！正在自動交卷...', 5000);
        setTimeout(() => this.doSubmit(true), 1500);
      }
    }, 1000);
  },

  stopTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  },

  confirmSubmit() {
    const answered = Object.keys(this.answers).filter(k => this.answers[k] !== '').length;
    const unanswered = this.questions.length - answered;
    const modal = document.getElementById('submitConfirmModal');
    const summary = document.getElementById('submitSummary');

    summary.innerHTML = `
      <div class="submit-summary-row">
        <span class="summary-label">總題數</span>
        <span class="summary-value">${this.questions.length} 題</span>
      </div>
      <div class="submit-summary-row">
        <span class="summary-label">已作答</span>
        <span class="summary-value ok">${answered} 題</span>
      </div>
      <div class="submit-summary-row">
        <span class="summary-label">未作答</span>
        <span class="summary-value ${unanswered > 0 ? 'warn' : 'ok'}">${unanswered} 題</span>
      </div>
      <div class="submit-summary-row">
        <span class="summary-label">剩餘時間</span>
        <span class="summary-value">${Math.floor(this.remainingSeconds/60)} 分 ${this.remainingSeconds%60} 秒</span>
      </div>
    `;

    modal.classList.remove('hidden');
  },

  closeSubmitModal() {
    document.getElementById('submitConfirmModal').classList.add('hidden');
  },

  async doSubmit(isAutoSubmit = false) {
    this.closeSubmitModal();
    this.stopTimer();
    Loading.show('提交答案中...');

    try {
      const result = await API.exams.submit(this.attemptId, this.answers);
      Loading.hide();
      ResultsModule.show(result, this.questions, this.subjectName);
    } catch (err) {
      Loading.hide();
      Toast.error('提交失敗：' + (err.message || '未知錯誤'));
      if (!isAutoSubmit) {
        this.startTimer();
      }
    }
  }
};
