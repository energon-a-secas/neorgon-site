(function () {
  const canvas = document.getElementById('matrixCanvas');
  if (!canvas) return;
  const mCtx = canvas.getContext('2d');
  let active = false;
  let animId = null;
  let drops = [];
  let colSpeed = [];     /* per-column speed multiplier */
  let slowMode = true;   /* background mode = slow */
  let collapsing = false;
  let collapseAlpha = 1;

  const chars = 'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン0123456789NEORGON';
  const COL_W = 14;

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const cols = Math.floor(canvas.width / COL_W);
    drops = Array.from({ length: cols }, () => Math.random() * -50);
    colSpeed = Array.from({ length: cols }, () => 0.6 + Math.random() * 0.8);
  }

  function draw() {
    if (!active && !collapsing) return;

    if (collapsing) {
      drawCollapse();
      return;
    }

    const speed = slowMode ? 0.35 : 1;
    const fade = slowMode ? 0.035 : 0.06;

    mCtx.fillStyle = `rgba(0, 9, 18, ${fade})`;
    mCtx.fillRect(0, 0, canvas.width, canvas.height);
    mCtx.font = '13px monospace';

    for (let i = 0; i < drops.length; i++) {
      const char = chars[Math.floor(Math.random() * chars.length)];
      const x = i * COL_W;
      const y = drops[i] * COL_W;

      const brightness = Math.random();
      if (brightness > 0.95) mCtx.fillStyle = '#fff';
      else if (brightness > 0.8) mCtx.fillStyle = '#5f5';
      else mCtx.fillStyle = `rgba(0, ${150 + Math.floor(Math.random() * 105)}, 0, 0.8)`;

      mCtx.fillText(char, x, y);
      if (y > canvas.height && Math.random() > 0.975) drops[i] = 0;
      drops[i] += speed * colSpeed[i];
    }
    animId = requestAnimationFrame(draw);
  }

  /* Collapse exit — snapshot into column slices that fall at random speeds */
  let colSlices = [];

  function startCollapse() {
    collapsing = true;
    collapseAlpha = 1;
    /* Snapshot current canvas into an offscreen copy */
    const snap = document.createElement('canvas');
    snap.width = canvas.width;
    snap.height = canvas.height;
    snap.getContext('2d').drawImage(canvas, 0, 0);

    const cols = Math.floor(canvas.width / COL_W);
    colSlices = Array.from({ length: cols }, (_, i) => ({
      img: snap,
      sx: i * COL_W,
      y: 0,
      speed: 1 + Math.random() * 4,
      accel: 0.15 + Math.random() * 0.4,
      rot: (Math.random() - 0.5) * 0.02,
      rotV: 0,
    }));
    animId = requestAnimationFrame(draw);
  }

  function drawCollapse() {
    mCtx.clearRect(0, 0, canvas.width, canvas.height);

    /* Check if all slices have fallen off the bottom */
    const allGone = colSlices.every(sl => sl.y > canvas.height + 100);

    if (allGone) {
      collapsing = false;
      colSlices = [];
      canvas.style.opacity = '';
      mCtx.clearRect(0, 0, canvas.width, canvas.height);
      return;
    }

    let visible = 0;
    for (const sl of colSlices) {
      sl.speed += sl.accel;
      sl.y += sl.speed;
      sl.rotV += sl.rot;

      if (sl.y > canvas.height + canvas.height) continue;
      visible++;

      mCtx.save();
      mCtx.translate(sl.sx + COL_W / 2, sl.y + canvas.height / 2);
      mCtx.rotate(sl.rotV);
      mCtx.drawImage(sl.img, sl.sx, 0, COL_W, canvas.height, -COL_W / 2, -canvas.height / 2, COL_W, canvas.height);
      mCtx.restore();
    }

    animId = requestAnimationFrame(draw);
  }

  window.addEventListener('resize', () => { if (active) resize(); });

  /* Activate matrix */
  function matrixOn() {
    if (active) return;
    active = true;
    collapsing = false;
    resize();
    canvas.classList.add('active');
    document.body.classList.add('matrix-bg');
    document.getElementById('starfield').style.opacity = '0';
    draw();
  }

  /* Deactivate matrix with collapse */
  function matrixOff() {
    if (!active) return;
    active = false;
    document.body.classList.remove('matrix-bg');
    document.getElementById('starfield').style.opacity = '';
    if (animId) cancelAnimationFrame(animId);
    /* Keep canvas visible during collapse — bypass CSS transition */
    canvas.style.opacity = '0.7';
    canvas.classList.remove('active');
    startCollapse();
  }

  /* Instant kill — no exit animation (for switching between bg modes) */
  function matrixKill() {
    if (!active && !collapsing) return;
    active = false;
    collapsing = false;
    colSlices = [];
    canvas.classList.remove('active');
    canvas.style.opacity = '';
    document.body.classList.remove('matrix-bg');
    document.getElementById('starfield').style.opacity = '';
    if (animId) cancelAnimationFrame(animId);
    mCtx.clearRect(0, 0, canvas.width, canvas.height);
  }

  /* Public API */
  window.toggleMatrix = function () {
    if (active) matrixOff(); else matrixOn();
    return active;
  };
  window.matrixOn = matrixOn;
  window.matrixOff = matrixOff;
  window.matrixKill = matrixKill;
  window.isMatrixActive = function () { return active; };
})();
