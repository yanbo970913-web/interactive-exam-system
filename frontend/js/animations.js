/**
 * animations.js — 趣味互動考試系統 · FX Engine v3
 * ─────────────────────────────────────────────────────────
 * 全新視覺風格：數據矩陣 × 幾何光暈 × 液態動力學
 *
 * SplashScreen   · 8s 科技感開場 (電路 + 數字雨 + 光束掃描)
 * ResultsAnimation · 10s 成績展演 (雷達圖展開 + 晶片爆破)
 * RippleEffect   · 全域點擊水波紋
 * MagneticButton · 磁力按鈕 (80px 吸附)
 * CardTilt3D     · 3D 卡片物理傾斜
 * NumberCounter  · 平滑數字滾動
 * AmbientParticles · 背景浮游粒子
 */

/* ══════════════════════════════════════════════════════════
   MATH UTILITIES
══════════════════════════════════════════════════════════ */
const _easeOut3  = t => 1 - Math.pow(1 - t, 3);
const _easeOut5  = t => 1 - Math.pow(1 - t, 5);
const _easeElastic = t => {
  if (t === 0 || t === 1) return t;
  return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * (2 * Math.PI / 3)) + 1;
};
const _lerp = (a, b, t) => a + (b - a) * t;
const _clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const _rand  = (a, b) => a + Math.random() * (b - a);
const _randInt = (a, b) => Math.floor(_rand(a, b + 1));

function _animate({ duration, easing = _easeOut3, onUpdate, onDone }) {
  const t0 = performance.now();
  const tick = now => {
    const raw = _clamp((now - t0) / duration, 0, 1);
    onUpdate(easing(raw), raw);
    if (raw < 1) requestAnimationFrame(tick);
    else if (onDone) onDone();
  };
  requestAnimationFrame(tick);
}

