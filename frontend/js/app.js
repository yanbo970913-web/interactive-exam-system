/**
 * 應用程式核心 — 路由、狀態、全域工具、Canvas 頭像
 */

// ── 全域狀態 ──────────────────────────────────────────
const AppState = {
  user: null,
  subjects: []
};

// ── Canvas 文字頭像工具 ──────────────────────────────
const AvatarUtil = {
  /**
   * 使用 Canvas 產生 Google 風格的文字頭像 data URL
   * @param {string} displayName  顯示名稱（取第一個字元）
   * @param {string} color        背景色
   * @param {number} size         像素尺寸（輸出圖片的解析度）
   */
  generateDataURL(displayName, color = '#3B82F6', size = 128) {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    // 彩色圓形背景
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
    ctx.fill();

    // 白色文字
    const initial = (displayName || '?').charAt(0).toUpperCase();
    ctx.fillStyle = '#FFFFFF';
    ctx.font = `bold ${Math.round(size * 0.46)}px "Noto Sans TC", "PingFang TC", Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(initial, size / 2, size / 2 + size * 0.03);

    return canvas.toDataURL('image/png');
  },

  /**
   * 產生 <img> 或 <canvas> 頭像 DOM 元素
   * 若 user.avatar_image 存在則顯示上傳圖片；否則用 Canvas 文字頭像
   */
  createElement(user, sizePx = 36) {
    if (user && user.avatar_image) {
      const img = document.createElement('img');
      img.src = user.avatar_image;
      img.alt = user.display_name || user.username;
      img.style.cssText = `width:${sizePx}px;height:${sizePx}px;border-radius:50%;object-fit:cover;flex-shrink:0;`;
      return img;
    }
    const dataURL = this.generateDataURL(
      user ? (user.display_name || user.username) : '?',
      (user && user.avatar_color) || '#3B82F6',
      sizePx * 2
    );
    const img = document.createElement('img');
    img.src = dataURL;
    img.alt = (user && (user.display_name || user.username)) || '?';
    img.style.cssText = `width:${sizePx}px;height:${sizePx}px;border-radius:50%;flex-shrink:0;`;
    return img;
  },

  /**
   * 將 createElement 的結果以 outerHTML 形式回傳（用於 innerHTML 字串插入）
   */
  toHTML(user, sizePx = 36) {
    return this.createElement(user, sizePx).outerHTML;
  },

  /**
   * 取得頭像 src（圖片 URL 或 Canvas data URL）
   */
  getSrc(user, sizePx = 128) {
    if (user && user.avatar_image) return user.avatar_image;
    return this.generateDataURL(
      user ? (user.display_name || user.username) : '?',
      (user && user.avatar_color) || '#3B82F6',
      sizePx
    );
  }
};

// ── Toast 通知 ──────────────────────────────────────
const Toast = {
  show(message, type = 'info', duration = 3500) {
    const container = document.getElementById('toastContainer');
    const icons = { success: '✅', error: '❌', info: 'ℹ️', warning: '⚠️' };
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
      <span class="toast-icon">${icons[type] || 'ℹ️'}</span>
      <span class="toast-message">${message}</span>
    `;
    container.appendChild(toast);
    setTimeout(() => {
      toast.classList.add('removing');
      setTimeout(() => toast.remove(), 300);
    }, duration);
  },
  success: (msg, dur) => Toast.show(msg, 'success', dur),
  error:   (msg, dur) => Toast.show(msg, 'error', dur),
  info:    (msg, dur) => Toast.show(msg, 'info', dur),
  warning: (msg, dur) => Toast.show(msg, 'warning', dur),
};

// ── 載入遮罩 ───────────────────────────────────────
const Loading = {
  show(text = '載入中...') {
    document.getElementById('loadingText').textContent = text;
    document.getElementById('loadingOverlay').classList.remove('hidden');
  },
  hide() {
    document.getElementById('loadingOverlay').classList.add('hidden');
  }
};

// ── Modal ──────────────────────────────────────────
const Modal = {
  open(title, bodyHTML, footerHTML = '') {
    document.getElementById('modalTitle').textContent = title;
    document.getElementById('modalBody').innerHTML = bodyHTML;
    document.getElementById('modalFooter').innerHTML = footerHTML;
    document.getElementById('globalModal').classList.remove('hidden');
  },
  close() {
    document.getElementById('globalModal').classList.add('hidden');
    document.getElementById('modalBody').innerHTML = '';
    document.getElementById('modalFooter').innerHTML = '';
  }
};
document.getElementById('globalModal').addEventListener('click', (e) => {
  if (e.target.id === 'globalModal') Modal.close();
});

