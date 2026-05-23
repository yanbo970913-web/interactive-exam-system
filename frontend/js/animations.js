/**
 * animations.js — 趣味互動考試系統 · Premium FX Engine v2
 * ─────────────────────────────────────────────────────────
 * SplashScreen   · 7s 開場粒子宇宙動畫
 * ResultsAnimation · 12s 極致成績展演
 * RippleEffect   · 全域按鈕波紋
 * MagneticButton · 磁力按鈕
 * CardTilt3D     · 3D 卡片傾斜
 * NumberCounter  · 平滑數字滾動
 * ParticleTrail  · 滑鼠粒子軌跡
 */

/* ═══════════════════════════════════════════════════════════
   SHARED UTILITIES
═══════════════════════════════════════════════════════════ */
const easeOutCubic   = t => 1 - Math.pow(1 - t, 3);
const easeOutElastic = t => {
  const c4 = (2 * Math.PI) / 3;
  return t === 0 ? 0 : t === 1 ? 1 :
    Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
};
const easeInOutQuint = t => t < 0.5 ? 16 * t * t * t * t * t : 1 - Math.pow(-2 * t + 2, 5) / 2;
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const rand  = (min, max) => min + Math.random() * (max - min);

function animate({ duration, onUpdate, onComplete, easing = easeOutCubic }) {
  const start = performance.now();
  const tick  = now => {
    const raw  = Math.min((now - start) / duration, 1);
    const prog = easing(raw);
    onUpdate(prog, raw);
    if (raw < 1) requestAnimationFrame(tick);
    else if (onComplete) onComplete();
  };
  requestAnimationFrame(tick);
}

