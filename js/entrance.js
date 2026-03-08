(function () {
  const hidden = JSON.parse(localStorage.getItem('neorgon-ghost') || '[]');
  hidden.forEach(id => {
    const card = document.querySelector(`.sites-grid .site-card[data-card-id="${id}"]`);
    if (card) card.style.display = 'none';
  });
})();


(function () {
  const cards = Array.from(document.querySelectorAll('.sites-section:not(.secret-section) .site-card[data-card-id]'))
    .filter(c => c.style.display !== 'none');
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    cards.forEach(c => { c.style.opacity = 1; });
    return;
  }
  const total = cards.length;
  cards.forEach((card, i) => {
    card.style.animationDelay = (i * 110) + 'ms';
  });
})();