/* ══════════════════════════════════════════════════════════
   1. SPLASH SCREEN — 8s 科技開場
   風格：電路板掃描線 + 矩陣數字雨 + 光束
══════════════════════════════════════════════════════════ */
const SplashScreen = (() => {
  let canvas, ctx, W, H, rafId;
  let t0 = 0;
  const DURATION = 8000;

  /* ── 矩陣數字雨柱 ── */
  const CHARS = '0123456789ABCDEF考試系統互動';
  class MatrixColumn {
    constructor() { this.reset(true); }
    reset(init = false) {
      this.x      = _randInt(0, Math.floor((W || 800) / 16)) * 16;
      this.y      = init ? _rand(-H, 0) : -_rand(20, 60) * 18;
      this.speed  = _rand(0.8, 2.2);
      this.len    = _randInt(8, 22);
      this.chars  = Array.from({length: this.len}, () => CHARS[_randInt(0, CHARS.length-1)]);
      this.hue    = _rand(160, 200);
      this.alpha  = _rand(0.4, 0.9);
      this.tick   = 0;
    }
    update() {
      this.y += this.speed;
      this.tick++;
      if (this.tick % 8 === 0) {
        const r = _randInt(0, this.len - 1);
        this.chars[r] = CHARS[_randInt(0, CHARS.length - 1)];
      }
      if (this.y > H + this.len * 18) this.reset();
    }
    draw() {
      for (let i = 0; i < this.len; i++) {
        const cy  = this.y + i * 18;
        if (cy < -18 || cy > H + 18) continue;
        const fade = i / this.len;
        const bright = i === this.len - 1 ? 1 : 0.15 + fade * 0.6;
        ctx.fillStyle = `hsla(${this.hue},90%,${i === this.len-1 ? 95 : 55}%,${this.alpha * bright})`;
        if (i === this.len - 1) {
          ctx.shadowColor = `hsl(${this.hue},100%,80%)`;
          ctx.shadowBlur  = 10;
        } else {
          ctx.shadowBlur  = 0;
        }
        ctx.fillText(this.chars[i], this.x, cy);
      }
      ctx.shadowBlur = 0;
    }
  }

  /* ── 電路節點 ── */
  class CircuitNode {
    constructor() {
      this.x = _rand(W * 0.1, W * 0.9);
      this.y = _rand(H * 0.1, H * 0.9);
      this.r = _rand(2, 5);
      this.pulse = _rand(0, Math.PI * 2);
      this.hue = _rand(180, 220);
      this.connections = [];
    }
    draw(t) {
      const p = Math.sin(this.pulse + t * 2) * 0.5 + 0.5;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.r + p * 2, 0, Math.PI * 2);
      ctx.fillStyle = `hsla(${this.hue},90%,70%,${0.4 + p * 0.5})`;
      ctx.shadowColor = `hsl(${this.hue},100%,70%)`;
      ctx.shadowBlur  = 8 + p * 12;
      ctx.fill();
      ctx.shadowBlur  = 0;
    }
  }

  /* ── 掃描光束 ── */
  let scanY = -100;
  function drawScanLine(globalT) {
    scanY = (globalT * 0.08 % 1.4 - 0.2) * H;
    const grad = ctx.createLinearGradient(0, scanY - 40, 0, scanY + 40);
    grad.addColorStop(0,   'rgba(0,200,255,0)');
    grad.addColorStop(0.5, 'rgba(0,200,255,0.06)');
    grad.addColorStop(1,   'rgba(0,200,255,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, scanY - 40, W, 80);

    // bright line
    ctx.strokeStyle = 'rgba(0,220,255,0.35)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, scanY);
    ctx.lineTo(W, scanY);
    ctx.stroke();
  }

  /* ── HUD 角落裝飾 ── */
  function drawHUD() {
    const size = 28, lw = 2;
    ctx.strokeStyle = 'rgba(0,180,255,0.5)';
    ctx.lineWidth = lw;
    // four corners
    const corners = [[0,0],[W,0],[0,H],[W,H]];
    const dirs = [[1,1],[-1,1],[1,-1],[-1,-1]];
    corners.forEach(([cx,cy], i) => {
      const [dx,dy] = dirs[i];
      ctx.beginPath();
      ctx.moveTo(cx + dx * size, cy);
      ctx.lineTo(cx, cy);
      ctx.lineTo(cx, cy + dy * size);
      ctx.stroke();
    });
  }

  let columns = [], nodes = [], edges = [];

  function init() {
    canvas = document.getElementById('splashCanvas');
    if (!canvas) return false;
    ctx = canvas.getContext('2d');
    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;

    ctx.font = '14px "JetBrains Mono", monospace';

    // Create matrix columns
    const cols = Math.floor(W / 16);
    columns = Array.from({ length: Math.floor(cols * 0.4) }, () => new MatrixColumn());

    // Create circuit nodes & edges
    const nodeCount = 18;
    nodes = Array.from({ length: nodeCount }, () => new CircuitNode());
    // Connect nearby nodes
    edges = [];
    for (let i = 0; i < nodeCount; i++) {
      for (let j = i + 1; j < nodeCount; j++) {
        const dx = nodes[i].x - nodes[j].x, dy = nodes[i].y - nodes[j].y;
        if (Math.sqrt(dx*dx + dy*dy) < W * 0.22) edges.push([i, j]);
      }
    }

    return true;
  }

  function drawEdges(elapsed) {
    edges.forEach(([i, j]) => {
      const a = nodes[i], b = nodes[j];
      const p = Math.sin(elapsed * 0.001 + i * 0.5) * 0.5 + 0.5;
      ctx.strokeStyle = `rgba(0,160,255,${0.08 + p * 0.12})`;
      ctx.lineWidth = 0.7;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    });
  }

  function buildSplashText() {
    const el = document.getElementById('splashTitle');
    if (!el || el.children.length) return;
    const TEXT = '趣味互動考試系統';
    el.innerHTML = [...TEXT].map((ch, i) =>
      `<span class="splash-char" style="--i:${i}">${ch}</span>`
    ).join('');
  }

  function frame(now) {
    const elapsed = now - t0;
    const tGlobal = elapsed / 1000; // seconds

    ctx.clearRect(0, 0, W, H);

    // Deep background
    const bgGrad = ctx.createRadialGradient(W/2, H/2, 0, W/2, H/2, Math.max(W,H)*0.8);
    bgGrad.addColorStop(0,   'rgba(2,8,20,0.95)');
    bgGrad.addColorStop(0.6, 'rgba(0,4,12,0.98)');
    bgGrad.addColorStop(1,   '#000408');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, W, H);

    // Phase: matrix rains appear 0-2s
    const matrixAlpha = _clamp(tGlobal / 2, 0, 1) * 0.7;
    ctx.globalAlpha = matrixAlpha;
    columns.forEach(c => { c.update(); c.draw(); });
    ctx.globalAlpha = 1;

    // Circuit nodes + edges
    ctx.globalAlpha = _clamp((tGlobal - 0.5) / 1.5, 0, 1) * 0.85;
    drawEdges(elapsed);
    nodes.forEach(n => n.draw(tGlobal));
    ctx.globalAlpha = 1;

    // Scan line
    if (tGlobal > 1) {
      ctx.globalAlpha = _clamp((tGlobal - 1) / 0.8, 0, 1);
      drawScanLine(tGlobal);
      ctx.globalAlpha = 1;
    }

    // HUD corners
    ctx.globalAlpha = _clamp((tGlobal - 0.2) / 1, 0, 0.7);
    drawHUD();
    ctx.globalAlpha = 1;

    // Center glow
    if (tGlobal > 1.5) {
      const ga = _clamp((tGlobal - 1.5) / 1, 0, 1);
      const g  = ctx.createRadialGradient(W/2, H/2, 0, W/2, H/2, 200);
      g.addColorStop(0,   `rgba(0,160,255,${0.12 * ga})`);
      g.addColorStop(0.5, `rgba(0,100,200,${0.05 * ga})`);
      g.addColorStop(1,   'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }

    // Phase text reveal (handled by CSS, timed triggers)
    if (elapsed >= 2000 && !canvas._p2) { canvas._p2 = true; _triggerPhase2(); }
    if (elapsed >= 3500 && !canvas._p3) { canvas._p3 = true; _triggerPhase3(); }
    if (elapsed >= 5000 && !canvas._p4) { canvas._p4 = true; _triggerPhase4(); }
    if (elapsed >= 6800 && !canvas._p5) { canvas._p5 = true; _triggerPhase5(); }
    if (elapsed >= 7600 && !canvas._p6) { canvas._p6 = true; _triggerPhase6(); }

    if (elapsed < DURATION + 400) rafId = requestAnimationFrame(frame);
  }

  function _triggerPhase2() {
    const logo = document.getElementById('splashLogo');
    if (logo) { logo.style.opacity = '1'; logo.classList.add('splash-logo-in'); }
  }
  function _triggerPhase3() {
    buildSplashText();
    document.querySelectorAll('.splash-char').forEach((el, i) => {
      setTimeout(() => el.classList.add('splash-char-in'), i * 80);
    });
  }
  function _triggerPhase4() {
    const sub = document.getElementById('splashSubtitle');
    const bar = document.getElementById('splashBar');
    const pct = document.getElementById('splashPercent');
    if (sub) sub.classList.add('splash-sub-in');
    if (bar && pct) {
      let p = 0;
      const iv = setInterval(() => {
        p = Math.min(p + _rand(1.2, 3.5), 100);
        bar.style.width = p + '%';
        if (pct) pct.textContent = Math.floor(p) + '%';
        if (p >= 100) clearInterval(iv);
      }, 40);
    }
  }
  function _triggerPhase5() {
    const el = document.getElementById('splashReady');
    if (!el) return;
    el.style.opacity = '1';
    const text = '系統就緒 ✦';
    let i = 0;
    const iv = setInterval(() => {
      el.textContent = text.slice(0, ++i);
      if (i >= text.length) clearInterval(iv);
    }, 60);
  }
  function _triggerPhase6() {
    const splash = document.getElementById('splash-screen');
    if (!splash) return;
    splash.style.transition = 'transform 0.55s cubic-bezier(0.4,0,0.6,1), opacity 0.55s ease';
    splash.style.transform  = 'translateY(-100%)';
    splash.style.opacity    = '0';
    setTimeout(() => { splash.style.display = 'none'; }, 600);
  }

  return {
    show() {
      const splash = document.getElementById('splash-screen');
      if (!splash) return;
      if (!init()) { splash.style.display = 'none'; return; }
      splash.style.display = '';
      t0 = performance.now();
      rafId = requestAnimationFrame(frame);
    },
    hide() {
      cancelAnimationFrame(rafId);
      const splash = document.getElementById('splash-screen');
      if (splash) splash.style.display = 'none';
    }
  };
})();

/* ══════════════════════════════════════════════════════════
   2. RESULTS ANIMATION — 10s 成績展演
   Phase 1 (0-1.5s)  : 黑幕降臨 + 六角形網格掃描
   Phase 2 (1.5-4.5s): 雷達圓環繪製 + 數字疾速累加
   Phase 3 (4.5-6s)  : 等級徽章彈入 (彈性物理)
   Phase 4 (6-8s)    : 通過→粒子爆破 / 未通過→震動
   Phase 5 (8-10s)   : 統計卡片依序浮現 → 淡出進入結果頁
══════════════════════════════════════════════════════════ */
const ResultsAnimation = (() => {
  let overlay, confCanvas, confCtx, rafId;
  let _score = 0, _passed = false, _cb = null;
  let phase = 0, phaseT = 0;
  let hexGrid = [], scoreCountEl, ringEl;
  let confParticles = [];

  /* ── 六角形格子 ── */
  class Hex {
    constructor(x, y, size) {
      this.x = x; this.y = y; this.size = size;
      this.alpha = 0; this.delay = _rand(0, 600);
      this.targetA = _rand(0.04, 0.12);
    }
    update(elapsed) {
      const t = _clamp((elapsed - this.delay) / 800, 0, 1);
      this.alpha = _easeOut3(t) * this.targetA;
    }
    draw(ctx) {
      if (this.alpha < 0.005) return;
      ctx.globalAlpha = this.alpha;
      ctx.strokeStyle = '#00B4FF';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (Math.PI / 3) * i - Math.PI / 6;
        const mx = this.x + this.size * Math.cos(a);
        const my = this.y + this.size * Math.sin(a);
        i === 0 ? ctx.moveTo(mx, my) : ctx.lineTo(mx, my);
      }
      ctx.closePath();
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }

  /* ── 彩色粒子爆破 ── */
  const COLORS = ['#FF6B6B','#FFD93D','#6BCB77','#4D96FF','#FF6BCD','#FFB347','#A78BFA','#34D399'];
  class Burst {
    constructor(x, y) {
      const angle = _rand(0, Math.PI * 2);
      const speed = _rand(3, 12);
      this.x = x; this.y = y;
      this.vx = Math.cos(angle) * speed;
      this.vy = Math.sin(angle) * speed - _rand(1, 5);
      this.w  = _rand(6, 16); this.h = _rand(4, 9);
      this.rot = _rand(0, Math.PI * 2);
      this.drot = _rand(-0.25, 0.25);
      this.color = COLORS[_randInt(0, COLORS.length - 1)];
      this.life = 0; this.maxLife = _randInt(60, 110);
      this.gravity = 0.25;
    }
    update() {
      this.vy += this.gravity;
      this.x  += this.vx; this.y += this.vy;
      this.vx *= 0.985; this.rot += this.drot;
      this.life++;
    }
    draw(ctx) {
      const a = 1 - this.life / this.maxLife;
      ctx.save();
      ctx.globalAlpha = a;
      ctx.translate(this.x, this.y);
      ctx.rotate(this.rot);
      ctx.fillStyle = this.color;
      ctx.fillRect(-this.w/2, -this.h/2, this.w, this.h);
      ctx.restore();
    }
    dead() { return this.life >= this.maxLife; }
  }

  function buildHexGrid(ctx, w, h) {
    hexGrid = [];
    const size = 32, col3 = Math.sqrt(3);
    const rows = Math.ceil(h / (size * 1.5)) + 2;
    const cols = Math.ceil(w / (size * col3)) + 2;
    for (let r = -1; r < rows; r++) {
      for (let c = -1; c < cols; c++) {
        const x = c * size * col3 + (r % 2) * size * col3 / 2;
        const y = r * size * 1.5;
        hexGrid.push(new Hex(x, y, size));
      }
    }
  }

  function getScoreColor(s) {
    if (s >= 90) return '#10B981';
    if (s >= 60) return '#3B82F6';
    return '#EF4444';
  }

  function getGradeName(s, passed) {
    if (!passed) return '再接再厲';
    if (s >= 95) return '完美滿分';
    if (s >= 85) return '優秀卓越';
    if (s >= 75) return '表現良好';
    return '順利通過';
  }
  function getGradeEmoji(s, passed) {
    if (!passed) return '💪';
    if (s >= 95) return '🏆';
    if (s >= 85) return '🌟';
    if (s >= 75) return '✨';
    return '👏';
  }

  let _confStarted = false;
  function startConfetti(w, h) {
    if (_confStarted) return;
    _confStarted = true;
    const cx = w / 2, cy = h * 0.38;
    for (let i = 0; i < 280; i++) {
      setTimeout(() => {
        confParticles.push(new Burst(cx + _rand(-60, 60), cy + _rand(-20, 20)));
      }, _rand(0, 1200));
    }
  }

  let _overlayStart = 0, _w = 0, _h = 0;
  function overlayFrame(now) {
    const elapsed = now - _overlayStart;
    const sec = elapsed / 1000;

    confCtx.clearRect(0, 0, _w, _h);

    /* ── Phase 1: 黑幕 + hex ── */
    if (sec < 1.5) {
      hexGrid.forEach(h => { h.update(elapsed); h.draw(confCtx); });
    }

    /* ── Phase 2: 出現分數動畫（CSS 環 + JS 計數） ── */
    if (elapsed >= 1500 && phase < 2) {
      phase = 2;
      _showScoreSection();
    }

    /* ── Phase 3: 等級徽章 ── */
    if (elapsed >= 4500 && phase < 3) {
      phase = 3;
      _showGradeBadge();
    }

    /* ── Phase 4: 粒子爆破 ── */
    if (elapsed >= 6000 && phase < 4) {
      phase = 4;
      if (_passed) startConfetti(_w, _h);
      else _shakeBadge();
    }

    /* ── Phase 5: 統計卡片 ── */
    if (elapsed >= 7500 && phase < 5) {
      phase = 5;
      _showMiniStats();
    }

    /* ── Phase 6: 淡出 ── */
    if (elapsed >= 9200 && phase < 6) {
      phase = 6;
      overlay.style.transition = 'opacity 0.8s ease';
      overlay.style.opacity = '0';
      setTimeout(() => {
        overlay.classList.add('hidden');
        overlay.style.opacity = '';
        overlay.style.transition = '';
        confParticles = []; _confStarted = false; phase = 0;
        cancelAnimationFrame(rafId);
        if (_cb) _cb();
      }, 820);
    }

    // Draw confetti
    confParticles = confParticles.filter(p => !p.dead());
    confParticles.forEach(p => { p.update(); p.draw(confCtx); });

    if (elapsed < 10000) rafId = requestAnimationFrame(overlayFrame);
  }

  function _showScoreSection() {
    const sec = document.getElementById('resultsScoreSection');
    if (sec) {
      sec.classList.remove('hidden');
      sec.style.animation = 'rsa-fadeUp 0.7s cubic-bezier(0.34,1.56,0.64,1) forwards';
    }
    // Animate SVG ring
    const ring = document.getElementById('ringProgress');
    if (ring) {
      const R = 52, circ = 2 * Math.PI * R;
      ring.style.strokeDasharray  = circ;
      ring.style.strokeDashoffset = circ;
      ring.style.stroke = getScoreColor(_score);
      ring.style.transition = 'stroke-dashoffset 2s cubic-bezier(0.4,0,0.2,1)';
      requestAnimationFrame(() => {
        ring.style.strokeDashoffset = circ * (1 - _score / 100);
      });
    }
    // Count score number
    const numEl = document.getElementById('resultsScoreNum');
    if (numEl) {
      _animate({ duration: 2200, easing: _easeOut5, onUpdate: (p) => {
        numEl.textContent = Math.round(_score * p);
        numEl.style.color = getScoreColor(_score);
      }});
    }
  }

  function _showGradeBadge() {
    const badge = document.getElementById('resultsGradeBadge');
    if (!badge) return;
    const emoji = getGradeEmoji(_score, _passed);
    const name  = getGradeName(_score, _passed);
    const color = getScoreColor(_score);
    badge.innerHTML = `<span class="rsa-badge-emoji">${emoji}</span><span class="rsa-badge-name" style="color:${color}">${name}</span>`;
    badge.classList.remove('hidden');
    badge.style.animation = 'rsa-slam 0.55s cubic-bezier(0.34,1.56,0.64,1) forwards';
  }

  function _shakeBadge() {
    const badge = document.getElementById('resultsGradeBadge');
    if (badge) badge.style.animation = 'rsa-shake 0.5s ease';
  }

  function _showMiniStats() {
    const mini = document.getElementById('resultsMiniStats');
    if (!mini) return;
    mini.classList.remove('hidden');
    mini.querySelectorAll('.result-mini-card').forEach((el, i) => {
      el.style.animation = `rsa-fadeUp 0.5s ${i * 0.12}s cubic-bezier(0.34,1.56,0.64,1) both`;
    });
  }

  return {
    show(score, passed, cb) {
      _score = score; _passed = passed; _cb = cb;
      phase = 0; phaseT = 0; confParticles = []; _confStarted = false;

      overlay = document.getElementById('results-overlay');
      confCanvas = document.getElementById('confettiCanvas');
      if (!overlay || !confCanvas) { if (cb) cb(); return; }

      _w = confCanvas.width  = window.innerWidth;
      _h = confCanvas.height = window.innerHeight;
      confCtx = confCanvas.getContext('2d');

      buildHexGrid(confCtx, _w, _h);

      // Reset inner elements
      const sec   = document.getElementById('resultsScoreSection');
      const badge = document.getElementById('resultsGradeBadge');
      const mini  = document.getElementById('resultsMiniStats');
      const calc  = document.getElementById('resultsCalculating');
      const numEl = document.getElementById('resultsScoreNum');

      if (sec)   { sec.classList.add('hidden');   sec.style.animation = ''; }
      if (badge) { badge.classList.add('hidden'); badge.style.animation = ''; }
      if (mini)  { mini.classList.add('hidden');  }
      if (calc)  calc.style.display = 'flex';
      if (numEl) { numEl.textContent = '0'; numEl.style.color = ''; }

      overlay.classList.remove('hidden');
      overlay.style.opacity = '1';

      _overlayStart = performance.now();
      rafId = requestAnimationFrame(overlayFrame);

      // Hide calc spinner after phase 2
      setTimeout(() => { if (calc) calc.style.display = 'none'; }, 1400);
    },
    hide() {
      cancelAnimationFrame(rafId);
      const ov = document.getElementById('results-overlay');
      if (ov) ov.classList.add('hidden');
    }
  };
})();

/* ══════════════════════════════════════════════════════════
   3. RIPPLE EFFECT — 點擊水波紋
══════════════════════════════════════════════════════════ */
const RippleEffect = (() => {
  function create(e) {
    const target = e.currentTarget || e.target;
    if (!target || target.disabled) return;
    const rect = target.getBoundingClientRect();
    const x = (e.clientX - rect.left), y = (e.clientY - rect.top);

    const ripple = document.createElement('span');
    ripple.className = 'fx-ripple';
    ripple.style.cssText = `left:${x}px;top:${y}px`;
    target.appendChild(ripple);
    setTimeout(() => ripple.remove(), 700);
  }

  return {
    init() {
      document.addEventListener('click', e => {
        const btn = e.target.closest('button, .btn, [class*="btn-"], .exam-card, .tilt-card');
        if (btn) {
          // Temporarily set as currentTarget context
          const fakeE = { currentTarget: btn, target: e.target, clientX: e.clientX, clientY: e.clientY };
          create(fakeE);
        }
      }, true);
    }
  };
})();

/* ══════════════════════════════════════════════════════════
   4. MAGNETIC BUTTON
══════════════════════════════════════════════════════════ */
const MagneticButton = (() => {
  const RADIUS = 80, MAX = 12;

  function attach(el) {
    let animId = null, cx = 0, cy = 0, targetX = 0, targetY = 0;

    el.addEventListener('mousemove', e => {
      const r = el.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2);
      const dy = e.clientY - (r.top  + r.height / 2);
      const dist = Math.sqrt(dx*dx + dy*dy);
      if (dist < RADIUS) {
        const t = 1 - dist / RADIUS;
        targetX = dx * t * MAX / dist;
        targetY = dy * t * MAX / dist;
      }
    });

    el.addEventListener('mouseleave', () => { targetX = 0; targetY = 0; });

    function loop() {
      cx = _lerp(cx, targetX, 0.12);
      cy = _lerp(cy, targetY, 0.12);
      el.style.transform = `translate(${cx.toFixed(2)}px, ${cy.toFixed(2)}px)`;
      animId = requestAnimationFrame(loop);
    }
    loop();
  }

  return {
    init() {
      document.querySelectorAll('.btn-magnetic').forEach(attach);
      // Re-observe for dynamic elements
      new MutationObserver(() => {
        document.querySelectorAll('.btn-magnetic:not([data-mag])').forEach(el => {
          el.dataset.mag = '1'; attach(el);
        });
      }).observe(document.body, { childList: true, subtree: true });
    }
  };
})();