/* ═══════════════════════════════════════════════════════════
   1. SPLASH SCREEN  — 7 秒宇宙開場
═══════════════════════════════════════════════════════════ */
const SplashScreen = (() => {
  let canvas, ctx, W, H, animId;
  let startTime, phase = 0;
  let stars = [], nebulae = [], shockRings = [];

  /* ── Star (background starfield) ── */
  class Star {
    constructor() { this.reset(); }
    reset() {
      this.x  = rand(0, W); this.y = rand(0, H);
      this.r  = rand(0.3, 1.8);
      this.a  = rand(0.1, 0.9);
      this.da = rand(0.002, 0.008) * (Math.random() > 0.5 ? 1 : -1);
    }
    update() { this.a = clamp(this.a + this.da, 0.05, 1); if (this.a <= 0.05 || this.a >= 1) this.da *= -1; }
    draw() {
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,255,255,${this.a})`;
      ctx.fill();
    }
  }

  /* ── Nebula puff ── */
  class Nebula {
    constructor() {
      this.x   = W / 2 + rand(-W * 0.3, W * 0.3);
      this.y   = H / 2 + rand(-H * 0.3, H * 0.3);
      this.r   = rand(60, 200);
      this.hue = rand(210, 290);
      this.a   = 0;
      this.maxA = rand(0.04, 0.1);
    }
    update(t) { this.a = Math.min(this.maxA, t * this.maxA * 2); }
    draw() {
      const g = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.r);
      g.addColorStop(0, `hsla(${this.hue},80%,60%,${this.a})`);
      g.addColorStop(1, `hsla(${this.hue},80%,40%,0)`);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /* ── Shockwave ring ── */
  class ShockRing {
    constructor(x, y, hue = 220) {
      this.x = x; this.y = y; this.hue = hue;
      this.r = 0; this.maxR = Math.max(W, H) * 0.7;
      this.a = 0.8; this.life = 0; this.maxLife = 80;
    }
    update() {
      this.life++;
      const t = this.life / this.maxLife;
      this.r  = easeOutCubic(t) * this.maxR;
      this.a  = (1 - t) * 0.6;
    }
    draw() {
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
      ctx.strokeStyle = `hsla(${this.hue},90%,70%,${this.a})`;
      ctx.lineWidth   = 2;
      ctx.stroke();
    }
    isDead() { return this.life >= this.maxLife; }
  }

  /* ── Flying Particle (burst from center) ── */
  class FlyParticle {
    constructor(x, y) {
      const angle = rand(0, Math.PI * 2);
      const spd   = rand(1.5, 6);
      this.x = x; this.y = y;
      this.vx = Math.cos(angle) * spd;
      this.vy = Math.sin(angle) * spd;
      this.r  = rand(1, 3);
      this.hue = rand(180, 310);
      this.life = 0;
      this.maxLife = rand(80, 200);
    }
    update() {
      this.vx *= 0.97; this.vy *= 0.97;
      this.x += this.vx; this.y += this.vy;
      this.life++;
    }
    draw() {
      const a = Math.sin((this.life / this.maxLife) * Math.PI) * 0.9;
      ctx.save();
      ctx.globalAlpha = a;
      ctx.shadowBlur  = 6;
      ctx.shadowColor = `hsl(${this.hue},90%,70%)`;
      ctx.fillStyle   = `hsl(${this.hue},90%,75%)`;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    isDead() { return this.life >= this.maxLife; }
  }

  let flyParticles = [];
  let burstDone = false;

  function initCanvas() {
    canvas = document.getElementById('splashCanvas');
    if (!canvas) return false;
    ctx = canvas.getContext('2d');
    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;
    return true;
  }

  function buildTitle() {
    const titleEl = document.getElementById('splashTitle');
    if (!titleEl) return;
    const TEXT = '趣味互動考試系統';
    titleEl.innerHTML = [...TEXT].map((ch, i) =>
      `<span class="splash-char" style="transition-delay:${i * 0.06 + 0.1}s">${ch}</span>`
    ).join('');
  }

  /* ── 主 render loop ── */
  function loop(ts) {
    const elapsed = (ts - startTime) / 1000;
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.fillRect(0, 0, W, H);

    // starfield
    stars.forEach(s => { s.update(); s.draw(); });

    // nebulae (phase 0.3s+)
    if (elapsed > 0.3) {
      nebulae.forEach(n => { n.update(Math.min((elapsed - 0.3) / 1.5, 1)); n.draw(); });
    }

    // shockwave rings
    shockRings = shockRings.filter(r => !r.isDead());
    shockRings.forEach(r => { r.update(); r.draw(); });

    // particle burst (0.8s~3s)
    if (elapsed > 0.8 && !burstDone) {
      const rate = elapsed < 2 ? 8 : elapsed < 3 ? 4 : 0;
      for (let i = 0; i < rate; i++) flyParticles.push(new FlyParticle(W / 2, H / 2));
      if (elapsed >= 3) burstDone = true;
    }
    flyParticles = flyParticles.filter(p => !p.isDead());
    flyParticles.forEach(p => { p.update(); p.draw(); });

    // center glow
    if (elapsed > 0.5) {
      const gAlpha = Math.min((elapsed - 0.5) / 1, 1) * 0.25;
      const gw = ctx.createRadialGradient(W/2, H/2, 0, W/2, H/2, W * 0.35);
      gw.addColorStop(0, `rgba(99,102,241,${gAlpha})`);
      gw.addColorStop(0.5, `rgba(59,130,246,${gAlpha * 0.5})`);
      gw.addColorStop(1, 'transparent');
      ctx.fillStyle = gw;
      ctx.fillRect(0, 0, W, H);
    }

    if (elapsed < 7.5) animId = requestAnimationFrame(loop);
  }

  function startProgressBar() {
    const bar = document.getElementById('splashBar');
    const pct = document.getElementById('splashPercent');
    if (!bar || !pct) return;
    animate({
      duration: 1300,
      easing: easeInOutQuint,
      onUpdate: p => {
        bar.style.width = (p * 100) + '%';
        pct.textContent = Math.round(p * 100) + '%';
      }
    });
  }

  function typeWriter(el, text, speed = 45) {
    el.textContent = '';
    let i = 0;
    const t = setInterval(() => {
      el.textContent += text[i++];
      if (i >= text.length) clearInterval(t);
    }, speed);
  }

  function run() {
    const splash = document.getElementById('splash-screen');
    if (!splash) return;
    if (!initCanvas()) return;

    // init starfield + nebulae
    stars   = Array.from({ length: 180 }, () => new Star());
    nebulae = Array.from({ length: 6  }, () => new Nebula());

    splash.style.display = 'flex';
    buildTitle();

    startTime = performance.now();
    animId    = requestAnimationFrame(loop);

    // shockwave at 0.8s
    setTimeout(() => shockRings.push(new ShockRing(W / 2, H / 2, 220)), 800);
    setTimeout(() => shockRings.push(new ShockRing(W / 2, H / 2, 260)), 1100);

    // Logo pop-in (1.4s)
    setTimeout(() => {
      const logo = document.getElementById('splashLogo');
      if (logo) logo.classList.add('splash-logo-in');
    }, 1400);

    // Title letters (2.8s)
    setTimeout(() => {
      document.querySelectorAll('.splash-char').forEach(c => c.classList.add('char-in'));
    }, 2800);

    // Subtitle (3.8s)
    setTimeout(() => {
      const sub = document.getElementById('splashSubtitle');
      if (sub) {
        sub.style.opacity = '1';
        sub.style.transform = 'none';
      }
    }, 3800);

    // Progress bar (4.5s)
    setTimeout(() => startProgressBar(), 4500);

    // Ready text (5.9s)
    setTimeout(() => {
      const ready = document.getElementById('splashReady');
      if (ready) {
        ready.style.opacity = '1';
        typeWriter(ready, '準備就緒 ✓');
      }
    }, 5900);

    // Exit (6.8s)
    setTimeout(() => {
      splash.style.transition = 'transform 0.6s cubic-bezier(0.4,0,0.8,0), opacity 0.6s ease';
      splash.style.transform  = 'translateY(-100%)';
      splash.style.opacity    = '0';
    }, 6800);

    setTimeout(() => {
      splash?.remove();
      cancelAnimationFrame(animId);
    }, 7400);
  }

  return { run };
})();


/* ═══════════════════════════════════════════════════════════
   2. RESULTS ANIMATION — 12 秒極致成績展演
═══════════════════════════════════════════════════════════ */
const ResultsAnimation = (() => {
  /* ── Confetti physics ── */
  class Confetto {
    constructor(burst = false) {
      this.reset(burst);
    }
    reset(burst = false) {
      const W = window.innerWidth, H = window.innerHeight;
      if (burst) {
        this.x  = W / 2 + rand(-W * 0.15, W * 0.15);
        this.y  = H / 2 + rand(-H * 0.15, H * 0.15);
        const angle = rand(0, Math.PI * 2);
        const spd   = rand(4, 16);
        this.vx = Math.cos(angle) * spd;
        this.vy = Math.sin(angle) * spd - rand(2, 8);
      } else {
        this.x  = rand(-40, W + 40);
        this.y  = rand(-200, -10);
        this.vx = rand(-2, 2);
        this.vy = rand(2, 5);
      }
      this.w   = rand(6, 14);
      this.h   = rand(4, 8);
      this.rot = rand(0, 360);
      this.vr  = rand(-8, 8);
      this.hue = rand(0, 360);
      this.sat = rand(70, 100);
      this.lum = rand(50, 75);
      this.gravity = rand(0.08, 0.18);
      this.bounce  = false;
    }
    update() {
      this.vy  += this.gravity;
      this.x   += this.vx;
      this.y   += this.vy;
      this.rot += this.vr;
      this.vx  *= 0.99;
      if (this.y > window.innerHeight + 50) this.reset();
    }
    draw(ctx) {
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(this.rot * Math.PI / 180);
      ctx.fillStyle = `hsl(${this.hue},${this.sat}%,${this.lum}%)`;
      ctx.shadowBlur  = 4;
      ctx.shadowColor = `hsl(${this.hue},100%,70%)`;
      ctx.fillRect(-this.w / 2, -this.h / 2, this.w, this.h);
      ctx.restore();
    }
  }

  /* ── Firework star ── */
  class FireworkStar {
    constructor(x, y) {
      const angle = rand(0, Math.PI * 2);
      const spd   = rand(3, 12);
      this.x = x; this.y = y;
      this.vx = Math.cos(angle) * spd;
      this.vy = Math.sin(angle) * spd;
      this.hue = rand(20, 340);
      this.life = 0; this.maxLife = rand(40, 80);
      this.r = rand(1.5, 3.5);
      this.trail = [];
    }
    update() {
      this.trail.push({ x: this.x, y: this.y });
      if (this.trail.length > 8) this.trail.shift();
      this.vx *= 0.95; this.vy += 0.12;
      this.x += this.vx; this.y += this.vy;
      this.life++;
    }
    draw(ctx) {
      const a = 1 - this.life / this.maxLife;
      // trail
      this.trail.forEach((pt, i) => {
        const ta = (i / this.trail.length) * a * 0.5;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, this.r * (i / this.trail.length), 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${this.hue},100%,70%,${ta})`;
        ctx.fill();
      });
      // head
      ctx.save();
      ctx.globalAlpha = a;
      ctx.shadowBlur  = 10;
      ctx.shadowColor = `hsl(${this.hue},100%,70%)`;
      ctx.fillStyle   = `hsl(${this.hue},100%,85%)`;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    isDead() { return this.life >= this.maxLife; }
  }

  let canvas, ctx, pieces = [], fwStars = [];
  let rafId;
  let phaseTimeout = [];

  function initCanvas() {
    canvas = document.getElementById('confettiCanvas');
    if (!canvas) return;
    ctx = canvas.getContext('2d');
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
  }

  function launchFirework() {
    const cx = rand(window.innerWidth * 0.15, window.innerWidth * 0.85);
    const cy = rand(window.innerHeight * 0.1, window.innerHeight * 0.5);
    for (let i = 0; i < 80; i++) fwStars.push(new FireworkStar(cx, cy));
  }

  function spawnConfetti(burst = false) {
    const count = burst ? 200 : 150;
    for (let i = 0; i < count; i++) pieces.push(new Confetto(burst));
  }

  function confettiLoop() {
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    pieces.forEach(p => { p.update(); p.draw(ctx); });
    fwStars = fwStars.filter(s => !s.isDead());
    fwStars.forEach(s => { s.update(); s.draw(ctx); });
    rafId = requestAnimationFrame(confettiLoop);
  }

  function stopConfetti() {
    cancelAnimationFrame(rafId);
    phaseTimeout.forEach(clearTimeout);
    phaseTimeout = [];
    pieces = []; fwStars = [];
    if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  function animateRing(score, duration) {
    const ring  = document.getElementById('ringProgress');
    if (!ring) return;
    const R     = 52;
    const circ  = 2 * Math.PI * R;
    const color = score >= 90 ? '#10B981' : score >= 60 ? '#3B82F6' : '#EF4444';
    ring.style.strokeDasharray  = circ;
    ring.style.strokeDashoffset = circ;
    ring.style.stroke = color;

    // Secondary glow ring
    const glow = document.getElementById('ringGlow');
    if (glow) { glow.style.stroke = color; glow.style.strokeDasharray = circ; glow.style.strokeDashoffset = circ; }

    animate({
      duration,
      easing: easeInOutQuint,
      onUpdate: p => {
        const offset = circ * (1 - (score / 100) * p);
        ring.style.strokeDashoffset = offset;
        if (glow) glow.style.strokeDashoffset = offset;
      }
    });
  }

  function gradeInfo(score) {
    if (score >= 90) return { text: '🏆 優秀！',  cls: 'grade-excellent' };
    if (score >= 60) return { text: '👏 及格！',  cls: 'grade-pass' };
    return              { text: '💪 加油！',  cls: 'grade-fail' };
  }

  function show(score, passed, callback) {
    const overlay = document.getElementById('results-overlay');
    if (!overlay) { if (callback) callback(); return; }

    initCanvas();
    overlay.style.display = 'flex';
    overlay.classList.remove('hidden');

    // reset sections
    ['resultsCalculating','resultsScoreSection','resultsGradeBadge','resultsMiniStats'].forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      if (id === 'resultsCalculating') { el.classList.remove('hidden'); }
      else { el.classList.add('hidden'); el.style.opacity = ''; el.style.transform = ''; }
    });

    // Phase 1 (0s): gear spin
    const gear = overlay.querySelector('.calc-gear');
    if (gear) gear.classList.add('gear-spin');

    // Phase 2 (1.2s): score ring
    const t1 = setTimeout(() => {
      document.getElementById('resultsCalculating')?.classList.add('hidden');
      const ss = document.getElementById('resultsScoreSection');
      if (ss) {
        ss.classList.remove('hidden');
        ss.style.opacity = '0';
        ss.style.transform = 'scale(0.5)';
        animate({ duration: 500, easing: easeOutElastic,
          onUpdate: p => { ss.style.opacity = p; ss.style.transform = `scale(${lerp(0.5, 1, p)})`; }
        });
      }
      animateRing(score, 2600);
      NumberCounter(document.getElementById('resultsScoreNum'), 0, score, 2600);
    }, 1200);
    phaseTimeout.push(t1);

    // Phase 3 (4s): grade badge slam
    const t2 = setTimeout(() => {
      const badge = document.getElementById('resultsGradeBadge');
      if (badge) {
        const { text, cls } = gradeInfo(score);
        badge.textContent = text;
        badge.className   = `results-grade-badge ${cls}`;
        badge.classList.remove('hidden');
        badge.classList.add('badge-slam');
      }
    }, 4000);
    phaseTimeout.push(t2);

    // Phase 4 (5.5s): fireworks & confetti
    if (passed) {
      const t3 = setTimeout(() => {
        confettiLoop();
        spawnConfetti(true);   // burst from center
        spawnConfetti(false);  // rain from top
        // fireworks (3 bursts)
        [0, 700, 1500].forEach(delay => {
          const t = setTimeout(launchFirework, delay);
          phaseTimeout.push(t);
        });
      }, 5500);
      phaseTimeout.push(t3);
    }

    // Phase 5 (8s): mini stats
    const t4 = setTimeout(() => {
      const ms = document.getElementById('resultsMiniStats');
      if (ms) {
        ms.classList.remove('hidden');
        ms.classList.add('stats-reveal');
      }
    }, 8000);
    phaseTimeout.push(t4);

    // Phase 6 (10.5s): fade out → show results
    const t5 = setTimeout(() => {
      stopConfetti();
      overlay.style.transition = 'opacity 0.8s ease';
      overlay.style.opacity    = '0';
      setTimeout(() => {
        overlay.style.display   = 'none';
        overlay.style.opacity   = '';
        overlay.style.transition = '';
        overlay.classList.add('hidden');
        if (callback) callback();
      }, 800);
    }, 10500);
    phaseTimeout.push(t5);
  }

  function hide() {
    stopConfetti();
    const overlay = document.getElementById('results-overlay');
    if (overlay) { overlay.style.display = 'none'; overlay.classList.add('hidden'); }
  }

  return { show, hide };
})();


