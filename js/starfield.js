/* ── Starfield ─────────────────────────────────────────────────────────────── */
let warpMode = false;
let warpIntensity = 0;

(function () {
  const canvas = document.getElementById('starfield');
  const ctx = canvas.getContext('2d');
  let stars = [];
  let W, H, cx, cy;

  function resize() {
    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;
    cx = W / 2;
    cy = H / 2;
    stars = Array.from({ length: 200 }, (_, i) => {
      const twinkle = i < 20;
      return {
        x:      Math.random() * W,
        y:      Math.random() * H,
        r:      twinkle ? Math.random() * 1.2 + 0.8 : Math.random() * 1.4 + 0.3,
        base:   twinkle ? Math.random() * 0.15 + 0.03 : Math.random() * 0.6 + 0.1,
        speed:  twinkle ? Math.random() * 0.024 + 0.009 : Math.random() * 0.015 + 0.004,
        phase:  Math.random() * Math.PI * 2,
        twinkle,
        flareTimer: twinkle ? Math.random() * 400 : 0,
      };
    });
  }

  let wasWarp = false;

  function draw(t) {
    /* Ease warp intensity */
    const target = warpMode ? 1 : 0;
    warpIntensity += (target - warpIntensity) * 0.04;

    const isWarp = warpIntensity > 0.01;

    /* Drop out of hyperspace — bright flash, stars snap back */
    if (wasWarp && !isWarp) {
      stars.forEach(s => {
        s.x = Math.random() * W;
        s.y = Math.random() * H;
      });
    }
    wasWarp = isWarp;

    if (isWarp) {
      /* Solid clear each frame for clean streaks — no ghosting */
      ctx.fillStyle = `rgba(0, 9, 18, ${0.92 - warpIntensity * 0.2})`;
      ctx.fillRect(0, 0, W, H);
    } else {
      ctx.clearRect(0, 0, W, H);
    }

    const maxR = Math.sqrt(cx * cx + cy * cy);

    stars.forEach(s => {
      s.phase += s.speed;
      const opacity = s.base + 0.4 * Math.abs(Math.sin(s.phase));

      if (isWarp) {
        const dx = s.x - cx;
        const dy = s.y - cy;
        const dist = Math.sqrt(dx * dx + dy * dy) || 0.1;
        const angle = Math.atan2(dy, dx);
        const normDist = dist / maxR;

        /* Fast exponential acceleration */
        const accel = warpIntensity * (4 + normDist * normDist * 40);
        s.x += Math.cos(angle) * accel;
        s.y += Math.sin(angle) * accel;

        /* Long streaks — continuous tunnel */
        const streak = warpIntensity * (12 + normDist * normDist * maxR * 0.7);
        const tailX = s.x - Math.cos(angle) * streak;
        const tailY = s.y - Math.sin(angle) * streak;

        /* Brightness ramps with distance for depth */
        const bright = Math.min(1, 0.15 + normDist * 1.2);

        /* Draw radial streak with gradient */
        const grad = ctx.createLinearGradient(tailX, tailY, s.x, s.y);
        grad.addColorStop(0, `rgba(160, 200, 255, 0)`);
        grad.addColorStop(0.6, `rgba(190, 220, 255, ${bright * warpIntensity * 0.4})`);
        grad.addColorStop(1, `rgba(220, 240, 255, ${bright * warpIntensity})`);
        ctx.beginPath();
        ctx.moveTo(tailX, tailY);
        ctx.lineTo(s.x, s.y);
        ctx.strokeStyle = grad;
        ctx.lineWidth = 0.4 + s.r * warpIntensity * 0.8;
        ctx.stroke();

        /* Respawn at random depth along a radial line from center */
        if (s.x < -20 || s.x > W + 20 || s.y < -20 || s.y > H + 20) {
          const a = Math.random() * Math.PI * 2;
          const r = Math.random() * Math.random() * maxR * 0.4;
          s.x = cx + Math.cos(a) * r;
          s.y = cy + Math.sin(a) * r;
        }
      } else if (s.twinkle) {
        /* Twinkle stars — sharper oscillation + occasional bright flare with glow */
        s.flareTimer--;
        let flare = 0;
        if (s.flareTimer <= 0) {
          s.flareTimer = Math.random() * 500 + 200;
          flare = 1;
        }
        const twinkleOp = s.base + 0.85 * Math.pow(Math.abs(Math.sin(s.phase)), 3);
        const op = Math.min(1, twinkleOp + flare * 0.6);
        const glowR = s.r + (flare > 0 ? 3 : op > 0.6 ? 1.5 * op : 0);
        if (glowR > s.r) {
          ctx.save();
          ctx.shadowBlur = glowR * 4;
          ctx.shadowColor = 'rgba(180, 210, 255, 0.7)';
          ctx.beginPath();
          ctx.arc(s.x, s.y, s.r * 1.1, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(210, 230, 255, ${op})`;
          ctx.fill();
          ctx.restore();
        } else {
          ctx.beginPath();
          ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(210, 230, 255, ${twinkleOp})`;
          ctx.fill();
        }
      } else {
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(200, 220, 255, ${opacity})`;
        ctx.fill();
      }
    });

    requestAnimationFrame(draw);
  }

  resize();
  window.addEventListener('resize', resize);

  if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    requestAnimationFrame(draw);
  } else {
    draw(0);
  }
})();

/* ── Shared code-input lock ────────────────────────────────────────────────── */
window._neoCodeLock = false;
window._neoCodeCooldown = 0;