/* ══════════════════════════════════════════════════════════
   5. CARD TILT 3D
══════════════════════════════════════════════════════════ */
const CardTilt3D = (() => {
  function attach(el) {
    const MAX_ROT = 8, shine = document.createElement('div');
    shine.className = 'tilt-shine';
    el.appendChild(shine);

    el.addEventListener('mousemove', e => {
      const r  = el.getBoundingClientRect();
      const nx = (e.clientX - r.left) / r.width  - 0.5;
      const ny = (e.clientY - r.top)  / r.height - 0.5;
      el.style.transform = `perspective(600px) rotateY(${nx * MAX_ROT * 2}deg) rotateX(${-ny * MAX_ROT * 2}deg) scale(1.03)`;
      shine.style.background = `radial-gradient(circle at ${(nx+0.5)*100}% ${(ny+0.5)*100}%,rgba(255,255,255,0.12) 0%,rgba(255,255,255,0) 60%)`;
    });

    el.addEventListener('mouseleave', () => {
      el.style.transition = 'transform 0.4s cubic-bezier(0.34,1.56,0.64,1)';
      el.style.transform  = '';
      shine.style.background = '';
      setTimeout(() => { el.style.transition = ''; }, 420);
    });
  }

  return {
    init() {
      document.querySelectorAll('.tilt-card').forEach(attach);
      new MutationObserver(() => {
        document.querySelectorAll('.tilt-card:not([data-tilt])').forEach(el => {
          el.dataset.tilt = '1'; attach(el);
        });
      }).observe(document.body, { childList: true, subtree: true });
    }
  };
})();