/* ═══════════════════════════════════════════════════════════
   3. RIPPLE EFFECT — 全域按鈕點擊波紋
═══════════════════════════════════════════════════════════ */
const RippleEffect = (() => {
  function create(e) {
    const btn = e.target.closest('button, [data-ripple], .btn-ripple');
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height) * 2.6;
    const x    = e.clientX - rect.left - size / 2;
    const y    = e.clientY - rect.top  - size / 2;

    const ripple = document.createElement('span');
    ripple.style.cssText = `
      position:absolute; left:${x}px; top:${y}px;
      width:${size}px; height:${size}px; border-radius:50%;
      background:rgba(255,255,255,0.32); transform:scale(0);
      pointer-events:none; z-index:9999;
      animation: rippleAnim 0.65s cubic-bezier(0.4,0,0.2,1) forwards;
    `;
    if (getComputedStyle(btn).position === 'static') btn.style.position = 'relative';
    if (getComputedStyle(btn).overflow !== 'hidden') btn.style.overflow = 'hidden';
    btn.appendChild(ripple);
    ripple.addEventListener('animationend', () => ripple.remove(), { once: true });
  }
  function init() { document.addEventListener('click', create); }
  return { init };
})();


/* ═══════════════════════════════════════════════════════════
   4. MAGNETIC BUTTON
═══════════════════════════════════════════════════════════ */
const MagneticButton = (() => {
  const RANGE = 80, MAX = 14;
  function apply(el) {
    let rafId;
    el.addEventListener('mousemove', e => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        const r = el.getBoundingClientRect();
        const dx = e.clientX - (r.left + r.width  / 2);
        const dy = e.clientY - (r.top  + r.height / 2);
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < RANGE) {
          const s = (RANGE - dist) / RANGE;
          el.style.transform = `translate(${dx * s * MAX / RANGE}px, ${dy * s * MAX / RANGE}px)`;
        }
      });
    });
    el.addEventListener('mouseleave', () => {
      cancelAnimationFrame(rafId);
      el.style.transition = 'transform 0.55s cubic-bezier(0.34,1.56,0.64,1)';
      el.style.transform  = '';
      setTimeout(() => { el.style.transition = ''; }, 550);
    });
  }
  function init() {
    const obs = new MutationObserver(muts => muts.forEach(m =>
      m.addedNodes.forEach(n => {
        if (n.nodeType !== 1) return;
        if (n.matches?.('.btn-magnetic')) apply(n);
        n.querySelectorAll?.('.btn-magnetic').forEach(apply);
      })
    ));
    obs.observe(document.body, { childList: true, subtree: true });
    document.querySelectorAll('.btn-magnetic').forEach(apply);
  }
  return { init, apply };
})();


