/* ── Secret section — proximity scanner + Kamino reveal ───────────────────── */
(function () {
  const btn = document.getElementById('secretToggle');
  const section = document.getElementById('secretSection');
  if (!btn || !section) return;

  const SCAN_RADIUS = 320;
  let scanInterval = null;
  let lastPingTime = 0;

  /* Proximity sonar — pings faster as mouse approaches */
  document.addEventListener('mousemove', e => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const rect = btn.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dist = Math.hypot(e.clientX - cx, e.clientY - cy);

    if (dist < SCAN_RADIUS && !section.classList.contains('revealed')) {
      btn.classList.add('scanning');

      /* Ping rate: closer = faster (200ms to 800ms) */
      const proximity = 1 - (dist / SCAN_RADIUS);
      const interval = 800 - proximity * 600;
      const now = Date.now();

      if (now - lastPingTime > interval && window._neoSound && window._neoSoundEnabled !== false) {
        lastPingTime = now;
        /* Sonar ping — frequency rises with proximity */
        const freq = 600 + proximity * 800;
        const vol = 0.03 + proximity * 0.06;
        if (window._neoSoundPing) window._neoSoundPing(freq, vol);
      }

      /* Visual: button opacity scales with proximity */
      btn.style.opacity = 0.12 + proximity * 0.35;
    } else {
      btn.classList.remove('scanning');
      if (!section.classList.contains('revealed')) {
        btn.style.opacity = '';
      }
    }
  });

  /* Click — Kamino reveal */
  btn.addEventListener('click', () => {
    const opening = section.classList.toggle('revealed');
    btn.setAttribute('aria-expanded', opening);

    if (opening) {
      btn.classList.remove('scanning');
      btn.classList.add('revealed');
      btn.style.opacity = '';

      /* Burst effect */
      const burst = btn.querySelector('.discovery-burst');
      burst.classList.remove('active');
      void burst.offsetWidth;
      burst.classList.add('active');

      /* Discovery sound */
      if (window._neoSoundDiscover) window._neoSoundDiscover();

      setTimeout(() => {
        section.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 300);
    } else {
      btn.classList.remove('revealed');
    }
  });
})();
