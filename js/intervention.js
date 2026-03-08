(function () {
  const canvas = document.getElementById('interventionCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let active = false;
  let animId = null;
  let frame = 0;
  let introActive = false; /* true while broadcast takeover intro is running */

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }

  /* Load the real Death Note L logo SVG as an Image for canvas drawing */
  const lImg = new Image();
  let lReady = false;
  lImg.onload = () => { lReady = true; };
  lImg.src = 'assets/icons/l-death-note-logo.svg';

  function draw() {
    if (!active) return;
    frame++;
    const W = canvas.width;
    const H = canvas.height;

    /* Solid white base */
    ctx.fillStyle = '#f0f0ee';
    ctx.fillRect(0, 0, W, H);

    /* Static scanlines — fixed alternating pattern */
    for (let y = 0; y < H; y += 3) {
      ctx.fillStyle = (y % 6 < 3) ? 'rgba(0, 0, 0, 0.06)' : 'rgba(0, 0, 0, 0.025)';
      ctx.fillRect(0, y, W, 1);
    }

    /* Single slow rolling bright band */
    const bandY = ((frame * 0.3) % (H + 200)) - 100;
    const bandGrad = ctx.createLinearGradient(0, bandY - 50, 0, bandY + 50);
    bandGrad.addColorStop(0, 'rgba(255, 255, 255, 0)');
    bandGrad.addColorStop(0.4, 'rgba(255, 255, 255, 0.08)');
    bandGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0.18)');
    bandGrad.addColorStop(0.6, 'rgba(255, 255, 255, 0.08)');
    bandGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = bandGrad;
    ctx.fillRect(0, bandY - 50, W, 100);

    /* Rare horizontal glitch tear */
    if (Math.random() < 0.008) {
      const tearY = Math.random() * H;
      const tearH = 2 + Math.random() * 4;
      const shift = (Math.random() - 0.5) * 15;
      ctx.drawImage(canvas, 0, tearY, W, tearH, shift, tearY, W, tearH);
    }

    /* Rare VHS tracking wobble */
    if (frame % 300 < 4) {
      const wobbY = Math.random() * H;
      const wobbH = 15 + Math.random() * 30;
      ctx.drawImage(canvas, 0, wobbY, W, wobbH, Math.sin(frame * 0.3) * 2, wobbY, W, wobbH);
    }

    /* Death Note L logo — centered, screen-sized */
    if (lReady) {
      const lSize = Math.min(W, H) * 0.7;
      const aspect = lImg.naturalWidth / lImg.naturalHeight;
      const lH = lSize;
      const lW = lH * aspect;
      const lAlpha = 0.5 + 0.05 * Math.sin(frame * 0.003);

      ctx.save();
      ctx.globalAlpha = lAlpha;
      ctx.drawImage(lImg, (W - lW) / 2, (H - lH) / 2, lW, lH);
      ctx.restore();
    }

    /* Soft vignette */
    const vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.72);
    vg.addColorStop(0, 'rgba(0, 0, 0, 0)');
    vg.addColorStop(1, 'rgba(0, 0, 0, 0.05)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, W, H);

    animId = requestAnimationFrame(draw);
  }

  window.addEventListener('resize', () => { if (active) resize(); });

  window.interventionOn = function () {
    if (active || introActive) return;
    introActive = true;
    resize();
    canvas.style.opacity = '1';
    canvas.classList.add('active');

    /* Broadcast takeover intro — glitch → static → white → L */
    let introFrame = 0;
    const INTRO_DURATION = 65; /* ~1.1s at 60fps */
    const W = canvas.width, H = canvas.height;

    function introStep() {
      if (!introActive) return; /* killed mid-intro */
      introFrame++;
      const progress = introFrame / INTRO_DURATION;

      if (introFrame <= 15) {
        /* Phase 1: Rapid static bursts — signal interference */
        if (introFrame === 1) document.getElementById('starfield').style.opacity = '0';
        ctx.fillStyle = '#000912';
        ctx.fillRect(0, 0, W, H);
        /* Random horizontal static bands */
        for (let i = 0; i < 30; i++) {
          const y = Math.random() * H;
          const bH = 1 + Math.random() * 6;
          const v = Math.floor(Math.random() * 200 + 50);
          ctx.fillStyle = `rgb(${v},${v},${v})`;
          ctx.fillRect(0, y, W, bH);
        }
        /* Horizontal tear — shift slices */
        for (let i = 0; i < 5; i++) {
          const y = Math.random() * H;
          const h = 10 + Math.random() * 30;
          const shift = (Math.random() - 0.5) * 60;
          ctx.drawImage(canvas, 0, y, W, h, shift, y, W, h);
        }
        /* Flash between dark and light */
        if (introFrame % 3 === 0) {
          ctx.fillStyle = `rgba(255, 255, 255, ${0.3 + Math.random() * 0.5})`;
          ctx.fillRect(0, 0, W, H);
        }

        /* Play glitch sound */
        if (introFrame === 1 && window._neoSoundEnabled !== false && window._neoSoundPing) {
          window._neoSoundPing(200, 0.15);
          setTimeout(() => window._neoSoundPing(150, 0.12), 80);
          setTimeout(() => window._neoSoundPing(100, 0.1), 160);
        }

      } else if (introFrame <= 35) {
        /* Phase 2: Full white static — TV between channels */
        const noiseData = ctx.createImageData(W, H);
        const nd = noiseData.data;
        for (let i = 0; i < nd.length; i += 4) {
          const v = 140 + Math.floor(Math.random() * 115);
          nd[i] = v; nd[i + 1] = v; nd[i + 2] = v; nd[i + 3] = 255;
        }
        ctx.putImageData(noiseData, 0, 0);
        /* Scanline overlay */
        ctx.fillStyle = 'rgba(0, 0, 0, 0.04)';
        for (let y = 0; y < H; y += 3) ctx.fillRect(0, y, W, 1);

      } else if (introFrame <= 50) {
        /* Phase 3: Static settling — noise fading to white */
        const fade = (introFrame - 35) / 15;
        ctx.fillStyle = '#f0f0ee';
        ctx.fillRect(0, 0, W, H);
        /* Diminishing noise */
        const noiseAmount = (1 - fade) * 0.15;
        const id = ctx.getImageData(0, 0, W, H);
        const dd = id.data;
        for (let p = 0; p < W * H * noiseAmount; p++) {
          const idx = Math.floor(Math.random() * W * H) * 4;
          const delta = Math.floor((Math.random() - 0.5) * 80 * (1 - fade));
          dd[idx] = Math.max(0, Math.min(255, dd[idx] + delta));
          dd[idx + 1] = Math.max(0, Math.min(255, dd[idx + 1] + delta));
          dd[idx + 2] = Math.max(0, Math.min(255, dd[idx + 2] + delta));
        }
        ctx.putImageData(id, 0, 0);
        /* Scanlines appearing */
        ctx.fillStyle = `rgba(0, 0, 0, ${0.03 * fade})`;
        for (let y = 0; y < H; y += 3) ctx.fillRect(0, y, W, 1);

        /* L logo fading in */
        if (lReady) {
          const lSize = Math.min(W, H) * 0.7;
          const aspect = lImg.naturalWidth / lImg.naturalHeight;
          const lH = lSize;
          const lW = lH * aspect;
          ctx.save();
          ctx.globalAlpha = fade * 0.5;
          ctx.drawImage(lImg, (W - lW) / 2, (H - lH) / 2, lW, lH);
          ctx.restore();
        }

        /* Apply body theme partway through */
        if (introFrame === 40) document.body.classList.add('intervention-bg');

      } else {
        /* Phase 4: Transition complete — start normal draw loop */
        introActive = false;
        active = true;
        frame = 0;
        draw();
        return;
      }

      requestAnimationFrame(introStep);
    }

    requestAnimationFrame(introStep);
  };

  window.interventionOff = function () {
    if (introActive) {
      /* Called during intro — just kill instantly */
      if (window.interventionKill) window.interventionKill();
      return;
    }
    if (!active) return;
    active = false;
    if (animId) cancelAnimationFrame(animId);
    document.body.classList.remove('intervention-bg');

    /* Classic CRT power-off — collapse to horizontal line → dot → gone */
    const W = canvas.width, H = canvas.height;
    /* Snapshot current screen */
    const snap = document.createElement('canvas');
    snap.width = W; snap.height = H;
    snap.getContext('2d').drawImage(canvas, 0, 0);

    let outFrame = 0;
    const COLLAPSE_FRAMES = 18;  /* vertical collapse to line */
    const LINE_FRAMES = 14;      /* line shrinks to dot */
    const GLOW_FRAMES = 20;      /* dot/glow fades out */
    const TOTAL = COLLAPSE_FRAMES + LINE_FRAMES + GLOW_FRAMES;

    function outStep() {
      outFrame++;
      ctx.clearRect(0, 0, W, H);

      /* Dark background throughout */
      ctx.fillStyle = '#000912';
      ctx.fillRect(0, 0, W, H);

      if (outFrame <= COLLAPSE_FRAMES) {
        /* Phase 1: Image collapses vertically to a bright horizontal line */
        const t = outFrame / COLLAPSE_FRAMES;
        const ease = t * t; /* accelerating */
        const visH = Math.max(2, H * (1 - ease));
        const yOff = (H - visH) / 2;

        /* Draw squished snapshot */
        ctx.save();
        ctx.globalAlpha = 1 - ease * 0.3;
        ctx.drawImage(snap, 0, 0, W, H, 0, yOff, W, visH);
        ctx.restore();

        /* Bright edge glow as it compresses */
        ctx.fillStyle = `rgba(220, 230, 255, ${ease * 0.6})`;
        ctx.fillRect(0, yOff - 1, W, 2);
        ctx.fillRect(0, yOff + visH - 1, W, 2);

      } else if (outFrame <= COLLAPSE_FRAMES + LINE_FRAMES) {
        /* Phase 2: Bright horizontal line shrinks to center dot */
        const t = (outFrame - COLLAPSE_FRAMES) / LINE_FRAMES;
        const ease = t * t;
        const lineW = Math.max(4, W * (1 - ease));
        const lineX = (W - lineW) / 2;
        const lineH = Math.max(2, 3 * (1 - ease * 0.7));

        /* Bright white line */
        ctx.fillStyle = `rgba(240, 245, 255, ${1 - ease * 0.3})`;
        ctx.fillRect(lineX, H / 2 - lineH / 2, lineW, lineH);

        /* Glow around line */
        ctx.save();
        ctx.shadowBlur = 15 - ease * 10;
        ctx.shadowColor = 'rgba(200, 220, 255, 0.8)';
        ctx.fillStyle = `rgba(255, 255, 255, ${0.8 - ease * 0.5})`;
        ctx.fillRect(lineX + 2, H / 2 - 1, lineW - 4, 2);
        ctx.restore();

      } else if (outFrame <= TOTAL) {
        /* Phase 3: Center dot glow fades */
        const t = (outFrame - COLLAPSE_FRAMES - LINE_FRAMES) / GLOW_FRAMES;
        const alpha = (1 - t) * (1 - t);
        const dotR = 4 * (1 - t * 0.5);

        ctx.save();
        ctx.shadowBlur = 20 * alpha;
        ctx.shadowColor = `rgba(200, 220, 255, ${alpha})`;
        ctx.beginPath();
        ctx.arc(W / 2, H / 2, dotR, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(240, 245, 255, ${alpha})`;
        ctx.fill();
        ctx.restore();

        /* Restore starfield partway through fade */
        if (outFrame === COLLAPSE_FRAMES + LINE_FRAMES + 5) {
          document.getElementById('starfield').style.opacity = '';
        }
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

  /* Instant kill — no exit animation */
  window.interventionKill = function () {
    active = false;
    introActive = false; /* cancel intro if running */
    canvas.classList.remove('active');
    canvas.style.opacity = '';
    document.body.classList.remove('intervention-bg');
    document.getElementById('starfield').style.opacity = '';
    if (animId) cancelAnimationFrame(animId);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };
})();