/* ═══════════════════════════════════════════════════════════
   5. CARD TILT 3D
═══════════════════════════════════════════════════════════ */
const CardTilt3D = (() => {
  const MAX_TILT = 9;
  function apply(card) {
    let shine = card.querySelector('.tilt-shine');
    if (!shine) {
      shine = document.createElement('div');
      shine.className = 'tilt-shine';
      shine.style.cssText = `position:absolute;inset:0;border-radius:inherit;pointer-events:none;
        background:radial-gradient(circle at 50% 50%,rgba(255,255,255,0.13),transparent 65%);
        opacity:0;transition:opacity 0.2s;z-index:2;`;
      card.style.position = card.style.position || 'relative';
      card.appendChild(shine);
    }
    let rafId;
    card.addEventListener('mousemove', e => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        const r  = card.getBoundingClientRect();
        const x  = (e.clientX - r.left) / r.width;
        const y  = (e.clientY - r.top)  / r.height;
        const rx = (y - 0.5) * -MAX_TILT * 2;
        const ry = (x - 0.5) *  MAX_TILT * 2;
        card.style.transform  = `perspective(900px) rotateX(${rx}deg) rotateY(${ry}deg) scale(1.025)`;
        card.style.transition = 'transform 0.08s';
        shine.style.background = `radial-gradient(circle at ${x*100}% ${y*100}%, rgba(255,255,255,0.18), transparent 60%)`;
        shine.style.opacity    = '1';
      });
    });
    card.addEventListener('mouseleave', () => {
      cancelAnimationFrame(rafId);
      card.style.transition = 'transform 0.55s cubic-bezier(0.34,1.56,0.64,1)';
      card.style.transform  = '';
      shine.style.opacity   = '0';
    });
  }
  function init() {
    const obs = new MutationObserver(muts => muts.forEach(m =>
      m.addedNodes.forEach(n => {
        if (n.nodeType !== 1) return;
        if (n.matches?.('.tilt-card')) apply(n);
        n.querySelectorAll?.('.tilt-card').forEach(apply);
      })
    ));
    obs.observe(document.body, { childList: true, subtree: true });
    document.querySelectorAll('.tilt-card').forEach(apply);
  }
  return { init, apply };
})();