// ── Markdown 渲染（輕量版）──────────────────────────
function renderMarkdown(text) {
  if (!text) return '';
  return text
    .replace(/### (.+)/g, '<h3>$1</h3>')
    .replace(/## (.+)/g,  '<h2>$1</h2>')
    .replace(/# (.+)/g,   '<h2>$1</h2>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code>$1</code>')
    .replace(/^- (.+)/gm, '<li>$1</li>')
    .replace(/^(\d+)\. (.+)/gm, '<li>$2</li>')
    .replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/^(?!<[h|u|o|l])(.+)$/gm, (m) => m.trim() ? `<p>${m}</p>` : '')
    .replace(/<\/p><p>/g, '<br>');
}

// ── 路由 / 視圖切換 ─────────────────────────────────
const App = {
  currentView: null,

  navigate(viewId, data = {}) {
    document.querySelectorAll('.view').forEach(v => {
      v.classList.add('hidden');
      v.classList.remove('active');
    });

    const target = document.getElementById(`view-${viewId}`);
    if (!target) return;
    target.classList.remove('hidden');
    target.classList.add('active');
    this.currentView = viewId;
    this.updateNav(viewId);

    const handlers = {
      'exams':             () => ExamsListModule.load(),
      'exam-taking':       () => {},
      'results':           () => {},
      'practice':          () => PracticeModule.init(),
      'profile':           () => ProfileModule.load(),
      'admin-dashboard':   () => AdminDashboard.load(),
      'admin-questions':   () => AdminQuestions.load(),
      'admin-exams':       () => AdminExams.load(),
      'admin-users':       () => AdminUsers.load(),
      'admin-attempts':    () => AdminAttempts.load(),
    };
    if (handlers[viewId]) handlers[viewId](data);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  },

  updateNav(currentView) {
    document.querySelectorAll('.nav-link').forEach(link => {
      const target = link.dataset.view;
      link.classList.toggle('active', target === currentView);
    });
  }
};

// ── 登入 / 登出 ─────────────────────────────────────
function togglePasswordVisibility(inputId) {
  const inp = document.getElementById(inputId);
  inp.type = inp.type === 'password' ? 'text' : 'password';
}

function toggleMobileMenu() {
  const menu = document.getElementById('mobileMenu');
  menu.classList.toggle('hidden');
}

async function initApp() {
  const token = localStorage.getItem('exam_token');
  if (!token) { showLoginPage(); return; }
  try {
    Loading.show('驗證身分中...');
    const user = await API.auth.me();
    AppState.user = user;
    await loadSubjects();
    showAppPage();
  } catch (e) {
    localStorage.removeItem('exam_token');
    showLoginPage();
  } finally {
    Loading.hide();
  }
}

function showLoginPage() {
  document.getElementById('page-login').classList.remove('hidden');
  document.getElementById('page-login').classList.add('active');
  document.getElementById('page-app').classList.add('hidden');
}

function showAppPage() {
  document.getElementById('page-login').classList.add('hidden');
  document.getElementById('page-app').classList.remove('hidden');
  setupNav();
  if (AppState.user.role === 'admin') {
    App.navigate('admin-dashboard');
  } else {
    App.navigate('exams');
  }
}

async function loadSubjects() {
  try { AppState.subjects = await API.questions.subjects(); }
  catch (_) { AppState.subjects = []; }
}

function setupNav() {
  const user = AppState.user;
  const isAdmin = user.role === 'admin';
  const navLinks = document.getElementById('navLinks');
  const mobileMenu = document.getElementById('mobileMenu');

  const links = isAdmin ? [
    { view: 'admin-dashboard',  icon: '📊', label: '總覽' },
    { view: 'admin-questions',  icon: '📝', label: '題庫管理' },
    { view: 'admin-exams',      icon: '🗓️', label: '考試管理' },
    { view: 'admin-users',      icon: '👥', label: '使用者' },
    { view: 'admin-attempts',   icon: '🔍', label: '錯題分析' },
  ] : [
    { view: 'exams',    icon: '📋', label: '考試列表' },
    { view: 'practice', icon: '⚡', label: '快速練習' },
    { view: 'profile',  icon: '👤', label: '個人設定' },
  ];

  const linkHTML = links.map(l =>
    `<button class="nav-link" data-view="${l.view}" onclick="App.navigate('${l.view}')">${l.icon} ${l.label}</button>`
  ).join('');

  navLinks.innerHTML = linkHTML;
  mobileMenu.innerHTML = linkHTML + `<button class="nav-link" onclick="logout()" style="color:#FCA5A5">🚪 登出</button>`;

  // 使用者頭像區（Canvas 文字頭像 / 上傳圖片）
  const avatarHTML = AvatarUtil.toHTML(user, 36);
  document.getElementById('navUser').innerHTML = `
    <div class="nav-avatar-wrap" onclick="App.navigate('profile')" title="${escapeHtml(user.display_name)}" style="cursor:pointer">
      ${avatarHTML}
    </div>
    <span class="user-name" onclick="App.navigate('profile')" style="cursor:pointer">${escapeHtml(user.display_name)}</span>
    <button class="btn-logout" onclick="logout()">登出</button>
  `;
}

function logout() {
  localStorage.removeItem('exam_token');
  AppState.user = null;
  location.reload();
}

// ── 格式化工具 ──────────────────────────────────────
function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d)) return dateStr;
  return d.toLocaleString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function formatDuration(seconds) {
  if (!seconds && seconds !== 0) return '—';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}分 ${s.toString().padStart(2, '0')}秒`;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ── 背景粒子點 ──────────────────────────────────────
function initParticles() {
  const container = document.getElementById('bgParticles');
  for (let i = 0; i < 20; i++) {
    const dot = document.createElement('div');
    const size = Math.random() * 4 + 1;
    dot.style.cssText = `
      position:absolute; border-radius:50%;
      width:${size}px; height:${size}px;
      background: rgba(59,130,246,${Math.random() * 0.3 + 0.05});
      left:${Math.random() * 100}%; top:${Math.random() * 100}%;
      animation: particleFloat ${Math.random() * 20 + 15}s ease-in-out ${Math.random() * 5}s infinite alternate;
    `;
    container.appendChild(dot);
  }
  const style = document.createElement('style');
  const tx = Math.random() * 40 - 20, ty = Math.random() * 40 - 20;
  style.textContent = `@keyframes particleFloat { from{transform:translate(0,0)} to{transform:translate(${tx}px,${ty}px)} }`;
  document.head.appendChild(style);
}

// ── 煙火 / 彩帶特效 ────────────────────────────────
function launchConfetti(duration = 2800) {
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:9999';
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  const pieces = Array.from({ length: 120 }, () => ({
    x: Math.random() * canvas.width,
    y: Math.random() * canvas.height - canvas.height,
    w: Math.random() * 10 + 5,
    h: Math.random() * 6 + 3,
    color: `hsl(${Math.random() * 360},80%,60%)`,
    vx: (Math.random() - 0.5) * 3,
    vy: Math.random() * 4 + 2,
    angle: Math.random() * Math.PI * 2,
    spin: (Math.random() - 0.5) * 0.2,
    alpha: 1
  }));

  const start = performance.now();
  function draw(now) {
    const elapsed = now - start;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const fadeStart = duration * 0.6;
    pieces.forEach(p => {
      p.x += p.vx; p.y += p.vy; p.vy += 0.08; p.angle += p.spin;
      if (elapsed > fadeStart) p.alpha = Math.max(0, 1 - (elapsed - fadeStart) / (duration - fadeStart));
      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.translate(p.x + p.w / 2, p.y + p.h / 2);
      ctx.rotate(p.angle);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    });
    if (elapsed < duration) requestAnimationFrame(draw);
    else canvas.remove();
  }
  requestAnimationFrame(draw);
}

// ── 防切換分頁偵測（考試防作弊）───────────────────
let _cheatWarnings = 0;
function initAntiCheat() {
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && App.currentView === 'exam-taking') {
      _cheatWarnings++;
      if (_cheatWarnings === 1) {
        Toast.warning('⚠️ 偵測到切換分頁！第 1 次警告。請勿離開考試視窗。', 5000);
      } else if (_cheatWarnings === 2) {
        Toast.warning('🚨 第 2 次警告！繼續切換將強制交卷。', 5000);
      } else {
        Toast.error('🚫 已偵測到多次切換視窗，強制交卷！', 4000);
        setTimeout(() => {
          if (typeof ExamModule !== 'undefined' && App.currentView === 'exam-taking') {
            ExamModule.doSubmit(true);
          }
        }, 1500);
      }
    }
  });
}

// ── 登入表單 ────────────────────────────────────────
document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const username = document.getElementById('loginUsername').value.trim();
  const password = document.getElementById('loginPassword').value;
  const errEl = document.getElementById('loginError');

  errEl.classList.add('hidden');
  const btn = e.target.querySelector('.btn-login');
  btn.disabled = true;
  btn.querySelector('.btn-text').textContent = '驗證中...';

  try {
    const res = await API.auth.login(username, password);
    localStorage.setItem('exam_token', res.token);
    AppState.user = res.user;
    await loadSubjects();
    showAppPage();
  } catch (err) {
    errEl.textContent = err.message || '登入失敗，請確認帳號密碼';
    errEl.classList.remove('hidden');
    btn.disabled = false;
    btn.querySelector('.btn-text').textContent = '登入系統';
    const card = document.querySelector('.login-card');
    card.style.animation = 'shake 0.4s ease';
    setTimeout(() => card.style.animation = '', 400);
  }
});

const shakeStyle = document.createElement('style');
shakeStyle.textContent = `
  @keyframes shake {
    0%,100%{transform:translateX(0)}
    20%{transform:translateX(-10px)}
    40%{transform:translateX(10px)}
    60%{transform:translateX(-6px)}
    80%{transform:translateX(6px)}
  }
`;
document.head.appendChild(shakeStyle);

// ── 啟動 ────────────────────────────────────────────
initParticles();
initAntiCheat();
initApp();
