/**
 * animations.js — 趣味互動考試系統 Premium Animation System
 * 包含：SplashScreen / ResultsAnimation / RippleEffect / MagneticButton / CardTilt3D / NumberCounter
 */

/* ═══════════════════════════════════════════════════════
   1. SPLASH SCREEN  (7 秒全螢幕開場動畫)
═══════════════════════════════════════════════════════ */
const SplashScreen = (() => {
  let canvas, ctx, particles = [], animId, startTime;
  const TITLE = '趣味互動考試系統';
  const PARTICLE_COUNT = 120;

  /* ── 粒子類別 ── */
  class Particle {
    constructor(cx, cy) {
      this.reset(cx, cy);
    }
    reset(cx, cy) {
      this.x = cx; this.y = cy;
      const angle = Math.random() * Math.PI * 2;
      const speed = 1 + Math.random() * 4;
      this.vx = Math.cos(angle) * speed;
      this.vy = Math.sin(angle) * speed;
      this.life = 0;
      this.maxLife = 120 + Math.random() * 180;
      this.radius = 1 + Math.random() * 2.5;
      this.hue = 200 + Math.random() * 80; // blue→purple range
      this.brightness = 70 + Math.random() * 30;
    }
    update() {
      this.vx *= 0.985; this.vy *= 0.985;
      this.x += this.vx; this.y += this.vy;
      this.life++;
    }
    draw(ctx) {
      const alpha = Math.sin((this.life / this.maxLife) * Math.PI);
      ctx.save();
      ctx.globalAlpha = alpha * 0.85;
      ctx.shadowBlur = 8;
      ctx.shadowColor = `hsl(${this.hue},80%,70%)`;
      ctx.fillStyle = `hsl(${this.hue},80%,${this.brightness}%)`;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    isDead() { return this.life >= this.maxLife; }
  }

  /* ── 初始化 Canvas ── */
  function initCanvas() {
    canvas = document.getElementById('splashCanvas');
    if (!canvas) return;
    ctx = canvas.getContext('2d');
    resize();
    window.addEventListener('resize', resize);
  }

  function resize() {
    if (!canvas) return;
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
  }

  /* ── 逐字顯示標題 ── */
  function buildTitle() {
    const titleEl = document.getElementById('splashTitle');
    if (!titleEl) return;
    titleEl.innerHTML = '';
    [...TITLE].forEach((ch, i) => {
      const span = document.createElement('span');
      span.className = 'splash-char';
      span.textContent = ch;
      span.style.transitionDelay = `${i * 0.07}s`;
      titleEl.appendChild(span);
    });
  }

  /* ── 主動畫 loop (Canvas 粒子) ── */
  function particleLoop(ts) {
    if (!ctx) return;
    const elapsed = (ts - startTime) / 1000; // seconds

    // 清除 + 微暗底以產生拖尾
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 中心光暈 (Phase 1: 0-1.5s)
    if (elapsed < 3) {
      const glowAlpha = Math.min(elapsed / 1.5, 1) * 0.35;
      const grd = ctx.createRadialGradient(canvas.width/2, canvas.height/2, 0, canvas.width/2, canvas.height/2, canvas.width * 0.4);
      grd.addColorStop(0, `rgba(59,130,246,${glowAlpha})`);
      grd.addColorStop(0.5, `rgba(124,58,237,${glowAlpha * 0.5})`);
      grd.addColorStop(1, 'transparent');
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    // 持續生成粒子 (前4秒)
    if (elapsed < 4) {
      const count = elapsed < 1 ? 6 : elapsed < 2 ? 4 : 2;
      for (let i = 0; i < count; i++) {
        particles.push(new Particle(canvas.width / 2, canvas.height / 2));
      }
    }

    // 更新 & 繪製粒子
    particles = particles.filter(p => !p.isDead());
    particles.forEach(p => { p.update(); p.draw(ctx); });

    // 繼續 loop 直到 splash 結束
    if (elapsed < 7.2) animId = requestAnimationFrame(particleLoop);
  }

  /* ── 時序編排 ── */
  function run() {
    const splash = document.getElementById('splash-screen');
    if (!splash) return;

    initCanvas();
    buildTitle();

    // 確保 splash 可見
    splash.classList.remove('hidden');
    splash.style.display = 'flex';

    startTime = performance.now();
    animId = requestAnimationFrame(particleLoop);

    // Phase 2 (1.5s): Logo 出現
    setTimeout(() => {
      const logo = document.getElementById('splashLogo');
      if (logo) logo.classList.add('splash-logo-in');
    }, 1500);

    // Phase 3 (3s): 標題逐字 + 閃爍
    setTimeout(() => {
      document.querySelectorAll('.splash-char').forEach(c => c.classList.add('char-in'));
    }, 3000);

    // Phase 4 (4.5s): 副標題 + 進度條
    setTimeout(() => {
      const sub = document.getElementById('splashSubtitle');
      if (sub) sub.classList.add('splash-fade-in');
      startProgressBar();
    }, 4500);

    // Phase 5 (6s): 「準備就緒 ✓」
    setTimeout(() => {
      const ready = document.getElementById('splashReady');
      if (ready) {
        ready.classList.add('splash-fade-in');
        typeWriter(ready, '準備就緒 ✓', 50);
      }
    }, 6000);

    // Phase 6 (6.8s): 整體上滑淡出
    setTimeout(() => {
      if (splash) splash.classList.add('splash-exit');
    }, 6800);

    // Phase 6 完成 (7s): 移除 splash
    setTimeout(() => {
      if (splash) {
        splash.style.display = 'none';
        splash.remove();
      }
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
    }, 7200);
  }

  /* ── 進度條動畫 ── */
  function startProgressBar() {
    const bar = document.getElementById('splashBar');
    const pct = document.getElementById('splashPercent');
    if (!bar || !pct) return;

    let progress = 0;
    const duration = 1400; // ms (4.5s → 6s)
    const startT = performance.now();

    const tick = (now) => {
      const elapsed = now - startT;
      progress = Math.min(elapsed / duration, 1);
      const pctVal = Math.round(progress * 100);
      bar.style.width = pctVal + '%';
      pct.textContent = pctVal + '%';
      if (progress < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  /* ── 打字機效果 ── */
  function typeWriter(el, text, speed) {
    el.textContent = '';
    let i = 0;
    const timer = setInterval(() => {
      el.textContent += text[i++];
      if (i >= text.length) clearInterval(timer);
    }, speed);
  }

  return { run };
})();


/* ═══════════════════════════════════════════════════════
   2. RESULTS ANIMATION  (12 秒答題完成動畫)
═══════════════════════════════════════════════════════ */
const ResultsAnimation = (() => {
  let confettiCanvas, confettiCtx, confettiPieces = [], confettiAnim;

  /* ── 彩帶片 ── */
  class Confetto {
    constructor() { this.reset(true); }
    reset(initial = false) {
      this.x  = Math.random() * window.innerWidth;
      this.y  = initial ? -20 - Math.random() * 200 : -20;
      this.w  = 8 + Math.random() * 12;
      this.h  = 4 + Math.random() * 6;
      this.vx = (Math.random() - 0.5) * 3;
      this.vy = 2 + Math.random() * 4;
      this.rot = Math.random() * 360;
      this.vr = (Math.random() - 0.5) * 8;
      this.hue = Math.random() * 360;
      this.alpha = 1;
    }
    update() {
      this.x  += this.vx;
      this.y  += this.vy;
      this.rot += this.vr;
      this.vy  *= 1.002;
      if (this.y > window.innerHeight + 20) this.reset();
    }
    draw(ctx) {
      ctx.save();
      ctx.globalAlpha = this.alpha;
      ctx.translate(this.x, this.y);
      ctx.rotate((this.rot * Math.PI) / 180);
      ctx.fillStyle = `hsl(${this.hue},90%,65%)`;
      ctx.fillRect(-this.w / 2, -this.h / 2, this.w, this.h);
      ctx.restore();
    }
  }

  function initConfetti() {
    confettiCanvas = document.getElementById('confettiCanvas');
    if (!confettiCanvas) return;
    confettiCtx = confettiCanvas.getContext('2d');
    confettiCanvas.width  = window.innerWidth;
    confettiCanvas.height = window.innerHeight;
  }

  function launchConfetti() {
    if (!confettiCanvas) initConfetti();
    if (!confettiCtx) return;
    confettiPieces = Array.from({ length: 200 }, () => new Confetto());
    confettiAnim = requestAnimationFrame(confettiLoop);
    // 停止生成新的彩帶（4秒後）
    setTimeout(() => {
      confettiPieces.forEach(p => { p.vy += 1; });
    }, 4000);
  }

  function confettiLoop() {
    if (!confettiCtx) return;
    confettiCtx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
    confettiPieces.forEach(p => { p.update(); p.draw(confettiCtx); });
    confettiAnim = requestAnimationFrame(confettiLoop);
  }

  function stopConfetti() {
    cancelAnimationFrame(confettiAnim);
    if (confettiCtx) confettiCtx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
  }

  /* ── 評級文字 ── */
  function gradeText(score) {
    if (score >= 90) return { text: '🏆 優秀！', cls: 'grade-excellent' };
    if (score >= 60) return { text: '👏 及格！', cls: 'grade-pass' };
    return { text: '💪 加油！', cls: 'grade-fail' };
  }

  /* ── SVG 環形進度繪製 ── */
  function animateRing(score, duration) {
    const ring = document.getElementById('ringProgress');
    if (!ring) return;
    const r = 52;
    const circ = 2 * Math.PI * r;
    ring.style.strokeDasharray  = circ;
    ring.style.strokeDashoffset = circ;
    ring.style.stroke = score >= 90 ? '#10B981' : score >= 60 ? '#3B82F6' : '#EF4444';

    const start = performance.now();
    const tick = (now) => {
      const p = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      ring.style.strokeDashoffset = circ * (1 - (score / 100) * eased);
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  /* ── 主入口 ── */
  function show(score, passed, callback) {
    const overlay = document.getElementById('results-overlay');
    if (!overlay) { if (callback) callback(); return; }

    // 重置
    overlay.classList.remove('hidden');
    overlay.style.display = 'flex';
    document.getElementById('resultsCalculating')?.classList.remove('hidden');
    document.getElementById('resultsScoreSection')?.classList.add('hidden');
    document.getElementById('resultsGradeBadge')?.classList.add('hidden');
    document.getElementById('resultsMiniStats')?.classList.add('hidden');

    // Phase 1 (0-1s): 齒輪旋轉 overlay 出現
    const gear = overlay.querySelector('.calc-gear');
    if (gear) gear.classList.add('gear-spin');

    // Phase 2 (1-4s): 環形分數
    setTimeout(() => {
      document.getElementById('resultsCalculating')?.classList.add('hidden');
      const scoreSection = document.getElementById('resultsScoreSection');
      if (scoreSection) {
        scoreSection.classList.remove('hidden');
        scoreSection.classList.add('score-pop-in');
      }
      animateRing(score, 2800);
      NumberCounter(document.getElementById('resultsScoreNum'), 0, score, 2800, '');
    }, 1000);

    // Phase 3 (4-5.5s): 等級徽章
    setTimeout(() => {
      const badge = document.getElementById('resultsGradeBadge');
      if (badge) {
        const { text, cls } = gradeText(score);
        badge.textContent = text;
        badge.className = `results-grade-badge ${cls}`;
        badge.classList.add('badge-slam');
      }
    }, 4000);

    // Phase 4 (5.5-9.5s): 通過時灑彩帶
    if (passed) {
      setTimeout(() => launchConfetti(), 5500);
    }

    // Phase 5 (8-10s): 三個統計卡片翻入
    setTimeout(() => {
      const stats = document.getElementById('resultsMiniStats');
      if (stats) {
        stats.classList.remove('hidden');
        stats.classList.add('stats-reveal');
      }
    }, 8000);

    // Phase 6 (10-12s): 淡出 overlay，顯示結果頁
    setTimeout(() => {
      stopConfetti();
      if (overlay) overlay.classList.add('overlay-fade-out');
      setTimeout(() => {
        overlay.style.display = 'none';
        overlay.classList.remove('overlay-fade-out');
        if (callback) callback();
      }, 800);
    }, 10000);
  }

  function hide() {
    stopConfetti();
    const overlay = document.getElementById('results-overlay');
    if (overlay) { overlay.style.display = 'none'; overlay.classList.add('hidden'); }
  }

  return { show, hide };
})();


/* ═══════════════════════════════════════════════════════
   3. RIPPLE EFFECT — 全域按鈕點擊波紋
═══════════════════════════════════════════════════════ */
const RippleEffect = (() => {
  function createRipple(e) {
    const btn = e.currentTarget || e.target.closest('button, .btn-ripple, [data-ripple]');
    if (!btn) return;

    // 確保按鈕有 position:relative 和 overflow:hidden
    const style = getComputedStyle(btn);
    if (style.position === 'static') btn.style.position = 'relative';
    if (style.overflow !== 'hidden') btn.style.overflow = 'hidden';

    const rect = btn.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height) * 2.5;
    const x    = e.clientX - rect.left - size / 2;
    const y    = e.clientY - rect.top  - size / 2;

    const ripple = document.createElement('span');
    ripple.style.cssText = `
      position:absolute;
      left:${x}px; top:${y}px;
      width:${size}px; height:${size}px;
      border-radius:50%;
      background:rgba(255,255,255,0.35);
      transform:scale(0);
      pointer-events:none;
      animation:rippleAnim 0.6s cubic-bezier(0.4,0,0.2,1) forwards;
      z-index:999;
    `;
    btn.appendChild(ripple);
    ripple.addEventListener('animationend', () => ripple.remove());
  }

  function init() {
    // 全域事件委派，動態按鈕也有效
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('button, .btn-ripple, [data-ripple]');
      if (btn) createRipple({ ...e, currentTarget: btn });
    });
  }

  return { init };
})();


/* ═══════════════════════════════════════════════════════
   4. MAGNETIC BUTTON — .btn-magnetic 類別
═══════════════════════════════════════════════════════ */
const MagneticButton = (() => {
  const RANGE    = 80;  // 觸發距離 px
  const MAX_MOVE = 12;  // 最大位移 px

  function applyTo(el) {
    let rafId;

    el.addEventListener('mousemove', (e) => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        const rect = el.getBoundingClientRect();
        const cx   = rect.left + rect.width  / 2;
        const cy   = rect.top  + rect.height / 2;
        const dx   = e.clientX - cx;
        const dy   = e.clientY - cy;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < RANGE) {
          const strength = (RANGE - dist) / RANGE;
          el.style.transform = `translate(${dx * strength * (MAX_MOVE / RANGE)}px, ${dy * strength * (MAX_MOVE / RANGE)}px)`;
        }
      });
    });

    el.addEventListener('mouseleave', () => {
      cancelAnimationFrame(rafId);
      el.style.transition = 'transform 0.5s cubic-bezier(0.34,1.56,0.64,1)';
      el.style.transform  = 'translate(0,0)';
      setTimeout(() => { el.style.transition = ''; }, 500);
    });
  }

  function init() {
    document.querySelectorAll('.btn-magnetic').forEach(applyTo);

    // MutationObserver 讓動態新增的按鈕也生效
    const observer = new MutationObserver(muts => {
      muts.forEach(mut => {
        mut.addedNodes.forEach(node => {
          if (node.nodeType !== 1) return;
          if (node.matches?.('.btn-magnetic')) applyTo(node);
          node.querySelectorAll?.('.btn-magnetic').forEach(applyTo);
        });
      });
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  return { init, applyTo };
})();


/* ═══════════════════════════════════════════════════════
   5. CARD TILT 3D — .tilt-card 類別
═══════════════════════════════════════════════════════ */
const CardTilt3D = (() => {
  const MAX_TILT  = 8;   // degrees
  const SHINE_AMT = 0.15;

  function applyTo(card) {
    // 建立光澤覆蓋層
    let shine = card.querySelector('.tilt-shine');
    if (!shine) {
      shine = document.createElement('div');
      shine.className = 'tilt-shine';
      shine.style.cssText = `
        position:absolute; inset:0; border-radius:inherit; pointer-events:none;
        background:radial-gradient(circle at 50% 50%, rgba(255,255,255,0.15), transparent 70%);
        opacity:0; transition:opacity 0.2s; z-index:1;
      `;
      card.style.position = card.style.position || 'relative';
      card.appendChild(shine);
    }

    card.addEventListener('mousemove', (e) => {
      const rect = card.getBoundingClientRect();
      const x    = (e.clientX - rect.left) / rect.width;
      const y    = (e.clientY - rect.top)  / rect.height;
      const rx   = (y - 0.5) * -MAX_TILT * 2;
      const ry   = (x - 0.5) *  MAX_TILT * 2;

      card.style.transform  = `perspective(800px) rotateX(${rx}deg) rotateY(${ry}deg) scale(1.02)`;
      card.style.transition = 'transform 0.1s';
      shine.style.background = `radial-gradient(circle at ${x*100}% ${y*100}%, rgba(255,255,255,${SHINE_AMT}), transparent 60%)`;
      shine.style.opacity   = '1';
    });

    card.addEventListener('mouseleave', () => {
      card.style.transition = 'transform 0.5s cubic-bezier(0.34,1.56,0.64,1)';
      card.style.transform  = 'perspective(800px) rotateX(0) rotateY(0) scale(1)';
      shine.style.opacity   = '0';
    });
  }

  function init() {
    document.querySelectorAll('.tilt-card').forEach(applyTo);

    const observer = new MutationObserver(muts => {
      muts.forEach(mut => {
        mut.addedNodes.forEach(node => {
          if (node.nodeType !== 1) return;
          if (node.matches?.('.tilt-card')) applyTo(node);
          node.querySelectorAll?.('.tilt-card').forEach(applyTo);
        });
      });
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  return { init, applyTo };
})();


/* ═══════════════════════════════════════════════════════
   6. NUMBER COUNTER
═══════════════════════════════════════════════════════ */
function NumberCounter(el, from, to, duration, suffix = '') {
  if (!el) return;
  const start = performance.now();
  const tick  = (now) => {
    const p    = Math.min((now - start) / duration, 1);
    const ease = 1 - Math.pow(1 - p, 3); // easeOutCubic
    const val  = Math.round(from + (to - from) * ease);
    el.textContent = val.toLocaleString() + suffix;
    if (p < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}


/* ═══════════════════════════════════════════════════════
   7. 注入 CSS keyframes（ripple 動畫 & 其他動態效果）
═══════════════════════════════════════════════════════ */
(function injectKeyframes() {
  const style = document.createElement('style');
  style.textContent = `
    @keyframes rippleAnim {
      to { transform: scale(1); opacity: 0; }
    }
    @keyframes gearSpin {
      to { transform: rotate(360deg); }
    }
    @keyframes slamDown {
      0%   { transform: translateY(-120px) scale(1.4); opacity:0; }
      60%  { transform: translateY(10px)   scale(0.95); opacity:1; }
      80%  { transform: translateY(-6px)   scale(1.02); }
      100% { transform: translateY(0)      scale(1); opacity:1; }
    }
    @keyframes popIn {
      0%   { transform: scale(0.5); opacity:0; }
      70%  { transform: scale(1.08); opacity:1; }
      100% { transform: scale(1); opacity:1; }
    }
    @keyframes flipIn {
      0%   { transform: rotateY(-90deg); opacity:0; }
      100% { transform: rotateY(0);      opacity:1; }
    }
    @keyframes overlayFadeOut {
      to { opacity: 0; }
    }
    @keyframes shimmer {
      0%   { background-position: -200% center; }
      100% { background-position:  200% center; }
    }
    @keyframes splashExit {
      to { transform: translateY(-100%); opacity: 0; }
    }
    @keyframes charSparkle {
      0%   { opacity:0; transform: translateY(40px) scale(0.6); filter:brightness(3); }
      50%  { filter: brightness(2); }
      100% { opacity:1; transform: translateY(0)    scale(1);   filter:brightness(1); }
    }
    .gear-spin { animation: gearSpin 0.8s linear infinite !important; display:inline-block; }
    .badge-slam { animation: slamDown 0.7s cubic-bezier(0.34,1.56,0.64,1) forwards !important; }
    .score-pop-in { animation: popIn 0.5s cubic-bezier(0.34,1.56,0.64,1) both !important; }
    .splash-logo-in { animation: popIn 0.7s cubic-bezier(0.34,1.56,0.64,1) forwards !important; opacity:1 !important; }
    .char-in { animation: charSparkle 0.5s cubic-bezier(0.34,1.56,0.64,1) forwards !important; }
    .splash-fade-in { opacity:1 !important; transform:none !important; transition: opacity 0.6s ease, transform 0.6s ease !important; }
    .splash-exit { animation: splashExit 0.5s ease-in forwards !important; }
    .overlay-fade-out { animation: overlayFadeOut 0.8s ease forwards !important; }
    .stats-reveal .result-mini-card:nth-child(1) { animation: flipIn 0.5s 0s   both; }
    .stats-reveal .result-mini-card:nth-child(2) { animation: flipIn 0.5s 0.15s both; }
    .stats-reveal .result-mini-card:nth-child(3) { animation: flipIn 0.5s 0.3s  both; }
  `;
  document.head.appendChild(style);
})();


/* ═══════════════════════════════════════════════════════
   8. 自動初始化
═══════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  // 波紋效果（全域，所有按鈕）
  RippleEffect.init();

  // 磁性按鈕
  MagneticButton.init();

  // 3D 卡片傾斜
  CardTilt3D.init();

  // 開場動畫
  SplashScreen.run();
});