/* ═══════════════════════════════════════════════════════════
   6. NUMBER COUNTER
═══════════════════════════════════════════════════════════ */
function NumberCounter(el, from, to, duration, suffix = '') {
  if (!el) return;
  animate({
    duration,
    easing: easeOutCubic,
    onUpdate: p => {
      el.textContent = Math.round(lerp(from, to, p)).toLocaleString() + suffix;
    }
  });
}


/* ═══════════════════════════════════════════════════════════
   7. PARTICLE TRAIL — 滑鼠移動粒子軌跡
═══════════════════════════════════════════════════════════ */
const ParticleTrail = (() => {
  let canvas, ctx, particles = [], animId;
  let mouseX = -999, mouseY = -999;
  let active = false;

  class TrailParticle {
    constructor(x, y) {
      this.x = x; this.y = y;
      this.vx = rand(-0.8, 0.8); this.vy = rand(-1.5, -0.3);
      this.r  = rand(1.5, 3.5);
      this.hue = rand(200, 280);
      this.life = 0; this.maxLife = rand(30, 60);
    }
    update() { this.x += this.vx; this.y += this.vy; this.vy += 0.04; this.life++; }
    draw() {
      const a = (1 - this.life / this.maxLife) * 0.7;
      ctx.save();
      ctx.globalAlpha = a;
      ctx.shadowBlur  = 8;
      ctx.shadowColor = `hsl(${this.hue},90%,70%)`;
      ctx.fillStyle   = `hsl(${this.hue},80%,75%)`;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    isDead() { return this.life >= this.maxLife; }
  }

  function loop() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles = particles.filter(p => !p.isDead());
    particles.forEach(p => { p.update(); p.draw(); });
    animId = requestAnimationFrame(loop);
  }

  function init() {
    canvas = document.createElement('canvas');
    canvas.id = 'trailCanvas';
    canvas.style.cssText = `position:fixed;inset:0;pointer-events:none;z-index:9998;`;
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
    document.body.appendChild(canvas);
    ctx = canvas.getContext('2d');

    window.addEventListener('resize', () => {
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;
    });

    let spawnTimer = 0;
    document.addEventListener('mousemove', e => {
      mouseX = e.clientX; mouseY = e.clientY;
      spawnTimer++;
      if (spawnTimer % 3 === 0) {
        for (let i = 0; i < 2; i++) particles.push(new TrailParticle(mouseX, mouseY));
      }
    });
    animId = requestAnimationFrame(loop);
  }
  return { init };
})();


