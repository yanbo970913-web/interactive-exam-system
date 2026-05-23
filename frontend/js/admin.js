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

  async load() {
    await this.applyFilter();
    // 填充科目選單
    const sel = document.getElementById('qFilterSubject');
    sel.innerHTML = '<option value="">全部科目</option>' +
      AppState.subjects.map(s => `<option value="${s.id}">${s.icon} ${escapeHtml(s.name)}</option>`).join('');
  },

  async applyFilter() {
    const subject_id = document.getElementById('qFilterSubject')?.value || '';
    const level = document.getElementById('qFilterLevel')?.value || '';
    const type = document.getElementById('qFilterType')?.value || '';
    const wrapper = document.getElementById('questionsTable');
    if (!wrapper) return;

    wrapper.innerHTML = '<div style="padding:24px;text-align:center"><div class="loading-spinner" style="width:28px;height:28px;margin:0 auto"></div></div>';

    try {
      const params = {};
      if (subject_id) params.subject_id = subject_id;
      if (level) params.level = level;
      if (type) params.type = type;
      params.limit = 200;

      const data = await API.questions.list(params);
      this.questions = data.questions;

      if (this.questions.length === 0) {
        wrapper.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📭</div><h3>沒有符合條件的題目</h3></div>';
        return;
      }

      wrapper.innerHTML = `
        <p style="font-size:0.8rem;color:#64748B;margin-bottom:12px">共 ${data.total} 題</p>
        <div class="table-wrapper">
          <table class="data-table">
            <thead><tr>
              <th>ID</th><th>科目</th><th>等級</th><th>題型</th><th>題目（前40字）</th><th>狀態</th><th>操作</th>
            </tr></thead>
            <tbody>
              ${this.questions.map(q => `
                <tr>
                  <td>${q.id}</td>
                  <td>${escapeHtml(q.subject_name)}</td>
                  <td>Lv.${q.level}</td>
                  <td>${q.type === 'choice' ? '<span class="tag-type-choice">選擇題</span>' : '<span class="tag-type-fill">填充題</span>'}</td>
                  <td style="max-width:300px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(q.question_text.slice(0,60))}${q.question_text.length>60?'…':''}</td>
                  <td>${q.is_active ? '<span class="tag-active">啟用</span>' : '<span class="tag-inactive">停用</span>'}</td>
                  <td>
                    <button class="btn-tbl-edit"   onclick="AdminQuestions.openEditModal(${q.id})">✏️ 編輯</button>
                    <button class="btn-tbl-toggle" onclick="AdminQuestions.toggle(${q.id})">${q.is_active ? '🔇 停用' : '✅ 啟用'}</button>
                    <button class="btn-tbl-delete" onclick="AdminQuestions.confirmDelete(${q.id})">🗑️ 刪除</button>
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

  async toggle(id) {
    try {
      const res = await API.questions.toggle(id);
      Toast.success(res.message);
      this.applyFilter();
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

  async load() {
    const wrapper = document.getElementById('adminExamsTable');
    wrapper.innerHTML = '<div style="padding:24px;text-align:center"><div class="loading-spinner" style="width:28px;height:28px;margin:0 auto"></div></div>';

    try {
      this.exams = await API.exams.list();

      if (this.exams.length === 0) {
        wrapper.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📭</div><h3>尚未建立任何考試</h3></div>';
        return;
      }

      wrapper.innerHTML = `
        <div class="table-wrapper">
          <table class="data-table">
            <thead><tr>
              <th>名稱</th><th>科目</th><th>題數/時長</th><th>開始時間</th><th>截止時間</th><th>狀態</th><th>操作</th>
            </tr></thead>
            <tbody>
              ${this.exams.map(e => `
                <tr>
                  <td><strong>${escapeHtml(e.title)}</strong></td>
                  <td>${e.subject_icon} ${escapeHtml(e.subject_name)}</td>
                  <td>${e.question_count}題 / ${e.duration_minutes}分</td>
                  <td style="font-size:0.8rem">${formatDate(e.start_time)}</td>
                  <td style="font-size:0.8rem">${formatDate(e.end_time)}</td>
                  <td>${e.is_active ? '<span class="tag-active">開放</span>' : '<span class="tag-inactive">關閉</span>'}</td>
                  <td>
                    <button class="btn-tbl-edit"   onclick="AdminExams.openEditModal(${e.id})">✏️ 編輯</button>
                    <button class="btn-tbl-toggle" onclick="AdminExams.toggle(${e.id})">${e.is_active ? '🔇 關閉' : '✅ 開放'}</button>
                    <button class="btn-tbl-delete" onclick="AdminExams.confirmDelete(${e.id})">🗑️ 刪除</button>
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

  async toggle(id) {
    const exam = this.exams.find(e => e.id === id);
    try {
      await API.exams.update(id, { is_active: exam.is_active ? 0 : 1 });
      Toast.success(exam.is_active ? '考試已關閉' : '考試已開放');
      this.load();
    } catch (err) { Toast.error(err.message); }
  },

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

  openAddModal()       { this._openModal(null); },
  openEditModal(id)    { this._openModal(this.exams.find(e => e.id === id)); },

  _openModal(e) {
    const isEdit = !!e;
    const toLocalInput = (iso) => {
      if (!iso) return '';
      return new Date(iso).toISOString().slice(0, 16);
    };
    const subjectOpts = AppState.subjects.map(s =>
      `<option value="${s.id}" ${e && e.subject_id === s.id ? 'selected' : ''}>${s.icon} ${escapeHtml(s.name)}</option>`
    ).join('');

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
            <label class="form-label">難度篩選（用逗號分隔，如 1,2 或 all）</label>
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
        <div>
          <label class="form-label">及格分數（%）</label>
          <input type="number" class="form-input" id="ePassing" min="0" max="100" value="${e?.passing_score||60}" />
        </div>
      </div>
    `, `
      <button class="btn-modal-cancel" onclick="Modal.close()">取消</button>
      <button class="btn-modal-save" onclick="AdminExams.save(${e?.id||'null'})">${isEdit ? '儲存變更' : '建立考試'}</button>
    `);
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

    if (!title) { Toast.warning('請填寫考試名稱'); return; }
    if (start_time && end_time && new Date(start_time) >= new Date(end_time)) {
      Toast.warning('截止時間必須晚於開始時間'); return;
    }

    const toISO = (val) => val ? new Date(val).toISOString() : null;

    try {
      const data = { title, description: desc, subject_id, level_filter, question_count, duration_minutes, start_time: toISO(start_time), end_time: toISO(end_time), passing_score };
      if (editId) {
        await API.exams.update(editId, data);
        Toast.success('考試更新成功');
      } else {
        await API.exams.create(data);
        Toast.success('考試建立成功');
      }
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
                  <td>${u.role === 'admin' ? '<span class="tag-active">管理者</span>' : '<span class="tag-type-fill">學生</span>'}</td>
                  <td style="font-size:0.8rem">${formatDate(u.created_at)}</td>
                  <td>
                    <button class="btn-tbl-edit" onclick="AdminUsers.openEditModal(${u.id})">✏️ 編輯</button>
                    ${u.username !== 'wesley970913' ? `<button class="btn-tbl-delete" onclick="AdminUsers.confirmDelete(${u.id})">🗑️ 刪除</button>` : '<span style="font-size:0.75rem;color:#64748B">（主管理者）</span>'}
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
            <select class="form-select" id="uRole">
              <option value="student">學生</option>
              <option value="admin">管理者</option>
            </select>
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
    Modal.open('編輯使用者', `
      <div class="modal-form">
        <p style="color:#94A3B8;font-size:0.85rem">帳號：<strong>${escapeHtml(u.username)}</strong></p>
        <div>
          <label class="form-label">顯示名稱</label>
          <input type="text" class="form-input" id="uEditName" value="${escapeHtml(u.display_name)}" />
        </div>
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
    const data = {};
    if (display_name) data.display_name = display_name;
    if (new_password) data.new_password = new_password;
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