/* ══════════════════════════════════════════════════════════
   6. NUMBER COUNTER
══════════════════════════════════════════════════════════ */
function NumberCounter(el, from, to, duration, suffix = '') {
  _animate({
    duration,
    easing: _easeOut3,
    onUpdate: p => {
      const val = Math.round(_lerp(from, to, p));
      el.textContent = val.toLocaleString() + suffix;
    }
  });
}

/* ══════════════════════════════════════════════════════════
   7. AMBIENT BACKGROUND PARTICLES
══════════════════════════════════════════════════════════ */
const AmbientParticles = (() => {
  let particles = [], rafId2;
  const MAX = 40;

  class Dot {
    constructor() { this.reset(); }
    reset() {
      this.x  = _rand(0, window.innerWidth);
      this.y  = _rand(0, window.innerHeight);
      this.r  = _rand(1, 3);
      this.vx = _rand(-0.15, 0.15);
      this.vy = _rand(-0.25, -0.05);
      this.a  = _rand(0.05, 0.3);
      this.hue= _rand(190, 240);
    }
    update() {
      this.x += this.vx; this.y += this.vy;
      this.a -= 0.0008;
      if (this.a <= 0 || this.y < -10) this.reset();
    }
    draw(ctx) {
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
      ctx.fillStyle = `hsla(${this.hue},80%,70%,${this.a})`;
      ctx.fill();
    }
  }

  return {
    init() {
      const wrap = document.getElementById('bgParticles');
      if (!wrap) return;
      const c = document.createElement('canvas');
      c.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:0';
      wrap.appendChild(c);
      const ctx = c.getContext('2d');

      const resize = () => { c.width = window.innerWidth; c.height = window.innerHeight; };
      resize();
      window.addEventListener('resize', resize);

      particles = Array.from({ length: MAX }, () => new Dot());
      const loop = () => {
        ctx.clearRect(0, 0, c.width, c.height);
        particles.forEach(p => { p.update(); p.draw(ctx); });
        rafId2 = requestAnimationFrame(loop);
      };
      loop();
    }
  };
})();

/* ══════════════════════════════════════════════════════════
   BOOT — 頁面載入時初始化
══════════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  RippleEffect.init();
  MagneticButton.init();
  CardTilt3D.init();
  AmbientParticles.init();
  SplashScreen.show();
});