/* ═══════════════════════════════════════════════════════════
   8. 注入必要的 CSS keyframes
═══════════════════════════════════════════════════════════ */
(function injectStyles() {
  const s = document.createElement('style');
  s.textContent = `
    @keyframes rippleAnim {
      from { transform:scale(0); opacity:1; }
      to   { transform:scale(1); opacity:0; }
    }
    @keyframes gearSpin { to { transform:rotate(360deg); } }
    @keyframes slamDown {
      0%   { transform:translateY(-140px) scale(1.5) rotate(-8deg); opacity:0; }
      55%  { transform:translateY(12px)   scale(0.93) rotate(2deg); opacity:1; }
      75%  { transform:translateY(-5px)   scale(1.03) rotate(-1deg); }
      100% { transform:translateY(0)      scale(1)    rotate(0deg); opacity:1; }
    }
    @keyframes popIn {
      0%   { transform:scale(0.4); opacity:0; }
      65%  { transform:scale(1.1); opacity:1; }
      100% { transform:scale(1);   opacity:1; }
    }
    @keyframes charSparkle {
      0%   { opacity:0; transform:translateY(38px) scale(0.5); filter:brightness(4) blur(2px); }
      50%  { filter:brightness(2) blur(0); }
      100% { opacity:1; transform:translateY(0) scale(1); filter:brightness(1); }
    }
    @keyframes flipIn {
      0%   { transform:perspective(600px) rotateY(-90deg); opacity:0; }
      100% { transform:perspective(600px) rotateY(0deg);   opacity:1; }
    }
    @keyframes shimmerBar {
      0%   { background-position:200% center; }
      100% { background-position:-200% center; }
    }
    @keyframes pulseGlow {
      0%,100% { box-shadow:0 0 20px rgba(59,130,246,0.4); }
      50%      { box-shadow:0 0 40px rgba(59,130,246,0.8), 0 0 80px rgba(124,58,237,0.4); }
    }
    @keyframes floatBob {
      0%,100% { transform:translateY(0); }
      50%      { transform:translateY(-8px); }
    }
    .gear-spin    { animation:gearSpin 0.7s linear infinite !important; display:inline-block; }
    .badge-slam   { animation:slamDown 0.75s cubic-bezier(0.34,1.56,0.64,1) forwards !important; }
    .score-pop-in { animation:popIn 0.55s cubic-bezier(0.34,1.56,0.64,1) both !important; }
    .splash-logo-in { animation:popIn 0.75s cubic-bezier(0.34,1.56,0.64,1) forwards !important; opacity:1 !important; }
    .char-in { animation:charSparkle 0.55s cubic-bezier(0.34,1.56,0.64,1) both !important; }
    .stats-reveal .result-mini-card:nth-child(1) { animation:flipIn 0.5s 0s    both; }
    .stats-reveal .result-mini-card:nth-child(2) { animation:flipIn 0.5s 0.18s both; }
    .stats-reveal .result-mini-card:nth-child(3) { animation:flipIn 0.5s 0.36s both; }
  `;
  document.head.appendChild(s);
})();


/* ═══════════════════════════════════════════════════════════
   9. AUTO INIT
═══════════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  RippleEffect.init();
  MagneticButton.init();
  CardTilt3D.init();
  ParticleTrail.init();
  SplashScreen.run();
});
