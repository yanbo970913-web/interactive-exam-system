/**
 * 管理者後台模組
 */

// ─── 管理者儀表板 ─────────────────────────────────────
const AdminDashboard = {
  async load() {
    const grid = document.getElementById('adminStatsGrid');
    const recentEl = document.getElementById('recentAttempts');
    grid.innerHTML = '<div class="loading-spinner" style="width:32px;height:32px;margin:0 auto"></div>';

    try {
      const stats = await API.exams.stats();

      grid.innerHTML = [
        { icon: '👥', label: '學生人數', value: stats.total_users, color: '#3B82F6' },
        { icon: '🗓️', label: '考試場數', value: stats.total_exams, color: '#7C3AED' },
        { icon: '📝', label: '有效題目', value: stats.total_questions, color: '#06B6D4' },
        { icon: '📊', label: '作答次數', value: stats.total_attempts, color: '#10B981' },
        { icon: '🏆', label: '平均分數', value: Math.round(stats.avg_score || 0) + '分', color: '#F59E0B' },
      ].map(s => `
        <div class="admin-stat-card">
          <div class="admin-stat-icon" style="color:${s.color}">${s.icon}</div>
          <div class="admin-stat-info">
            <div class="label">${s.label}</div>
            <div class="value" style="color:${s.color}">${s.value}</div>
          </div>
        </div>
      `).join('');

      if (stats.recent_attempts && stats.recent_attempts.length > 0) {
        recentEl.innerHTML = `
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
            <span></span>
            <button class="btn-tbl-edit" onclick="App.navigate('admin-attempts')" style="font-size:0.8rem">🔍 查看全部錯題分析 →</button>
          </div>
          <div class="table-wrapper">
            <table class="data-table">
              <thead><tr>
                <th>學生</th><th>考試名稱</th><th>分數</th><th>時間</th><th>提交時間</th><th>詳情</th>
              </tr></thead>
              <tbody>
                ${stats.recent_attempts.map(a => `
                  <tr>
                    <td>${escapeHtml(a.display_name)}</td>
                    <td>${escapeHtml(a.exam_title)}</td>
                    <td><strong style="color:${a.score >= 60 ? '#10B981' : '#EF4444'}">${a.score}分</strong></td>
                    <td>${formatDuration(a.time_spent_seconds)}</td>
                    <td>${formatDate(a.submitted_at)}</td>
                    <td></td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `;
      } else {
        recentEl.innerHTML = '<div class="empty-state"><p>尚無作答記錄</p></div>';
      }
    } catch (err) {
      grid.innerHTML = `<div class="empty-state"><p>載入失敗：${escapeHtml(err.message)}</p></div>`;
    }
  }
};

// ─── 題庫管理 ─────────────────────────────────────────
const AdminQuestions = {
  questions: [],
  _currentPage: 1,
  _pageSize: 50,
  _total: 0,
  _searchTimer: null,

  async load() {
    this._currentPage = 1;
    await this._fetchAndRender();
    // 填充科目選單
    const sel = document.getElementById('qFilterSubject');
    sel.innerHTML = '<option value="">全部科目</option>' +
      AppState.subjects.map(s => `<option value="${s.id}">${s.icon} ${escapeHtml(s.name)}</option>`).join('');
  },

  async applyFilter() {
    this._currentPage = 1;
    await this._fetchAndRender();
  },

  async goPage(p) {
    this._currentPage = p;
    await this._fetchAndRender(true);
    document.getElementById('questionsTable')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  },

  async _fetchAndRender(silent = false) {
    const subject_id = document.getElementById('qFilterSubject')?.value || '';
    const level      = document.getElementById('qFilterLevel')?.value  || '';
    const type       = document.getElementById('qFilterType')?.value   || '';
    const search     = document.getElementById('qFilterSearch')?.value?.trim() || '';
    const status     = document.getElementById('qFilterStatus')?.value || '';
    const wrapper    = document.getElementById('questionsTable');
    if (!wrapper) return;

    if (!silent) wrapper.innerHTML = '<div style="padding:24px;text-align:center"><div class="loading-spinner" style="width:28px;height:28px;margin:0 auto"></div></div>';

    try {
      const params = { page: this._currentPage, limit: this._pageSize };
      if (subject_id) params.subject_id = subject_id;
      if (level)      params.level      = level;
      if (type)       params.type       = type;
      if (search)     params.search     = search;
      if (status)     params.status     = status;

      const data = await API.questions.list(params);
      this.questions  = data.questions;
      this._total     = data.total;
      const totalPages = Math.max(1, Math.ceil(this._total / this._pageSize));
      const pageStart  = (this._currentPage - 1) * this._pageSize + 1;
      const pageEnd    = Math.min(this._currentPage * this._pageSize, this._total);

      if (this.questions.length === 0) {
        wrapper.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📭</div><h3>沒有符合條件的題目</h3></div>';
        return;
      }

      // ── Pagination bar ──
      const paginationBar = this._buildPagination(totalPages);

      wrapper.innerHTML = `
        <div class="q-table-meta">
          <span>共 <strong>${this._total.toLocaleString()}</strong> 題 ｜ 顯示第 ${pageStart}–${pageEnd} 題</span>
          <div class="q-page-size-wrap">
            每頁
            <select class="form-select q-pagesize-sel" onchange="AdminQuestions.changePageSize(this.value)">
              ${[25,50,100,200].map(n=>`<option value="${n}" ${n===this._pageSize?'selected':''}>${n}</option>`).join('')}
            </select>
            題
          </div>
        </div>
        ${paginationBar}
        <div class="table-wrapper">
          <table class="data-table">
            <thead><tr>
              <th style="width:50px">#</th><th>科目</th><th>等級</th><th>題型</th><th>題目內容</th><th>狀態</th><th>操作</th>
            </tr></thead>
            <tbody>
              ${this.questions.map((q, idx) => `
                <tr class="q-row" id="qrow_${q.id}">
                  <td style="text-align:center;color:#64748B;font-size:0.82rem">${pageStart + idx}</td>
                  <td style="font-size:0.82rem">${escapeHtml(q.subject_name)}</td>
                  <td><span class="q-level-badge">Lv.${q.level}</span></td>
                  <td>${q.type === 'choice' ? '<span class="tag-type-choice">選擇題</span>' : '<span class="tag-type-fill">填充題</span>'}</td>
                  <td class="q-text-cell" title="${escapeHtml(q.question_text)}">${escapeHtml(q.question_text.slice(0,80))}${q.question_text.length>80?'…':''}</td>
                  <td>${q.is_active ? '<span class="tag-active">啟用</span>' : '<span class="tag-inactive">停用</span>'}</td>
                  <td class="q-actions-cell">
                    <button class="btn-tbl-edit"   onclick="AdminQuestions.openEditModal(${q.id})">✏️ 編輯</button>
                    <button class="btn-tbl-toggle" onclick="AdminQuestions.toggle(${q.id})">${q.is_active ? '🔇 停用' : '✅ 啟用'}</button>
                    <button class="btn-tbl-delete" onclick="AdminQuestions.confirmDelete(${q.id})">🗑️ 刪除</button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
        ${paginationBar}
      `;
    } catch (err) {
      wrapper.innerHTML = `<div class="empty-state"><p>載入失敗：${escapeHtml(err.message)}</p></div>`;
    }
  },

  _buildPagination(totalPages) {
    if (totalPages <= 1) return '';
    const cur = this._currentPage;

    let pages = [];
    if (totalPages <= 7) {
      pages = Array.from({ length: totalPages }, (_, i) => i + 1);
    } else {
      pages = [1];
      if (cur > 3) pages.push('…');
      for (let i = Math.max(2, cur - 1); i <= Math.min(totalPages - 1, cur + 1); i++) pages.push(i);
      if (cur < totalPages - 2) pages.push('…');
      pages.push(totalPages);
    }

    const btn = (label, page, disabled = false, active = false) =>
      `<button class="q-pg-btn ${active?'active':''}" ${disabled?'disabled':''} onclick="AdminQuestions.goPage(${page})">${label}</button>`;

    return `<div class="q-pagination">
      ${btn('‹', cur - 1, cur === 1)}
      ${pages.map(p => p === '…' ? '<span class="q-pg-ellipsis">…</span>' : btn(p, p, false, p === cur)).join('')}
      ${btn('›', cur + 1, cur === totalPages)}
      <span class="q-pg-info">第 ${cur} / ${totalPages} 頁</span>
      <input class="q-pg-jump" type="number" min="1" max="${totalPages}" placeholder="跳頁"
        onkeydown="if(event.key==='Enter'){const v=parseInt(this.value);if(v>=1&&v<=${totalPages})AdminQuestions.goPage(v);this.value=''}">
    </div>`;
  },

  changePageSize(n) {
    this._pageSize = parseInt(n);
    this._currentPage = 1;
    this._fetchAndRender();
  },

  onSearchInput() {
    clearTimeout(this._searchTimer);
    this._searchTimer = setTimeout(() => this.applyFilter(), 400);
  },

  async toggle(id) {
    try {
      const res = await API.questions.toggle(id);
      Toast.success(res.message);

      const statusFilter = document.getElementById('qFilterStatus')?.value || '';
      const row = document.getElementById(`qrow_${id}`);

      // 若目前有狀態篩選（只看啟用 or 只看停用），切換後該列應從表格消失
      if (statusFilter === 'active' || statusFilter === 'inactive') {
        if (row) {
          row.style.transition = 'opacity 0.3s, transform 0.3s';
          row.style.opacity = '0';
          row.style.transform = 'translateX(20px)';
          setTimeout(() => {
            row.remove();
            // 更新本地 total 計數
            this._total = Math.max(0, this._total - 1);
            const metaEl = document.querySelector('.q-table-meta strong');
            if (metaEl) metaEl.textContent = this._total.toLocaleString();
            // 若該頁已空，刷新
            this.questions = this.questions.filter(q => q.id !== id);
            if (this.questions.length === 0) this._fetchAndRender();
          }, 320);
        }
      } else {
        // 全部顯示模式：僅更新列的狀態標籤與按鈕
        this.questions = this.questions.map(q => q.id === id ? {...q, is_active: !q.is_active} : q);
        if (row) {
          const q = this.questions.find(q => q.id === id);
          const tagEl = row.querySelector('.tag-active, .tag-inactive');
          if (tagEl) tagEl.outerHTML = q.is_active
            ? '<span class="tag-active">啟用</span>'
            : '<span class="tag-inactive">停用</span>';
          const toggleBtn = row.querySelector('.btn-tbl-toggle');
          if (toggleBtn) toggleBtn.textContent = q.is_active ? '🔇 停用' : '✅ 啟用';
          // 短暫高亮
          row.style.transition = 'background 0.4s';
          row.style.background = q.is_active ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.06)';
          setTimeout(() => { row.style.background = ''; }, 800);
        }
      }
    } catch (err) { Toast.error(err.message); }
  },

  async confirmDelete(id) {
    const q = this.questions.find(q => q.id === id);
    Modal.open('確認刪除題目', `
      <p style="color:#FCA5A5;margin-bottom:8px">⚠️ 此操作無法復原！</p>
      <p style="font-size:0.9rem">確定要刪除以下題目嗎？</p>
      <div style="margin-top:12px;padding:12px;background:rgba(239,68,68,0.1);border-radius:8px;font-size:0.85rem">
        ${escapeHtml(q?.question_text?.slice(0, 100) || '此題目')}
      </div>
    `, `
      <button class="btn-modal-cancel" onclick="Modal.close()">取消</button>
      <button class="btn-modal-delete" onclick="AdminQuestions.doDelete(${id})">確認刪除</button>
    `);
  },

  async doDelete(id) {
    try {
      await API.questions.delete(id);
      Modal.close();
      Toast.success('題目已刪除');
      this.applyFilter();
    } catch (err) { Toast.error(err.message); }
  },

  openAddModal() { this._openModal(null); },
  openEditModal(id) {
    const q = this.questions.find(q => q.id === id);
    if (!q) return;
    this._openModal(q);
  },

  _openModal(q) {
    const isEdit = !!q;
    const subjects = AppState.subjects;
    const opts = q && q.options ? (typeof q.options === 'string' ? JSON.parse(q.options) : q.options) : ['', '', '', ''];

    const subjectOpts = subjects.map(s =>
      `<option value="${s.id}" ${q && q.subject_id === s.id ? 'selected' : ''}>${s.icon} ${escapeHtml(s.name)}</option>`
    ).join('');

    const optionsHTML = opts.map((o, i) => `
      <div class="option-input-row">
        <input type="text" class="form-input" placeholder="選項 ${['A','B','C','D'][i]}" value="${escapeHtml(o)}" data-opt-idx="${i}" />
        ${i >= 2 ? `<button type="button" class="btn-remove-option" onclick="this.closest('.option-input-row').remove()">✕</button>` : ''}
      </div>
    `).join('');

    Modal.open(isEdit ? '編輯題目' : '新增題目', `
      <div class="modal-form" id="questionForm">
        <div class="form-row">
          <div>
            <label class="form-label">科目</label>
            <select class="form-select" id="qSubject">${subjectOpts}</select>
          </div>
          <div class="form-row" style="grid-template-columns:1fr 1fr;gap:12px">
            <div>
              <label class="form-label">等級</label>
              <select class="form-select" id="qLevel">
                ${[1,2,3,4,5,6,7].map(l => `<option value="${l}" ${q && q.level===l ? 'selected' : ''}>Level ${l}</option>`).join('')}
              </select>
            </div>
            <div>
              <label class="form-label">題型</label>
              <select class="form-select" id="qType" onchange="AdminQuestions.toggleOptionsUI()">
                <option value="choice" ${!q||q.type==='choice'?'selected':''}>選擇題</option>
                <option value="fill"   ${q&&q.type==='fill'?'selected':''}>填充題</option>
              </select>
            </div>
          </div>
        </div>
        <div>
          <label class="form-label">題目內容</label>
          <textarea class="form-textarea" id="qText" rows="4" placeholder="請輸入題目內容...">${escapeHtml(q?.question_text||'')}</textarea>
        </div>
        <div id="optionsSection" class="${q&&q.type==='fill'?'hidden':''}">
          <label class="form-label">選項（選擇題）</label>
          <div class="options-input-group" id="optionsInputGroup">${optionsHTML}</div>
          <button type="button" class="btn-add-option" onclick="AdminQuestions.addOptionRow()">＋ 新增選項</button>
        </div>
        <div>
          <label class="form-label">正確答案</label>
          <input type="text" class="form-input" id="qAnswer" placeholder="填充題輸入完整答案；選擇題輸入選項文字" value="${escapeHtml(q?.correct_answer||'')}" />
        </div>
        <div>
          <label class="form-label">解析說明（選填）</label>
          <textarea class="form-textarea" id="qExplanation" rows="3" placeholder="題目解析，交卷後顯示給學生...">${escapeHtml(q?.explanation||'')}</textarea>
        </div>
      </div>
    `, `
      <button class="btn-modal-cancel" onclick="Modal.close()">取消</button>
      <button class="btn-modal-save" onclick="AdminQuestions.saveQuestion(${q?.id||'null'})">${isEdit ? '儲存變更' : '新增題目'}</button>
    `);
  },

  toggleOptionsUI() {
    const type = document.getElementById('qType').value;
    document.getElementById('optionsSection').classList.toggle('hidden', type === 'fill');
  },

  addOptionRow() {
    const group = document.getElementById('optionsInputGroup');
    const idx = group.querySelectorAll('.option-input-row').length;
    const row = document.createElement('div');
    row.className = 'option-input-row';
    row.innerHTML = `
      <input type="text" class="form-input" placeholder="選項 ${['A','B','C','D','E'][idx] || idx+1}" data-opt-idx="${idx}" />
      <button type="button" class="btn-remove-option" onclick="this.closest('.option-input-row').remove()">✕</button>
    `;
    group.appendChild(row);
  },

  async saveQuestion(editId) {
    const subject_id = parseInt(document.getElementById('qSubject').value);
    const level = parseInt(document.getElementById('qLevel').value);
    const type = document.getElementById('qType').value;
    const question_text = document.getElementById('qText').value.trim();
    const correct_answer = document.getElementById('qAnswer').value.trim();
    const explanation = document.getElementById('qExplanation').value.trim();

    if (!question_text || !correct_answer) { Toast.warning('請填寫題目和正確答案'); return; }

    let options = null;
    if (type === 'choice') {
      const inputs = document.querySelectorAll('#optionsInputGroup input');
      options = [...inputs].map(i => i.value.trim()).filter(Boolean);
      if (options.length < 2) { Toast.warning('選擇題至少需要 2 個選項'); return; }
    }

    try {
      const data = { subject_id, level, type, question_text, options, correct_answer, explanation };
      if (editId) {
        await API.questions.update(editId, data);
        Toast.success('題目更新成功');
      } else {
        await API.questions.create(data);
        Toast.success('題目新增成功');
      }
      Modal.close();
      this.applyFilter();
    } catch (err) { Toast.error(err.message); }
  }
};

// ─── 考試管理 ─────────────────────────────────────────
const AdminExams = {
  exams: [],

  _autoRefreshTimer: null,

  async load(silent = false) {
    const wrapper = document.getElementById('adminExamsTable');
    if (!silent) wrapper.innerHTML = '<div style="padding:24px;text-align:center"><div class="loading-spinner" style="width:28px;height:28px;margin:0 auto"></div></div>';

    try {
      this.exams = await API.exams.list();
      this._renderTable();
      // 更新最後刷新時間
      const ts = document.getElementById('examLastRefresh');
      if (ts) ts.textContent = `最後更新：${new Date().toLocaleTimeString('zh-TW')}`;
    } catch (err) {
      if (!silent) wrapper.innerHTML = `<div class="empty-state"><p>載入失敗：${escapeHtml(err.message)}</p></div>`;
    }
  },

  startAutoRefresh() {
    this.stopAutoRefresh();
    this._autoRefreshTimer = setInterval(() => this.load(true), 30000); // 每30秒靜默刷新
  },

  stopAutoRefresh() {
    if (this._autoRefreshTimer) { clearInterval(this._autoRefreshTimer); this._autoRefreshTimer = null; }
  },

  _renderTable() {
    const wrapper = document.getElementById('adminExamsTable');
    if (this.exams.length === 0) {
      wrapper.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📭</div><h3>尚未建立任何考試</h3></div>';
      return;
    }
    wrapper.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;flex-wrap:wrap">
        <span id="examLastRefresh" style="font-size:0.75rem;color:#64748B"></span>
        <button class="btn-tbl-edit" onclick="AdminExams.load()" style="font-size:0.75rem;padding:4px 10px">🔄 刷新</button>
        <label style="display:flex;align-items:center;gap:6px;font-size:0.75rem;color:#94A3B8;cursor:pointer">
          <input type="checkbox" id="examAutoRefresh" onchange="AdminExams.toggleAutoRefresh(this.checked)"
            style="accent-color:#3B82F6" />
          自動刷新 (30秒)
        </label>
      </div>
      <div class="table-wrapper">
        <table class="data-table">
          <thead><tr>
            <th>名稱</th><th>科目</th><th>題數/時長</th><th>次數上限</th><th>指定學生</th><th>開始時間</th><th>截止時間</th><th>狀態</th><th>操作</th>
          </tr></thead>
          <tbody>
            ${this.exams.map(e => `
              <tr id="examRow_${e.id}">
                <td><strong>${escapeHtml(e.title)}</strong>
                  ${e.description ? `<br><span style="font-size:0.75rem;color:#94A3B8">${escapeHtml(e.description.slice(0,40))}${e.description.length>40?'…':''}</span>` : ''}
                </td>
                <td>${e.subject_icon} ${escapeHtml(e.subject_name)}</td>
                <td>${e.question_count}題 / ${e.duration_minutes}分</td>
                <td style="text-align:center">
                  ${e.max_attempts != null
                    ? `<span style="background:rgba(245,158,11,0.2);color:#FCD34D;padding:2px 8px;border-radius:99px;font-size:0.78rem">最多 ${e.max_attempts} 次</span>`
                    : '<span style="color:#64748B;font-size:0.78rem">無限制</span>'}
                </td>
                <td style="text-align:center">
                  ${e.assignment_count > 0
                    ? `<span class="exam-assign-badge">👥 ${e.assignment_count} 人</span>`
                    : '<span style="color:#64748B;font-size:0.78rem">全部</span>'}
                </td>
                <td style="font-size:0.8rem">${formatDate(e.start_time)}</td>
                <td style="font-size:0.8rem">${formatDate(e.end_time)}</td>
                <td>${e.is_active ? '<span class="tag-active">開放</span>' : '<span class="tag-inactive">關閉</span>'}</td>
                <td>
                  <button class="btn-tbl-edit"   onclick="AdminExams.openEditModal(${e.id})">✏️ 編輯</button>
                  <button class="btn-tbl-toggle" onclick="AdminExams.quickToggle(${e.id})">${e.is_active ? '🔇 關閉' : '✅ 開放'}</button>
                  <button class="btn-tbl-delete" onclick="AdminExams.confirmDelete(${e.id})">🗑️ 刪除</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
    // 恢復自動刷新 checkbox 狀態
    const cb = document.getElementById('examAutoRefresh');
    if (cb) cb.checked = !!this._autoRefreshTimer;
    // 更新時間戳
    const ts = document.getElementById('examLastRefresh');
    if (ts) ts.textContent = `最後更新：${new Date().toLocaleTimeString('zh-TW')}`;
  },

  toggleAutoRefresh(checked) {
    if (checked) this.startAutoRefresh();
    else this.stopAutoRefresh();
  },

  // 快速切換開關（無需重載全部）
  async quickToggle(id) {
    const exam = this.exams.find(e => e.id === id);
    if (!exam) return;
    try {
      await API.exams.update(id, { is_active: exam.is_active ? 0 : 1 });
      exam.is_active = exam.is_active ? 0 : 1; // 本地更新
      Toast.success(exam.is_active ? '考試已開放' : '考試已關閉');
      this._renderTable(); // 僅重繪表格，不重新 fetch
    } catch (err) { Toast.error(err.message); }
  },

  async toggle(id) { return this.quickToggle(id); },

  async confirmDelete(id) {
    const e = this.exams.find(e => e.id === id);
    Modal.open('確認刪除考試', `
      <p style="color:#FCA5A5;margin-bottom:8px">⚠️ 刪除考試將同時刪除所有相關作答記錄！</p>
      <p>確定要刪除「${escapeHtml(e?.title||'')}」嗎？</p>
    `, `
      <button class="btn-modal-cancel" onclick="Modal.close()">取消</button>
      <button class="btn-modal-delete" onclick="AdminExams.doDelete(${id})">確認刪除</button>
    `);
  },

  async doDelete(id) {
    try {
      await API.exams.delete(id);
      Modal.close();
      Toast.success('考試已刪除');
      this.load();
    } catch (err) { Toast.error(err.message); }
  },

  openAddModal()    { this._openModal(null).catch(err => Toast.error(err.message)); },
  openEditModal(id) { this._openModal(this.exams.find(e => e.id === id)).catch(err => Toast.error(err.message)); },

  // 學生清單快取（開啟 modal 時一次性載入）
  _studentCache: [],

  async _openModal(e) {
    const isEdit = !!e;
    const toLocalInput = iso => iso ? new Date(iso).toISOString().slice(0, 16) : '';
    const subjectOpts = AppState.subjects.map(s =>
      `<option value="${s.id}" ${e && e.subject_id === s.id ? 'selected' : ''}>${s.icon} ${escapeHtml(s.name)}</option>`
    ).join('');

    // 同步拉取學生清單 & 現有指定名單
    let students = [], assignedIds = new Set();
    try {
      [students, assignedIds] = await Promise.all([
        API.admin.students(),
        isEdit
          ? API.exams.getAssignments(e.id).then(rows => new Set(rows.map(r => r.id)))
          : Promise.resolve(new Set())
      ]);
    } catch (_) {}
    this._studentCache = students;

    // API.admin.students() 已在後端 WHERE role='student'，不需要再過濾
    const onlyStudents = students;

    const studentRows = onlyStudents.map(u => `
      <label class="assign-student-row ${assignedIds.has(u.id) ? 'selected' : ''}" id="asr_${u.id}">
        <input type="checkbox" class="assign-cb" value="${u.id}" ${assignedIds.has(u.id) ? 'checked' : ''} onchange="AdminExams._onAssignCheck(this)" />
        <span class="assign-avatar" style="background:${u.avatar_color||'#3B82F6'}">${(u.display_name||'?')[0]}</span>
        <span class="assign-name">${escapeHtml(u.display_name)}</span>
        <span class="assign-user">${escapeHtml(u.username)}</span>
      </label>
    `).join('');

    Modal.open(isEdit ? '編輯考試' : '新增考試', `
      <div class="modal-form">
        <div>
          <label class="form-label">考試名稱</label>
          <input type="text" class="form-input" id="eTitle" value="${escapeHtml(e?.title||'')}" placeholder="例：第一次英文月考" />
        </div>
        <div>
          <label class="form-label">說明（選填）</label>
          <textarea class="form-textarea" id="eDesc" rows="2">${escapeHtml(e?.description||'')}</textarea>
        </div>
        <div class="form-row">
          <div>
            <label class="form-label">科目</label>
            <select class="form-select" id="eSubject">${subjectOpts}</select>
          </div>
          <div>
            <label class="form-label">難度篩選（逗號分隔，如 1,2 或 all）</label>
            <input type="text" class="form-input" id="eLevelFilter" value="${escapeHtml(e?.level_filter||'all')}" placeholder="all 或 1,2,3" />
          </div>
        </div>
        <div class="form-row">
          <div>
            <label class="form-label">抽題數量</label>
            <input type="number" class="form-input" id="eCount" min="1" max="100" value="${e?.question_count||10}" />
          </div>
          <div>
            <label class="form-label">作答時間（分鐘）</label>
            <input type="number" class="form-input" id="eDuration" min="1" value="${e?.duration_minutes||30}" />
          </div>
        </div>
        <div class="form-row">
          <div>
            <label class="form-label">開始時間</label>
            <input type="datetime-local" class="form-input" id="eStart" value="${toLocalInput(e?.start_time)}" />
          </div>
          <div>
            <label class="form-label">截止時間</label>
            <input type="datetime-local" class="form-input" id="eEnd" value="${toLocalInput(e?.end_time)}" />
          </div>
        </div>
        <div class="form-row">
          <div>
            <label class="form-label">及格分數（%）</label>
            <input type="number" class="form-input" id="ePassing" min="0" max="100" value="${e?.passing_score||60}" />
          </div>
          <div>
            <label class="form-label">最多參加次數（空白＝無限）</label>
            <input type="number" class="form-input" id="eMaxAttempts" min="1" max="999"
              value="${e?.max_attempts != null ? e.max_attempts : ''}" placeholder="不限次數" />
          </div>
        </div>

        <!-- 指定學生 -->
        <div class="assign-section">
          <div class="assign-section-header">
            <span class="form-label" style="margin:0">👥 指定學生</span>
            <span class="assign-hint">不勾選任何人＝全部學生皆可參加</span>
            <div class="assign-actions">
              <button type="button" class="btn-assign-action" onclick="AdminExams._selectAll(true)">全選</button>
              <button type="button" class="btn-assign-action" onclick="AdminExams._selectAll(false)">清除</button>
            </div>
          </div>
          <div class="assign-count-bar" id="assignCountBar">
            ${assignedIds.size > 0 ? `已指定 <strong>${assignedIds.size}</strong> 人` : '目前開放給全部學生'}
          </div>
          <input type="text" class="assign-search" placeholder="🔍 搜尋學生姓名或帳號..."
            oninput="AdminExams._filterAssign(this.value)" />
          <div class="assign-list" id="assignList">
            ${onlyStudents.length ? studentRows : '<div style="color:#64748B;font-size:0.85rem;padding:12px">目前沒有學生帳號</div>'}
          </div>
        </div>
      </div>
    `, `
      <button class="btn-modal-cancel" onclick="Modal.close()">取消</button>
      <button class="btn-modal-save" onclick="AdminExams.save(${e?.id||'null'})">${isEdit ? '儲存變更' : '建立考試'}</button>
    `);
  },

  _onAssignCheck(cb) {
    const row = cb.closest('.assign-student-row');
    if (row) row.classList.toggle('selected', cb.checked);
    // 更新計數
    const count = document.querySelectorAll('.assign-cb:checked').length;
    const bar = document.getElementById('assignCountBar');
    if (bar) bar.innerHTML = count > 0 ? `已指定 <strong>${count}</strong> 人` : '目前開放給全部學生';
  },

  _selectAll(checked) {
    document.querySelectorAll('.assign-cb').forEach(cb => {
      cb.checked = checked;
      const row = cb.closest('.assign-student-row');
      if (row) row.classList.toggle('selected', checked);
    });
    const count = checked ? document.querySelectorAll('.assign-cb').length : 0;
    const bar = document.getElementById('assignCountBar');
    if (bar) bar.innerHTML = count > 0 ? `已指定 <strong>${count}</strong> 人` : '目前開放給全部學生';
  },

  _filterAssign(q) {
    const lower = q.toLowerCase();
    document.querySelectorAll('.assign-student-row').forEach(row => {
      const name = row.querySelector('.assign-name')?.textContent.toLowerCase() || '';
      const user = row.querySelector('.assign-user')?.textContent.toLowerCase() || '';
      row.style.display = (!q || name.includes(lower) || user.includes(lower)) ? '' : 'none';
    });
  },

  async save(editId) {
    const title = document.getElementById('eTitle').value.trim();
    const desc = document.getElementById('eDesc').value.trim();
    const subject_id = parseInt(document.getElementById('eSubject').value);
    const level_filter = document.getElementById('eLevelFilter').value.trim() || 'all';
    const question_count = parseInt(document.getElementById('eCount').value);
    const duration_minutes = parseInt(document.getElementById('eDuration').value);
    const start_time = document.getElementById('eStart').value || null;
    const end_time = document.getElementById('eEnd').value || null;
    const passing_score = parseInt(document.getElementById('ePassing').value);
    const maxAttemptsRaw = document.getElementById('eMaxAttempts').value.trim();
    const max_attempts = maxAttemptsRaw ? parseInt(maxAttemptsRaw) : null;

    // 收集已勾選的學生 IDs
    const assignedIds = [...document.querySelectorAll('.assign-cb:checked')].map(cb => parseInt(cb.value));

    if (!title) { Toast.warning('請填寫考試名稱'); return; }
    if (start_time && end_time && new Date(start_time) >= new Date(end_time)) {
      Toast.warning('截止時間必須晚於開始時間'); return;
    }
    if (max_attempts !== null && (isNaN(max_attempts) || max_attempts < 1)) {
      Toast.warning('最多參加次數必須為正整數'); return;
    }

    const toISO = val => val ? new Date(val).toISOString() : null;

    try {
      const data = {
        title, description: desc, subject_id, level_filter, question_count,
        duration_minutes, start_time: toISO(start_time), end_time: toISO(end_time),
        passing_score, max_attempts
      };
      let examId = editId;
      if (editId) {
        await API.exams.update(editId, data);
      } else {
        const res = await API.exams.create(data);
        examId = res.id;
      }
      // 儲存指定學生（無論新增或編輯）
      await API.exams.setAssignments(examId, assignedIds);

      const assignMsg = assignedIds.length ? `，已指定 ${assignedIds.length} 位學生` : '，開放給全部學生';
      Toast.success((editId ? '考試更新成功' : '考試建立成功') + assignMsg);
      Modal.close();
      this.load();
    } catch (err) { Toast.error(err.message); }
  }
};

// ─── 使用者管理 ─────────────────────────────────────
const AdminUsers = {
  users: [],

  async load() {
    const wrapper = document.getElementById('usersTable');
    wrapper.innerHTML = '<div style="padding:24px;text-align:center"><div class="loading-spinner" style="width:28px;height:28px;margin:0 auto"></div></div>';

    try {
      this.users = await API.users.list();
      wrapper.innerHTML = `
        <div class="table-wrapper">
          <table class="data-table">
            <thead><tr>
              <th>帳號</th><th>顯示名稱</th><th>身分</th><th>建立時間</th><th>操作</th>
            </tr></thead>
            <tbody>
              ${this.users.map(u => `
                <tr>
                  <td><strong>${escapeHtml(u.username)}</strong></td>
                  <td>
                    <span style="display:inline-flex;align-items:center;gap:8px">
                      ${AvatarUtil.toHTML(u, 28)}
                      ${escapeHtml(u.display_name)}
                    </span>
                  </td>
                  <td>${
                    u.role === 'superadmin' ? '<span class="tag-active" style="background:#7C3AED20;color:#A78BFA;border-color:#7C3AED">👑 最高管理員</span>' :
                    u.role === 'teacher'    ? '<span class="tag-active" style="background:#065F4620;color:#34D399;border-color:#059669">🎓 老師</span>' :
                                             '<span class="tag-type-fill">學生</span>'
                  }</td>
                  <td style="font-size:0.8rem">${formatDate(u.created_at)}</td>
                  <td>
                    <button class="btn-tbl-edit" onclick="AdminUsers.openEditModal(${u.id})">✏️ 編輯</button>
                    ${u.role !== 'superadmin' ? `<button class="btn-tbl-delete" onclick="AdminUsers.confirmDelete(${u.id})">🗑️ 刪除</button>` : '<span style="font-size:0.75rem;color:#64748B">（主管理者）</span>'}
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    } catch (err) {
      wrapper.innerHTML = `<div class="empty-state"><p>載入失敗：${escapeHtml(err.message)}</p></div>`;
    }
  },

  openAddModal() {
    const isSuperAdmin = AppState.user.role === 'superadmin';
    const roleOptions = isSuperAdmin
      ? `<option value="student">學生</option><option value="teacher">老師</option>`
      : `<option value="student">學生</option>`;
    Modal.open('新增使用者', `
      <div class="modal-form">
        <div class="form-row">
          <div>
            <label class="form-label">帳號</label>
            <input type="text" class="form-input" id="uUsername" placeholder="英數字帳號" />
          </div>
          <div>
            <label class="form-label">初始密碼（至少6碼）</label>
            <input type="password" class="form-input" id="uPassword" placeholder="初始密碼" />
          </div>
        </div>
        <div class="form-row">
          <div>
            <label class="form-label">顯示名稱</label>
            <input type="text" class="form-input" id="uDisplayName" placeholder="顯示名稱" />
          </div>
          <div>
            <label class="form-label">身分</label>
            <select class="form-select" id="uRole">${roleOptions}</select>
          </div>
        </div>
      </div>
    `, `
      <button class="btn-modal-cancel" onclick="Modal.close()">取消</button>
      <button class="btn-modal-save" onclick="AdminUsers.createUser()">建立使用者</button>
    `);
  },

  openEditModal(id) {
    const u = this.users.find(u => u.id === id);
    if (!u) return;
    const isSuperAdmin = AppState.user.role === 'superadmin';
    // 只有 superadmin 且目標非 superadmin 才能改角色
    const canChangeRole = isSuperAdmin && u.role !== 'superadmin';
    const roleSection = canChangeRole ? `
      <div>
        <label class="form-label">身分</label>
        <select class="form-select" id="uEditRole">
          <option value="student" ${u.role==='student'?'selected':''}>學生</option>
          <option value="teacher" ${u.role==='teacher'?'selected':''}>老師</option>
        </select>
      </div>` : '';
    Modal.open('編輯使用者', `
      <div class="modal-form">
        <p style="color:#94A3B8;font-size:0.85rem">帳號：<strong>${escapeHtml(u.username)}</strong></p>
        <div>
          <label class="form-label">顯示名稱</label>
          <input type="text" class="form-input" id="uEditName" value="${escapeHtml(u.display_name)}" />
        </div>
        ${roleSection}
        <div>
          <label class="form-label">重設密碼（留空不更改）</label>
          <input type="password" class="form-input" id="uEditPwd" placeholder="留空則不更改密碼" />
        </div>
      </div>
    `, `
      <button class="btn-modal-cancel" onclick="Modal.close()">取消</button>
      <button class="btn-modal-save" onclick="AdminUsers.updateUser(${id})">儲存</button>
    `);
  },

  async createUser() {
    const username = document.getElementById('uUsername').value.trim();
    const password = document.getElementById('uPassword').value;
    const display_name = document.getElementById('uDisplayName').value.trim();
    const role = document.getElementById('uRole').value;
    if (!username || !password || !display_name) { Toast.warning('請填寫所有欄位'); return; }
    try {
      await API.users.create({ username, password, display_name, role });
      Toast.success('使用者建立成功');
      Modal.close();
      this.load();
    } catch (err) { Toast.error(err.message); }
  },

  async updateUser(id) {
    const display_name = document.getElementById('uEditName').value.trim();
    const new_password = document.getElementById('uEditPwd').value;
    const roleEl = document.getElementById('uEditRole');
    const data = {};
    if (display_name) data.display_name = display_name;
    if (new_password) data.new_password = new_password;
    if (roleEl) data.role = roleEl.value;
    try {
      await API.users.update(id, data);
      Toast.success('使用者更新成功');
      Modal.close();
      this.load();
    } catch (err) { Toast.error(err.message); }
  },

  async confirmDelete(id) {
    const u = this.users.find(u => u.id === id);
    Modal.open('確認刪除使用者', `
      <p style="color:#FCA5A5">確定要刪除使用者「${escapeHtml(u?.display_name||'')}（${escapeHtml(u?.username||'')}）」嗎？</p>
    `, `
      <button class="btn-modal-cancel" onclick="Modal.close()">取消</button>
      <button class="btn-modal-delete" onclick="AdminUsers.doDelete(${id})">確認刪除</button>
    `);
  },

  async doDelete(id) {
    try {
      await API.users.delete(id);
      Modal.close();
      Toast.success('使用者已刪除');
      this.load();
    } catch (err) { Toast.error(err.message); }
  }
};

// ─── 科目管理 ─────────────────────────────────────────
const AdminSubjects = {
  subjects: [],

  async load() {
    const wrapper = document.getElementById('subjectsTable');
    if (!wrapper) return;
    wrapper.innerHTML = '<div style="padding:24px;text-align:center"><div class="loading-spinner" style="width:28px;height:28px;margin:0 auto"></div></div>';
    try {
      this.subjects = await API.admin.subjects();
      this._renderTable();
    } catch (err) {
      wrapper.innerHTML = `<div class="empty-state"><p>載入失敗：${escapeHtml(err.message)}</p></div>`;
    }
  },

  _renderTable() {
    const wrapper = document.getElementById('subjectsTable');
    if (!wrapper) return;
    if (this.subjects.length === 0) {
      wrapper.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📂</div><h3>尚未建立任何科目</h3><p>點擊右上角「新增科目」開始建立</p></div>';
      return;
    }
    // 找出英文科目（用於顯示同步按鈕）
    const engSubject = this.subjects.find(s => s.name.includes('英文'));
    const syncBtnHTML = engSubject ? `
      <div style="margin-bottom:12px;display:flex;align-items:center;gap:10px;flex-wrap:wrap">
        <span style="font-size:0.82rem;color:#94A3B8">🔤 英文單字題庫（${engSubject.question_count} 題）</span>
        <button class="btn-tbl-edit" id="btnSyncVocab" onclick="AdminSubjects.syncVocabulary()"
          style="background:linear-gradient(135deg,#7C3AED,#6D28D9);color:#fff;border:none">
          🔄 重新同步單字題庫
        </button>
        <span style="font-size:0.75rem;color:#64748B">（將以最新 vocabulary.js 重建所有英文題目）</span>
      </div>
    ` : '';
    wrapper.innerHTML = syncBtnHTML + `
      <div class="table-wrapper">
        <table class="data-table">
          <thead><tr>
            <th>圖示</th><th>科目名稱</th><th>英文名稱</th><th>題目數</th><th>考試數</th><th>狀態</th><th>操作</th>
          </tr></thead>
          <tbody>
            ${this.subjects.map(s => `
              <tr>
                <td style="font-size:1.5rem;text-align:center">${escapeHtml(s.icon || '📚')}</td>
                <td><strong>${escapeHtml(s.name)}</strong>${s.description ? `<br><span style="font-size:0.75rem;color:#94A3B8">${escapeHtml(s.description.slice(0,40))}${s.description.length>40?'…':''}</span>` : ''}</td>
                <td style="color:#94A3B8">${escapeHtml(s.name_en || '—')}</td>
                <td style="text-align:center">${s.question_count}</td>
                <td style="text-align:center">${s.exam_count}</td>
                <td>${s.is_active ? '<span class="tag-active">啟用</span>' : '<span class="tag-inactive">停用</span>'}</td>
                <td>
                  <button class="btn-tbl-edit"   onclick="AdminSubjects.openEditModal(${s.id})">✏️ 編輯</button>
                  <button class="btn-tbl-toggle" onclick="AdminSubjects.toggle(${s.id})">${s.is_active ? '🔇 停用' : '✅ 啟用'}</button>
                  <button class="btn-tbl-delete" onclick="AdminSubjects.confirmDelete(${s.id})">🗑️ 刪除</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  },

  async syncVocabulary() {
    const btn = document.getElementById('btnSyncVocab');
    if (btn) { btn.disabled = true; btn.textContent = '⏳ 同步中...'; }
    try {
      Loading.show('正在重建英文單字題庫，請稍候...');
      const result = await API.admin.syncVocabulary();
      Toast.success(result.message, 5000);
      await this.load(); // 重新整理表格
    } catch (err) {
      Toast.error('同步失敗：' + err.message);
      if (btn) { btn.disabled = false; btn.textContent = '🔄 重新同步單字題庫'; }
    } finally {
      Loading.hide();
    }
  },

  async toggle(id) {
    try {
      const res = await API.admin.toggleSubject(id);
      Toast.success(res.message);
      await this.load();
      await loadSubjects(); // 同步更新全域 AppState.subjects
    } catch (err) { Toast.error(err.message); }
  },

  openAddModal()    { this._openModal(null); },
  openEditModal(id) { this._openModal(this.subjects.find(s => s.id === id)); },

  _openModal(s) {
    const isEdit = !!s;
    Modal.open(isEdit ? '編輯科目' : '新增科目', `
      <div class="modal-form">
        <div class="form-row" style="grid-template-columns:80px 1fr;gap:12px;align-items:end">
          <div>
            <label class="form-label">圖示 (emoji)</label>
            <input type="text" class="form-input" id="sIcon" maxlength="4"
              value="${escapeHtml(s?.icon || '📚')}"
              style="font-size:1.6rem;text-align:center;padding:6px" />
          </div>
          <div>
            <label class="form-label">科目名稱 <span style="color:#EF4444">*</span></label>
            <input type="text" class="form-input" id="sName"
              value="${escapeHtml(s?.name || '')}" placeholder="例：數學、歷史、英文…" />
          </div>
        </div>
        <div>
          <label class="form-label">英文名稱（選填）</label>
          <input type="text" class="form-input" id="sNameEn"
            value="${escapeHtml(s?.name_en || '')}" placeholder="e.g. Mathematics" />
        </div>
        <div>
          <label class="form-label">說明（選填）</label>
          <textarea class="form-textarea" id="sDesc" rows="2"
            placeholder="簡短描述此科目的內容範圍…">${escapeHtml(s?.description || '')}</textarea>
        </div>
      </div>
    `, `
      <button class="btn-modal-cancel" onclick="Modal.close()">取消</button>
      <button class="btn-modal-save" onclick="AdminSubjects.save(${s?.id || 'null'})">${isEdit ? '儲存變更' : '新增科目'}</button>
    `);
    setTimeout(() => document.getElementById('sName')?.focus(), 100);
  },

  async save(editId) {
    const name        = document.getElementById('sName').value.trim();
    const name_en     = document.getElementById('sNameEn').value.trim();
    const description = document.getElementById('sDesc').value.trim();
    const icon        = document.getElementById('sIcon').value.trim();
    if (!name) { Toast.warning('請填寫科目名稱'); return; }
    try {
      const data = { name, name_en, description, icon: icon || '📚' };
      if (editId) {
        await API.admin.updateSubject(editId, data);
        Toast.success('科目更新成功');
      } else {
        await API.admin.createSubject(data);
        Toast.success('科目新增成功');
      }
      Modal.close();
      await this.load();
      await loadSubjects(); // 同步更新全域下拉選單
    } catch (err) { Toast.error(err.message); }
  },

  confirmDelete(id) {
    const s = this.subjects.find(s => s.id === id);
    if (!s) return;

    // 有考試 → 一定不能刪
    if (Number(s.exam_count) > 0) {
      Modal.open('無法刪除科目', `
        <p style="color:#FCA5A5;margin-bottom:12px">⚠️ 此科目仍有 <strong>${s.exam_count}</strong> 場考試關聯。</p>
        <p style="font-size:0.85rem;color:#94A3B8">請先至「考試管理」刪除相關考試後再移除科目。</p>
      `, `<button class="btn-modal-cancel" onclick="Modal.close()">了解</button>`);
      return;
    }

    // 有題目 → 詢問是否一併刪除
    if (Number(s.question_count) > 0) {
      Modal.open('⚠️ 確認強制刪除科目', `
        <p style="color:#FCA5A5;margin-bottom:12px">此科目包含 <strong style="color:#FCD34D">${s.question_count}</strong> 題題目。</p>
        <p style="margin-bottom:16px">選擇「連同題目一起刪除」將<strong>永久移除</strong>科目及其所有題目，此操作<strong style="color:#FCA5A5">無法復原</strong>！</p>
        <div style="background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.2);border-radius:8px;padding:12px;font-size:0.85rem;color:#FCA5A5">
          🗑️ 即將刪除：科目「${escapeHtml(s.name)}」+ ${s.question_count} 題題目
        </div>
      `, `
        <button class="btn-modal-cancel" onclick="Modal.close()">取消</button>
        <button class="btn-modal-delete" onclick="AdminSubjects.doDelete(${id}, true)">🗑️ 連同題目一起刪除</button>
      `);
      return;
    }

    // 無題目無考試 → 直接刪
    Modal.open('確認刪除科目', `
      <p style="color:#FCA5A5;margin-bottom:8px">⚠️ 此操作無法復原！</p>
      <p>確定要刪除科目「<strong>${escapeHtml(s.name)}</strong>」嗎？</p>
    `, `
      <button class="btn-modal-cancel" onclick="Modal.close()">取消</button>
      <button class="btn-modal-delete" onclick="AdminSubjects.doDelete(${id}, false)">確認刪除</button>
    `);
  },

  async doDelete(id, cascade = false) {
    try {
      const res = await API.admin.deleteSubject(id, cascade);
      Modal.close();
      Toast.success(res.message);
      await this.load();
      await loadSubjects();
    } catch (err) {
      Modal.close();
      Toast.error(err.message);
    }
  }
};

// ─── 錯題分析模組 ──────────────────────────────────
const AdminAttempts = {
  allAttempts: [],
  exams: [],
  students: [],

  async load() {
    const wrapper = document.getElementById('attemptsTable');
    wrapper.innerHTML = '<div style="padding:24px;text-align:center"><div class="loading-spinner" style="width:28px;height:28px;margin:0 auto"></div></div>';

    try {
      const [attemptsData, exams, students] = await Promise.all([
        API.admin.attempts({ limit: 200 }),
        API.exams.list(),
        API.admin.students()
      ]);

      this.allAttempts = attemptsData.attempts;
      this.exams = exams;
      this.students = students;

      // 填充篩選選單
      const examSel = document.getElementById('attFilterExam');
      if (examSel) {
        const uniqueExams = [...new Map(this.allAttempts.map(a => [a.exam_id, a])).values()];
        examSel.innerHTML = '<option value="">全部考試</option>' +
          uniqueExams.map(a => `<option value="${a.exam_id}">${escapeHtml(a.exam_title)}</option>`).join('');
      }
      const stuSel = document.getElementById('attFilterStudent');
      if (stuSel) {
        const uniqueStudents = [...new Map(this.allAttempts.map(a => [a.user_id, a])).values()];
        stuSel.innerHTML = '<option value="">全部學生</option>' +
          uniqueStudents.map(a => `<option value="${a.user_id}">${escapeHtml(a.display_name)}</option>`).join('');
      }

      this._renderTable(this.allAttempts);
    } catch (err) {
      wrapper.innerHTML = `<div class="empty-state"><p>載入失敗：${escapeHtml(err.message)}</p></div>`;
    }
  },

  applyFilter() {
    const examId = document.getElementById('attFilterExam')?.value || '';
    const stuId = document.getElementById('attFilterStudent')?.value || '';
    let filtered = this.allAttempts;
    if (examId) filtered = filtered.filter(a => String(a.exam_id) === examId);
    if (stuId) filtered = filtered.filter(a => String(a.user_id) === stuId);
    this._renderTable(filtered);
  },

  _renderTable(attempts) {
    const wrapper = document.getElementById('attemptsTable');
    if (!wrapper) return;

    if (attempts.length === 0) {
      wrapper.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📭</div><h3>沒有符合條件的記錄</h3></div>';
      return;
    }

    wrapper.innerHTML = `
      <p style="font-size:0.8rem;color:#64748B;margin-bottom:12px">共 ${attempts.length} 筆作答記錄 — 點擊「詳情」查看具體錯題</p>
      <div class="table-wrapper">
        <table class="data-table">
          <thead><tr>
            <th>學生</th><th>考試</th><th>科目</th><th>分數</th>
            <th>正確/總題</th><th>用時</th><th>提交時間</th><th>操作</th>
          </tr></thead>
          <tbody>
            ${attempts.map(a => `
              <tr>
                <td>
                  <span style="display:inline-flex;align-items:center;gap:8px">
                    ${AvatarUtil.toHTML({ display_name: a.display_name, avatar_color: a.avatar_color, avatar_image: a.avatar_image }, 28)}
                    <span>
                      <div style="font-weight:600">${escapeHtml(a.display_name)}</div>
                      <div style="font-size:0.72rem;color:#94A3B8">@${escapeHtml(a.username || '')}</div>
                    </span>
                  </span>
                </td>
                <td style="max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(a.exam_title)}</td>
                <td>${a.subject_icon || ''} ${escapeHtml(a.subject_name || '')}</td>
                <td><strong style="color:${a.score >= 60 ? '#10B981' : '#EF4444'};font-size:1rem">${a.score}分</strong></td>
                <td>${a.correct_count}/${a.total_questions}</td>
                <td>${formatDuration(a.time_spent_seconds)}</td>
                <td style="font-size:0.78rem">${formatDate(a.submitted_at)}</td>
                <td><button class="btn-tbl-edit" onclick="AdminAttempts.showDetail(${a.id})">🔍 詳情</button></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  },

  async showDetail(attemptId) {
    Loading.show('載入錯題詳情...');
    try {
      const data = await API.admin.attemptDetail(attemptId);
      Loading.hide();

      const { user, exam, score, correct_count, total_questions, time_spent_seconds, submitted_at, passed, results } = data;

      const wrongCount = results.filter(r => !r.is_correct).length;
      const avatarHTML = AvatarUtil.toHTML(user, 52);

      const questionsHTML = results.map((r, idx) => `
        <div class="attempt-question-card ${r.is_correct ? 'correct' : 'wrong'}">
          <div class="aqc-header">
            <span class="aqc-idx">${idx + 1}</span>
            <span class="aqc-type">${r.type === 'choice' ? '選擇題' : '填充題'}</span>
            <span class="aqc-level">Lv.${r.level}</span>
            <span class="aqc-result ${r.is_correct ? 'correct' : 'wrong'}">
              ${r.is_correct ? '✅ 正確' : '❌ 錯誤'}
            </span>
          </div>
          <div class="aqc-question">${escapeHtml(r.question_text)}</div>
          ${r.options ? `
            <div class="aqc-options">
              ${r.options.map(o => `
                <div class="aqc-option ${o === r.correct_answer ? 'correct-opt' : ''} ${o === r.user_answer && !r.is_correct ? 'wrong-opt' : ''}">
                  ${o === r.correct_answer ? '✅ ' : o === r.user_answer && !r.is_correct ? '❌ ' : '⬜ '}${escapeHtml(o)}
                </div>
              `).join('')}
            </div>
          ` : ''}
          ${!r.is_correct ? `
            <div class="aqc-answers">
              <div class="aqc-user-answer">
                <span class="label">學生填寫：</span>
                <span class="value wrong-text">${r.user_answer ? escapeHtml(r.user_answer) : '<em>（未作答）</em>'}</span>
              </div>
              <div class="aqc-correct-answer">
                <span class="label">正確答案：</span>
                <span class="value correct-text">${escapeHtml(r.correct_answer)}</span>
              </div>
            </div>
          ` : ''}
          ${r.explanation ? `<div class="aqc-explanation">💡 ${escapeHtml(r.explanation)}</div>` : ''}
        </div>
      `).join('');

      Modal.open(`📋 ${escapeHtml(exam.title)} — 作答詳情`, `
        <div class="attempt-detail-header">
          <div class="adh-user">
            ${avatarHTML}
            <div>
              <div class="adh-name">${escapeHtml(user.display_name)}</div>
              <div class="adh-username">@${escapeHtml(user.username)}</div>
            </div>
          </div>
          <div class="adh-stats">
            <div class="adh-stat">
              <span class="val" style="color:${passed ? '#10B981' : '#EF4444'}">${score}分</span>
              <span class="lbl">${passed ? '✅ 及格' : '❌ 不及格'}</span>
            </div>
            <div class="adh-stat">
              <span class="val">${correct_count}/${total_questions}</span>
              <span class="lbl">答對題數</span>
            </div>
            <div class="adh-stat">
              <span class="val" style="color:#EF4444">${wrongCount}</span>
              <span class="lbl">答錯題數</span>
            </div>
            <div class="adh-stat">
              <span class="val">${formatDuration(time_spent_seconds)}</span>
              <span class="lbl">作答用時</span>
            </div>
          </div>
          <div style="font-size:0.78rem;color:#64748B;margin-top:8px">
            ${exam.subject_icon || ''} ${escapeHtml(exam.subject_name)} ｜ 提交於 ${formatDate(submitted_at)}
          </div>
        </div>
        <div class="attempt-questions-list">
          ${wrongCount === 0
            ? '<div style="text-align:center;padding:24px;color:#10B981;font-size:1.05rem">🎉 全部答對！完美成績！</div>'
            : `<h4 style="color:#FCD34D;margin-bottom:12px">❌ 錯誤題目（${wrongCount} 題）</h4>` + results.filter(r => !r.is_correct).map((r, idx) => `
              <div class="attempt-question-card wrong">
                <div class="aqc-header">
                  <span class="aqc-type">${r.type === 'choice' ? '選擇題' : '填充題'}</span>
                  <span class="aqc-level">Lv.${r.level}</span>
                  <span class="aqc-result wrong">❌ 錯誤</span>
                </div>
                <div class="aqc-question">${escapeHtml(r.question_text)}</div>
                ${r.options ? `
                  <div class="aqc-options">
                    ${r.options.map(o => `
                      <div class="aqc-option ${o === r.correct_answer ? 'correct-opt' : ''} ${o === r.user_answer ? 'wrong-opt' : ''}">
                        ${o === r.correct_answer ? '✅ ' : o === r.user_answer ? '❌ ' : '⬜ '}${escapeHtml(o)}
                      </div>
                    `).join('')}
                  </div>
                ` : ''}
                <div class="aqc-answers">
                  <div class="aqc-user-answer">
                    <span class="label">學生填寫：</span>
                    <span class="value wrong-text">${r.user_answer ? escapeHtml(r.user_answer) : '<em>（未作答）</em>'}</span>
                  </div>
                  <div class="aqc-correct-answer">
                    <span class="label">正確答案：</span>
                    <span class="value correct-text">${escapeHtml(r.correct_answer)}</span>
                  </div>
                </div>
                ${r.explanation ? `<div class="aqc-explanation">💡 ${escapeHtml(r.explanation)}</div>` : ''}
              </div>
            `).join('')
          }
          ${results.filter(r => r.is_correct).length > 0 ? `
            <h4 style="color:#10B981;margin:16px 0 12px">✅ 答對題目（${results.filter(r => r.is_correct).length} 題）</h4>
            ${results.filter(r => r.is_correct).map(r => `
              <div class="attempt-question-card correct">
                <div class="aqc-header">
                  <span class="aqc-type">${r.type === 'choice' ? '選擇題' : '填充題'}</span>
                  <span class="aqc-level">Lv.${r.level}</span>
                  <span class="aqc-result correct">✅ 正確</span>
                </div>
                <div class="aqc-question">${escapeHtml(r.question_text)}</div>
              </div>
            `).join('')}
          ` : ''}
        </div>
      `, `<button class="btn-modal-cancel" onclick="Modal.close()">關閉</button>`);
    } catch (err) {
      Loading.hide();
      Toast.error('載入詳情失敗：' + err.message);
    }
  }
};
