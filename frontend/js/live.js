/**
 * 即時作答進度監控模組
 * 使用 Server-Sent Events (SSE) 訂閱 /api/live/stream
 * 管理者/老師在「即時監控」頁面即時看到所有在考學生的進度
 */
const AdminLiveProgress = {
  _evtSource: null,
  _retryCount: 0,
  _maxRetry: 10,
  _retryDelay: 3000,
  _retryTimer: null,
  _active: false,
  _lastData: [],

  /* ── 進入監控頁面時呼叫 ── */
  enter() {
    this._active = true;
    this._retryCount = 0;
    this._connect();
  },

  /* ── 離開監控頁面時呼叫 ── */
  leave() {
    this._active = false;
    this._disconnect();
    if (this._retryTimer) {
      clearTimeout(this._retryTimer);
      this._retryTimer = null;
    }
  },

  /* ── 手動刷新（重新連接）── */
  refresh() {
    this._retryCount = 0;
    this._disconnect();
    this._connect();
    Toast.info('🔄 重新連接中...');
  },

  /* ── 建立 SSE 連接 ── */
  _connect() {
    if (!this._active) return;
    this._disconnect();

    this._setBadge('connecting');

    const token = localStorage.getItem('exam_token');
    if (!token) { this._setBadge('error'); return; }

    // EventSource 不直接支援自訂 Header，
    // 改用帶 token 的 query string（後端需支援）
    // 或改用 fetch + ReadableStream（更靈活）
    this._connectViaFetch(token);
  },

  /* ── 使用 fetch + ReadableStream 讀取 SSE ── */
  async _connectViaFetch(token) {
    try {
      const res = await fetch('/api/live/stream', {
        headers: { 'Authorization': `Bearer ${token}` },
        signal: (this._abortCtrl = new AbortController()).signal
      });

      if (!res.ok) {
        this._onError(`HTTP ${res.status}`);
        return;
      }

      this._setBadge('connected');
      this._retryCount = 0;

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (this._active) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop(); // 保留不完整行

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith('data: ')) {
            const jsonStr = trimmed.slice(6);
            try {
              const data = JSON.parse(jsonStr);
              this._render(data);
            } catch (_) {}
          }
          // 忽略 `: ping` keepalive 行
        }
      }

      // 連接正常關閉
      if (this._active) {
        this._scheduleRetry();
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        this._onError(err.message);
      }
    }
  },

  _disconnect() {
    if (this._abortCtrl) {
      this._abortCtrl.abort();
      this._abortCtrl = null;
    }
  },

  _onError(msg) {
    console.warn('[LiveProgress] 連接錯誤:', msg);
    this._setBadge('error');
    if (this._active) this._scheduleRetry();
  },

  _scheduleRetry() {
    if (!this._active || this._retryCount >= this._maxRetry) {
      if (this._retryCount >= this._maxRetry) {
        this._setBadge('error');
        Toast.warning('即時監控連接失敗，請手動刷新');
      }
      return;
    }
    this._retryCount++;
    const delay = Math.min(this._retryDelay * this._retryCount, 30000);
    this._retryTimer = setTimeout(() => {
      if (this._active) this._connect();
    }, delay);
  },

  _setBadge(state) {
    const badge = document.getElementById('liveConnectionBadge');
    if (!badge) return;
    badge.className = 'live-badge';
    switch (state) {
      case 'connected':
        badge.classList.add('live-badge-connected');
        badge.textContent = '🟢 即時連線中';
        break;
      case 'connecting':
        badge.classList.add('live-badge-connecting');
        badge.textContent = '⏳ 連線中...';
        break;
      case 'error':
        badge.classList.add('live-badge-error');
        badge.textContent = '🔴 連線中斷';
        break;
    }
  },

  /* ── 渲染即時進度列表 ── */
  _render(students) {
    this._lastData = students || [];
    const container = document.getElementById('liveProgressContainer');
    const statsBar   = document.getElementById('liveStatsBar');
    if (!container) return;

    // 統計欄
    if (statsBar) {
      const active = students.length;
      const avgPct = active > 0
        ? Math.round(students.reduce((s, p) => s + (p.current_index / Math.max(p.total - 1, 1)), 0) / active * 100)
        : 0;
      const avgAns = active > 0
        ? Math.round(students.reduce((s, p) => s + p.answered_count, 0) / active)
        : 0;
      statsBar.innerHTML = `
        <div class="live-stat-chip">
          <span class="live-stat-val">${active}</span>
          <span class="live-stat-lbl">在線學生</span>
        </div>
        <div class="live-stat-chip">
          <span class="live-stat-val">${avgPct}%</span>
          <span class="live-stat-lbl">平均進度</span>
        </div>
        <div class="live-stat-chip">
          <span class="live-stat-val">${avgAns}</span>
          <span class="live-stat-lbl">平均已作答</span>
        </div>
      `;
    }

    if (students.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon" style="font-size:3rem">📡</div>
          <h3>目前無學生作答</h3>
          <p>當學生開始考試時，他們的即時進度將出現在這裡</p>
        </div>
      `;
      return;
    }

    container.innerHTML = students.map(p => this._renderCard(p)).join('');
  },

  _renderCard(p) {
    const pct = p.total > 0 ? Math.round((p.current_index + 1) / p.total * 100) : 0;
    const answeredPct = p.total > 0 ? Math.round(p.answered_count / p.total * 100) : 0;
    const elapsed = Math.floor((Date.now() - p.startedAt) / 1000);
    const lastSeenAgo = Math.floor((Date.now() - p.lastSeen) / 1000);
    const isStale = lastSeenAgo > 120; // 超過 2 分鐘沒更新

    const barColor = answeredPct >= 80 ? '#10B981' : answeredPct >= 50 ? '#3B82F6' : '#F59E0B';

    return `
      <div class="live-student-card ${isStale ? 'live-card-stale' : 'live-card-active'}">
        <div class="live-card-header">
          <div class="live-avatar" style="background:${this._strColor(p.display_name)}">
            ${escapeHtml(p.display_name.charAt(0).toUpperCase())}
          </div>
          <div class="live-student-info">
            <div class="live-student-name">${escapeHtml(p.display_name)}</div>
            <div class="live-exam-name">${p.subject_icon || '📚'} ${escapeHtml(p.exam_title)}</div>
          </div>
          <div class="live-card-meta">
            <div class="live-timer">${this._formatElapsed(elapsed)}</div>
            <div class="live-last-seen" style="color:${isStale ? '#EF4444' : '#64748B'}">
              ${isStale ? '⚠️ ' : ''}${lastSeenAgo < 5 ? '剛剛' : lastSeenAgo + 's 前'}
            </div>
          </div>
        </div>

        <div class="live-progress-section">
          <div class="live-progress-labels">
            <span>題目進度 <strong>${p.current_index + 1}</strong> / ${p.total}</span>
            <span>已作答 <strong style="color:${barColor}">${p.answered_count}</strong> / ${p.total}</span>
          </div>
          <div class="live-progress-track">
            <!-- 背景：總題數進度 -->
            <div class="live-progress-bg" style="width:${pct}%"></div>
            <!-- 前景：已作答進度 -->
            <div class="live-progress-answered" style="width:${answeredPct}%;background:${barColor}"></div>
          </div>
          <div class="live-progress-pct">${answeredPct}% 已作答</div>
        </div>

        <div class="live-q-dots">
          ${Array.from({ length: p.total }, (_, i) => {
            let cls = 'live-dot';
            if (i < p.answered_count) cls += ' live-dot-answered';
            if (i === p.current_index) cls += ' live-dot-current';
            return `<div class="${cls}" title="第${i+1}題"></div>`;
          }).join('')}
        </div>
      </div>
    `;
  },

  /* ── 字串轉彩色（頭像用）── */
  _strColor(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
    const hue = Math.abs(hash) % 360;
    return `hsl(${hue}, 55%, 38%)`;
  },

  _formatElapsed(secs) {
    if (secs < 60) return `${secs}s`;
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}m${s.toString().padStart(2,'0')}s`;
  }
};
