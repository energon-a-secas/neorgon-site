/* ── Card reorder system (per-group) ──────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', function () {
  if (typeof Sortable === 'undefined') return;
  document.body.classList.add('drag-enabled');
  const grids = document.querySelectorAll('.card-group .sites-grid');
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
