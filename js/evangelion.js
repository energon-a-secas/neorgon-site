(function () {
  const canvas = document.getElementById('evangelionCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let active = false;
  let animId = null;
  let frame = 0;
  let introActive = false;

  /* ── Config ──────────────────────────────────────────────── */
  const PURPLE_DARK = '#0a001a';
  const PURPLE_MID = '#1a0033';
  const EVA_GREEN = '#00ff41';
  const EVA_ORANGE = '#ff6600';
  const NERV_RED = '#cc0000';
  const HEX_SIZE = 40;

  /* ── Hex grid (AT Field) ─────────────────────────────────── */
  function drawHexGrid(W, H, t) {
    const hexH = HEX_SIZE * Math.sqrt(3);
    const cols = Math.ceil(W / (HEX_SIZE * 1.5)) + 2;
    const rows = Math.ceil(H / hexH) + 2;

    ctx.save();
    ctx.strokeStyle = `rgba(128, 0, 255, ${0.06 + 0.02 * Math.sin(t * 0.001)})`;
    ctx.lineWidth = 0.5;

    for (let row = -1; row < rows; row++) {
      for (let col = -1; col < cols; col++) {
        const x = col * HEX_SIZE * 1.5;
        const y = row * hexH + (col % 2 ? hexH / 2 : 0);
        drawHex(x, y, HEX_SIZE * 0.95);
      }
    }
    ctx.restore();
  }

  function drawHex(cx, cy, r) {
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 3) * i - Math.PI / 6;
      const x = cx + r * Math.cos(angle);
      const y = cy + r * Math.sin(angle);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.stroke();
  }

  /* ── Targeting reticles ──────────────────────────────────── */
  const reticles = [];
  function initReticles(W, H) {
    reticles.length = 0;
    for (let i = 0; i < 3; i++) {
      reticles.push({
        x: W * (0.2 + Math.random() * 0.6),
        y: H * (0.2 + Math.random() * 0.6),
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        size: 30 + Math.random() * 20,
        rot: Math.random() * Math.PI * 2,
      });
    }
  }

  function drawReticle(r, t) {
    ctx.save();
    ctx.translate(r.x, r.y);
    ctx.rotate(r.rot + t * 0.0005);
    const s = r.size;
    const pulse = 1 + 0.05 * Math.sin(t * 0.003);

    ctx.strokeStyle = `rgba(0, 255, 65, ${0.15 + 0.05 * Math.sin(t * 0.002)})`;
    ctx.lineWidth = 1;

    ctx.beginPath();
    ctx.arc(0, 0, s * pulse, 0, Math.PI * 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(0, 0, s * 0.6 * pulse, 0, Math.PI * 2);
    ctx.stroke();

    const gap = 0.3;
    for (let i = 0; i < 4; i++) {
      const a = (Math.PI / 2) * i;
      ctx.beginPath();
      ctx.arc(0, 0, s * 1.3 * pulse, a - gap, a + gap);
      ctx.stroke();
    }

    const crossLen = s * 0.4;
    ctx.beginPath();
    ctx.moveTo(-crossLen, 0); ctx.lineTo(crossLen, 0);
    ctx.moveTo(0, -crossLen); ctx.lineTo(0, crossLen);
    ctx.stroke();

    ctx.restore();
  }

  /* ── Data readout text ───────────────────────────────────── */
  const dataLines = [
    'MAGI SYSTEM ONLINE', 'SYNC RATIO: ███.█%', 'LCL PRESSURE: NOMINAL',
    'AT FIELD: DEPLOYED', 'PATTERN: BLUE', 'ENTRY PLUG: INSERTED',
    'NEURAL LINK: ACTIVE', 'EVANGELION UNIT-01', 'NERV HQ: TOKYO-3',
    'DUMMY PLUG: STANDBY', 'S² ENGINE: ACTIVE', 'PROGRESSIVE KNIFE: READY',
    'UMBILICAL CABLE: OK', 'INTERNAL BATTERY: 5:00',
  ];

  function drawDataReadout(W, H, t) {
    ctx.save();
    ctx.font = '10px monospace';
    ctx.fillStyle = `rgba(0, 255, 65, ${0.12 + 0.04 * Math.sin(t * 0.002)})`;

    const lineH = 14;
    const scroll = (t * 0.015) % (dataLines.length * lineH);

    for (let i = 0; i < dataLines.length; i++) {
      const y = 30 + i * lineH - scroll;
      if (y < -lineH || y > H) continue;
      ctx.fillText(dataLines[i], 12, y);
    }

    ctx.textAlign = 'right';
    const rightLines = [
      `FRAME: ${String(frame).padStart(6, '0')}`,
      `DEPTH: ${(Math.sin(t * 0.001) * 500 + 800).toFixed(1)}m`,
      `TEMP: ${(36.5 + Math.sin(t * 0.0015) * 2).toFixed(1)}°C`,
      `PILOT: CONNECTED`,
    ];
    for (let i = 0; i < rightLines.length; i++) {
      ctx.fillText(rightLines[i], W - 12, 30 + i * lineH);
    }

    ctx.restore();
  }

  /* ── Scanlines ───────────────────────────────────────────── */
  function drawScanlines(W, H, t) {
    for (let y = 0; y < H; y += 3) {
      ctx.fillStyle = `rgba(0, 0, 0, ${y % 6 < 3 ? 0.12 : 0.04})`;
      ctx.fillRect(0, y, W, 1);
    }

    const bandY = ((t * 0.2) % (H + 300)) - 150;
    const grad = ctx.createLinearGradient(0, bandY - 80, 0, bandY + 80);
    grad.addColorStop(0, 'rgba(128, 0, 255, 0)');
    grad.addColorStop(0.5, 'rgba(128, 0, 255, 0.04)');
    grad.addColorStop(1, 'rgba(128, 0, 255, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, bandY - 80, W, 160);
  }

  /* ── Main draw loop ──────────────────────────────────────── */
  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    if (reticles.length === 0) initReticles(canvas.width, canvas.height);
  }

  function draw() {
    if (!active) return;
    frame++;
    const W = canvas.width;
    const H = canvas.height;
    const t = frame;

    ctx.fillStyle = PURPLE_DARK;
    ctx.fillRect(0, 0, W, H);

    const bgGrad = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.max(W, H) * 0.7);
    bgGrad.addColorStop(0, 'rgba(40, 0, 80, 0.3)');
    bgGrad.addColorStop(0.5, 'rgba(20, 0, 50, 0.1)');
    bgGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, W, H);

    drawHexGrid(W, H, t);

    for (const r of reticles) {
      r.x += r.vx;
      r.y += r.vy;
      r.rot += 0.002;
      if (r.x < 50 || r.x > W - 50) r.vx *= -1;
      if (r.y < 50 || r.y > H - 50) r.vy *= -1;
      drawReticle(r, t);
    }

    drawDataReadout(W, H, t);
    drawScanlines(W, H, t);

    if (Math.random() < 0.006) {
      const tearY = Math.random() * H;
      const tearH = 1 + Math.random() * 3;
      const shift = (Math.random() - 0.5) * 8;
      ctx.drawImage(canvas, 0, tearY, W, tearH, shift, tearY, W, tearH);
    }

    const vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.7);
    vg.addColorStop(0, 'rgba(0, 0, 0, 0)');
    vg.addColorStop(1, 'rgba(0, 0, 0, 0.35)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, W, H);

    animId = requestAnimationFrame(draw);
  }

  window.addEventListener('resize', () => { if (active) resize(); });

  /* ── Intro transition ────────────────────────────────────── */
  window.evangelionOn = function () {
    if (active || introActive) return;
    introActive = true;
    resize();
    canvas.style.opacity = '1';
    canvas.classList.add('active');

    let introFrame = 0;
    const INTRO_DURATION = 80;
    const W = canvas.width, H = canvas.height;

    function introStep() {
      if (!introActive) return;
      introFrame++;

      if (introFrame <= 20) {
        if (introFrame === 1) document.getElementById('starfield').style.opacity = '0';
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, W, H);

        if (introFrame % 2 === 0) {
          ctx.fillStyle = `rgba(128, 0, 255, ${0.3 + Math.random() * 0.4})`;
          const bH = H * (0.1 + Math.random() * 0.3);
          ctx.fillRect(0, Math.random() * H, W, bH);
        }

        for (let i = 0; i < 15; i++) {
          const y = Math.random() * H;
          const h = 1 + Math.random() * 4;
          ctx.fillStyle = `rgba(${Math.random() > 0.5 ? '128,0,255' : '0,255,65'}, ${Math.random() * 0.6})`;
          ctx.fillRect(0, y, W, h);
        }

        if (introFrame === 1 && window._neoSoundEnabled !== false && window._neoSoundPing) {
          window._neoSoundPing(120, 0.12);
          setTimeout(() => window._neoSoundPing(80, 0.1), 100);
          setTimeout(() => window._neoSoundPing(200, 0.15), 200);
        }

      } else if (introFrame <= 45) {
        const progress = (introFrame - 20) / 25;
        ctx.fillStyle = PURPLE_DARK;
        ctx.fillRect(0, 0, W, H);

        ctx.save();
        ctx.font = `bold ${Math.min(W, H) * 0.15}px monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = `rgba(128, 0, 255, ${progress * 0.4})`;
        ctx.fillText('NERV', W / 2, H / 2 - 20);
        ctx.font = `${Math.min(W, H) * 0.035}px monospace`;
        ctx.fillStyle = `rgba(0, 255, 65, ${progress * 0.3})`;
        ctx.fillText('GOD\'S IN HIS HEAVEN. ALL\'S RIGHT WITH THE WORLD.', W / 2, H / 2 + Math.min(W, H) * 0.1);
        ctx.restore();

        drawScanlines(W, H, introFrame);

      } else if (introFrame <= 65) {
        const fade = (introFrame - 45) / 20;
        ctx.fillStyle = PURPLE_DARK;
        ctx.fillRect(0, 0, W, H);

        ctx.save();
        ctx.font = `bold ${Math.min(W, H) * 0.15}px monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = `rgba(128, 0, 255, ${0.4 * (1 - fade)})`;
        ctx.fillText('NERV', W / 2, H / 2 - 20);
        ctx.restore();

        drawHexGrid(W, H, introFrame);
        drawScanlines(W, H, introFrame);

        if (introFrame === 50) document.body.classList.add('evangelion-bg');

      } else {
        introActive = false;
        active = true;
        frame = 0;
        initReticles(W, H);
        draw();
        return;
      }

      requestAnimationFrame(introStep);
    }

    requestAnimationFrame(introStep);
  };

  /* ── Exit ────────────────────────────────────────────────── */
  window.evangelionOff = function () {
    if (introActive) {
      if (window.evangelionKill) window.evangelionKill();
      return;
    }
    if (!active) return;
    active = false;
    if (animId) cancelAnimationFrame(animId);
    document.body.classList.remove('evangelion-bg');

    const W = canvas.width, H = canvas.height;
    let outFrame = 0;
    const TOTAL = 40;

    function outStep() {
      outFrame++;
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, W, H);

      if (outFrame <= 20) {
        const t = outFrame / 20;
        const visH = Math.max(2, H * (1 - t * t));
        const yOff = (H - visH) / 2;
        ctx.fillStyle = `rgba(128, 0, 255, ${0.3 * (1 - t)})`;
        ctx.fillRect(0, yOff, W, visH);
      } else if (outFrame <= TOTAL) {
        const t = (outFrame - 20) / 20;
        const alpha = (1 - t) * (1 - t);
        ctx.save();
        ctx.shadowBlur = 15 * alpha;
        ctx.shadowColor = `rgba(128, 0, 255, ${alpha})`;
        ctx.beginPath();
        ctx.arc(W / 2, H / 2, 3 * (1 - t), 0, Math.PI * 2);
        ctx.fillStyle = `rgba(128, 0, 255, ${alpha})`;
        ctx.fill();
        ctx.restore();

        if (outFrame === 25) document.getElementById('starfield').style.opacity = '';
      } else {
        ctx.clearRect(0, 0, W, H);
        canvas.classList.remove('active');
        canvas.style.opacity = '';
        return;
      }

      requestAnimationFrame(outStep);
    }

    requestAnimationFrame(outStep);
  };

  /* ── Instant kill ────────────────────────────────────────── */
  window.evangelionKill = function () {
    active = false;
    introActive = false;
    canvas.classList.remove('active');
    canvas.style.opacity = '';
    document.body.classList.remove('evangelion-bg');
    document.getElementById('starfield').style.opacity = '';
    if (animId) cancelAnimationFrame(animId);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  /* ── NERV Warning System ─────────────────────────────────── */
  let warningActive = false;
  let warningAnimId = null;

  window.nervWarning = function (level) {
    if (warningActive) return;
    warningActive = true;

    const overlay = document.getElementById('nervWarningOverlay');
    if (!overlay) return;

    const lvl = (level || 'blue').toLowerCase();
    overlay.className = 'nerv-warning-overlay';
    overlay.classList.add('active', `nerv-level-${lvl}`);

    const labelEl = overlay.querySelector('.nerv-warning-label');
    const subEl = overlay.querySelector('.nerv-warning-sub');
    const typeEl = overlay.querySelector('.nerv-warning-type');

    const configs = {
      blue: {
        label: '警告',
        sub: 'WARNING',
        type: 'PATTERN BLUE — ANGEL DETECTED',
        duration: 5000,
      },
      red: {
        label: '緊急',
        sub: 'EMERGENCY',
        type: 'ALL PERSONNEL TO BATTLE STATIONS',
        duration: 6000,
      },
      orange: {
        label: '注意',
        sub: 'CAUTION',
        type: 'EVANGELION UNIT-01 — BERSERK MODE',
        duration: 5500,
      },
    };

    const cfg = configs[lvl] || configs.blue;

    if (labelEl) labelEl.textContent = cfg.label;
    if (subEl) subEl.textContent = cfg.sub;
    if (typeEl) typeEl.textContent = cfg.type;

    if (window._neoSoundEnabled !== false && window._neoSoundPing) {
      const freqs = lvl === 'red' ? [300, 200, 300, 200] : [250, 180, 250];
      freqs.forEach((f, i) => setTimeout(() => window._neoSoundPing(f, 0.15), i * 200));
    }

    let wFrame = 0;
    function flashStep() {
      wFrame++;
      const bars = overlay.querySelectorAll('.nerv-bar');
      const flashOn = wFrame % 20 < 10;
      bars.forEach(b => b.style.opacity = flashOn ? '1' : '0.3');

      if (warningActive) warningAnimId = requestAnimationFrame(flashStep);
    }
    warningAnimId = requestAnimationFrame(flashStep);

    setTimeout(() => {
      warningActive = false;
      if (warningAnimId) cancelAnimationFrame(warningAnimId);
      overlay.classList.remove('active');
    }, cfg.duration);
  };

  window.nervWarningDismiss = function () {
    warningActive = false;
    if (warningAnimId) cancelAnimationFrame(warningAnimId);
    const overlay = document.getElementById('nervWarningOverlay');
    if (overlay) overlay.classList.remove('active');
  };
})();
