(function () {
  const el = document.getElementById('heroTyping');
  const cursor = document.getElementById('typingCursor');
  if (!el) return;

  const text = 'real problems';
  let i = 0;

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    el.textContent = text;
    if (cursor) cursor.remove();
    return;
  }

  function type() {
    if (i <= text.length) {
      el.textContent = text.slice(0, i);
      i++;
      setTimeout(type, 70 + Math.random() * 50);
    } else {
      setTimeout(() => { if (cursor) cursor.style.display = 'none'; }, 2000);
    }
  }

  setTimeout(type, 200);
})();


(function () {
  const el = document.getElementById('badgeText');
  if (!el) return;
  const phrases = [
    'Built different \u00b7 Shipped anyway',
    'No signup \u00b7 No regrets',
    'Open source \u00b7 Closed mouths',
    'Free forever \u00b7 No catch',
    'Made with spite \u00b7 And good taste',
    'Zero dependencies \u00b7 Maximum vibes',
    'Works offline \u00b7 Works online \u00b7 Just works',
    'Not another SaaS \u00b7 You\'re welcome',
  ];
  let idx = 0;
  setInterval(function () {
    el.style.opacity = '0';
    setTimeout(function () {
      idx = (idx + 1) % phrases.length;
      el.textContent = phrases[idx];
      el.style.opacity = '1';
    }, 400);
  }, 5000);
})();
