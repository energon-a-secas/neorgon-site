(function () {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const glow = document.getElementById('cursorGlow');
  if (!glow) return;
  let active = false;

  document.addEventListener('mousemove', e => {
    if (!active) { glow.classList.add('active'); active = true; }
    glow.style.left = e.clientX + 'px';
    glow.style.top = e.clientY + 'px';
  });

  document.addEventListener('mouseleave', () => {
    glow.classList.remove('active');
    active = false;
  });
})();
