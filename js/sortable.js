/* ── Card reorder system (per-group) ──────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', function () {
  if (typeof Sortable === 'undefined') return;
  document.body.classList.add('drag-enabled');
  const grids = document.querySelectorAll('.card-group:not(#catalogSearchMerged) .sites-grid');
  grids.forEach(grid => {
    Sortable.create(grid, {
      animation: 200,
      ghostClass: 'sortable-ghost',
      dragClass: 'sortable-drag',
      chosenClass: 'sortable-chosen',
      easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
      delay: 120,
      delayOnTouchOnly: true,
      touchStartThreshold: 5,
      /* The controls inside a card are not drag surfaces. Without this a
         mousedown on a tag, on the `+N` chip or on the favorites strip begins a
         card drag, so every one of those controls is competing with the gesture
         that moves the card it sits in. `filter` is the reason `.card-tag` can
         carry `cursor: pointer` honestly. */
      filter: '.card-tag, .card-tag-more, .card-tools, .card-preview-toggle, .card-preview-close',
      preventOnFilter: false,
      onStart() { if (window._neoSound) window._neoSound.dragStart(); },
      onEnd() { if (window._neoSound) window._neoSound.dropCard(); },
    });
  });

  window.exportCardOrder = function () {
    const order = getCurrentOrder();
    const json = JSON.stringify(order, null, 2);
    console.log('Current card order:', json);
    return json;
  };

  window.importCardOrder = function (json) {
    try {
      const order = typeof json === 'string' ? JSON.parse(json) : json;
      if (!Array.isArray(order)) throw new Error('Expected an array');
      const valid = order.every(id => DEFAULT_ORDER.includes(id));
      if (!valid || order.length !== DEFAULT_ORDER.length) {
        throw new Error('Invalid card IDs or wrong count');
      }
      applyOrder(order);
      saveOrder(order);
      console.log('Card order imported and saved.');
    } catch (e) {
      console.error('Import failed:', e.message);
    }
  };
});
