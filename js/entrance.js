(function () {
  const hidden = JSON.parse(localStorage.getItem('neorgon-ghost') || '[]');
  hidden.forEach(id => {
    const card = document.querySelector(`.sites-grid .site-card[data-card-id="${id}"]`);
    if (card) card.style.display = 'none';
  });
})();


/* ── Card entrance stagger ────────────────────────────────────────────────────
   This used to be one global timeline: `delay = index * 110ms` across every card
   in the catalog. At 49 cards the last one waited 5.3s, and the wait grew with
   every tool shipped — the stagger got slower the more there was to show.

   It also leaked. js/recent.js builds the Recently shipped rail by cloning these
   cards, and cloneNode copies inline styles, so an echo inherited its original's
   `animation-delay` and overrode the rail's own `var(--echo-delay)`. The shelf
   whose entire job is "look what just shipped" was the last thing on the page to
   appear, seconds after the catalog it exists to introduce. recent.js now clears
   that inherited value; the cap here is the other half of the fix.

   Each group staggers its own cards against a cap, so the reveal costs the same
   half-second whether the hub holds 40 cards or 200.
─────────────────────────────────────────────────────────────────────────────── */
(function () {
  const STEP = 55;   /* ms between two cards in the same group */
  const CAP = 8;     /* … and no card waits longer than this many steps */

  const cards = Array.from(document.querySelectorAll('.sites-section:not(.secret-section) .site-card[data-card-id]'))
    .filter(c => c.style.display !== 'none');

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    /* `opacity: 1` alone was not enough: cardEnter is `forwards` and still ran
       at delay 0, so the motion happened anyway. Cancel the animation. */
    cards.forEach(c => { c.style.animation = 'none'; c.style.opacity = 1; });
    return;
  }

  const seen = new Map();
  cards.forEach(card => {
    const group = card.closest('.card-group') || card.parentElement;
    const i = seen.get(group) || 0;
    seen.set(group, i + 1);
    card.style.animationDelay = (Math.min(i, CAP) * STEP) + 'ms';
  });
})();
