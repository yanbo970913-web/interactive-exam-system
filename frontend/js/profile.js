/**
 * 個人設定模組 — 支援圖片上傳、Canvas 文字頭像、色彩選擇
 */
const ProfileModule = {
  selectedColor: null,
  pendingAvatarImage: undefined, // undefined = 不更改; null = 移除; string = 新圖片 base64
  colors: ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4', '#F97316', '#EC4899', '#14B8A6', '#6366F1'],

  async load() {
    const user = AppState.user;
    this.selectedColor = user.avatar_color || '#3B82F6';
    this.pendingAvatarImage = undefined;

    // 大頭像預覽
    this._renderLargeAvatar(user);

    document.getElementById('profileDisplayName').textContent = user.display_name;
    document.getElementById('profileUsername').textContent = '@' + user.username;
    const roleEl = document.getElementById('profileRole');
    const roleMap = {
      superadmin: { label: '👑 最高管理員', bg: 'rgba(124,58,237,0.25)', color: '#C4B5FD' },
      teacher:    { label: '🎓 老師',       bg: 'rgba(16,185,129,0.2)',  color: '#34D399' },
      student:    { label: '🎒 學生',       bg: 'rgba(59,130,246,0.2)',  color: '#93C5FD' },
      admin:      { label: '👑 最高管理員', bg: 'rgba(124,58,237,0.25)', color: '#C4B5FD' }, // 舊 token 相容
    };
    const roleInfo = roleMap[user.role] || roleMap.student;
    roleEl.textContent = roleInfo.label;
    roleEl.style.background = roleInfo.bg;
    roleEl.style.color = roleInfo.color;

    document.getElementById('newDisplayName').value = user.display_name;

    // 移除圖片按鈕顯示狀態
    const btnRemove = document.getElementById('btnRemoveAvatar');
    if (btnRemove) btnRemove.style.display = user.avatar_image ? 'inline-flex' : 'none';

    // 顏色選擇器
    const swatches = document.getElementById('colorSwatches');
    swatches.innerHTML = this.colors.map(c =>
      `<div class="color-swatch ${c === this.selectedColor ? 'selected' : ''}"
        style="background:${c}"
        onclick="ProfileModule.pickColor('${c}', this)"
        title="${c}"></div>`
    ).join('');

    await this.loadHistory();
  },

  _renderLargeAvatar(user) {
    const wrap = document.getElementById('avatarPreviewWrap');
    if (!wrap) return;
    wrap.innerHTML = '';
    const imgSrc = AvatarUtil.getSrc(user, 128);
    const img = document.createElement('img');
    img.src = imgSrc;
    img.className = 'profile-avatar-img';
    img.style.cssText = 'width:96px;height:96px;border-radius:50%;object-fit:cover;border:3px solid rgba(99,102,241,0.5)';
    wrap.appendChild(img);

    // 同步更新左側大頭像
    const profileAvatarEl = document.getElementById('profileAvatar');
    if (profileAvatarEl) {
      profileAvatarEl.innerHTML = '';
      const clone = img.cloneNode();
      clone.style.cssText = 'width:80px;height:80px;border-radius:50%;object-fit:cover';
      profileAvatarEl.appendChild(clone);
    }
  },

  pickColor(color, el) {
    this.selectedColor = color;
    document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('selected'));
    el.classList.add('selected');
    // 若目前無上傳圖片且沒有 pendingAvatarImage，則即時更新預覽
    const user = AppState.user;
    if (!user.avatar_image && this.pendingAvatarImage === undefined) {
      this._renderLargeAvatar({ ...user, avatar_color: color });
    }
  },

  handleAvatarUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { Toast.warning('請選擇圖片檔案'); return; }
    if (file.size > 10 * 1024 * 1024) { Toast.warning('圖片大小不能超過 10MB'); return; }

    // 讀取使用者自訂的壓縮尺寸（可自行設定）
    const sizeEl = document.getElementById('avatarMaxSize');
    const maxSize = sizeEl ? parseInt(sizeEl.value) : 400;

    const reader = new FileReader();
    reader.onload = (e) => {
      const raw = e.target.result;
      this._compressImage(raw, maxSize, (compressed) => {
        this.pendingAvatarImage = compressed;
        const wrap = document.getElementById('avatarPreviewWrap');
        wrap.innerHTML = '';
        const img = document.createElement('img');
        img.src = compressed;
        img.className = 'profile-avatar-img';
        img.style.cssText = 'width:96px;height:96px;border-radius:50%;object-fit:cover;border:3px solid #10B981';
        wrap.appendChild(img);
        const btnRemove = document.getElementById('btnRemoveAvatar');
        if (btnRemove) btnRemove.style.display = 'inline-flex';
        const kb = Math.round(compressed.length * 0.75 / 1024);
        Toast.info(`圖片已選取（${maxSize}×${maxSize} px，約 ${kb} KB），按下「儲存設定」即可上傳。`);
      });
    };
    reader.readAsDataURL(file);
  },

  _compressImage(dataURL, maxSize, callback) {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      if (width > maxSize || height > maxSize) {
        const ratio = Math.min(maxSize / width, maxSize / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }
      const canvas = document.createElement('canvas');
      canvas.width = width; canvas.height = height;
      canvas.getContext('2d').drawImage(img, 0, 0, width, height);
      callback(canvas.toDataURL('image/jpeg', 0.85));
    };
    img.src = dataURL;
  },

  removeAvatar() {
    this.pendingAvatarImage = null;
    const user = AppState.user;
    const previewUser = { ...user, avatar_image: null, avatar_color: this.selectedColor };
    this._renderLargeAvatar(previewUser);
    const btnRemove = document.getElementById('btnRemoveAvatar');
    if (btnRemove) btnRemove.style.display = 'none';
    Toast.info('已標記移除頭像，按下「儲存設定」生效。');
  },

  async saveProfile() {
    const display_name = document.getElementById('newDisplayName').value.trim();
    if (!display_name) { Toast.warning('顯示名稱不能為空'); return; }

    const payload = { display_name, avatar_color: this.selectedColor };
    if (this.pendingAvatarImage !== undefined) {
      payload.avatar_image = this.pendingAvatarImage; // null 表示移除
    }

    try {
      Loading.show('儲存中...');
      await API.auth.updateProfile(payload);
      AppState.user.display_name = display_name;
      AppState.user.avatar_color = this.selectedColor;
      if (this.pendingAvatarImage !== undefined) {
        AppState.user.avatar_image = this.pendingAvatarImage;
      }
      this.pendingAvatarImage = undefined;
      Toast.success('個人資料已更新 ✨');
      setupNav(); // 更新導航列頭像
      this.load();
    } catch (err) {
      Toast.error(err.message || '更新失敗');
    } finally {
      Loading.hide();
    }
  },

  async changePassword() {
    const current = document.getElementById('currentPassword').value;
    const newPwd = document.getElementById('newPassword').value;
    const confirm = document.getElementById('confirmNewPassword').value;

    if (!current || !newPwd || !confirm) { Toast.warning('請填寫所有密碼欄位'); return; }
    if (newPwd !== confirm) { Toast.warning('新密碼與確認密碼不一致'); return; }
    if (newPwd.length < 6) { Toast.warning('新密碼長度至少 6 個字元'); return; }

    try {
      await API.auth.changePassword(current, newPwd);
      Toast.success('密碼已成功更改！下次登入請使用新密碼。', 4000);
      document.getElementById('currentPassword').value = '';
      document.getElementById('newPassword').value = '';
      document.getElementById('confirmNewPassword').value = '';
    } catch (err) {
      Toast.error(err.message || '密碼更改失敗');
    }
  },

  async loadHistory() {
    const histEl = document.getElementById('attemptHistory');
    histEl.innerHTML = '<div style="color:#64748B;font-size:0.85rem">載入中...</div>';
    try {
      const exams = await API.exams.list();
      const allAttempts = [];
      for (const exam of exams.filter(e => e.my_attempt_count > 0)) {
        try {
          const attempts = await API.exams.myAttempts(exam.id);
          attempts.forEach(a => allAttempts.push({ ...a, exam_title: exam.title, subject_name: exam.subject_name }));
        } catch (_) {}
      }
      allAttempts.sort((a, b) => new Date(b.submitted_at) - new Date(a.submitted_at));

      if (allAttempts.length === 0) {
        histEl.innerHTML = '<div class="empty-state"><p>尚無作答記錄</p></div>';
        return;
      }
      histEl.innerHTML = allAttempts.slice(0, 20).map(a => `
        <div class="history-item">
          <div>
            <div class="history-exam">${escapeHtml(a.exam_title)}</div>
            <div style="font-size:0.75rem;color:#94A3B8">${escapeHtml(a.subject_name || '')}</div>
          </div>
          <div style="text-align:center">
            <div class="history-score" style="color:${a.score >= 60 ? '#10B981' : '#EF4444'}">${a.score}分</div>
            <div style="font-size:0.72rem;color:#64748B">${a.correct_count}/${a.total_questions} 題正確</div>
          </div>
          <div style="text-align:right">
            <div class="history-date">${formatDate(a.submitted_at)}</div>
            <div style="font-size:0.72rem;color:#64748B">${formatDuration(a.time_spent_seconds)}</div>
          </div>
        </div>
      `).join('');
    } catch (err) {
      histEl.innerHTML = '<div class="empty-state"><p>載入失敗</p></div>';
    }
  }
};
