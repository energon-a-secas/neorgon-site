/* ── Multi-tool card navigation ─────────────────────────────────────────── */
document.querySelectorAll('.site-card.multi-tool').forEach(card => {
  const popup = card.querySelector('.card-subtool-popup');

  function openPopup() {
    card.classList.add('popup-open');
    if (popup) {
      const first = popup.querySelector('.subtool-item');
      if (first) first.focus();
    }
  }

  function closePopup() {
    card.classList.remove('popup-open');
    card.focus();
  }

  /* Click on card body (not on popup items) opens popup */
  card.addEventListener('click', e => {
    if (!e.target.closest('.card-subtool-popup')) {
      e.preventDefault();
      if (card.classList.contains('popup-open')) {
        closePopup();
      } else {
        openPopup();
      }
    }
  });

  /* Keyboard: Enter/Space toggles popup; Escape closes it */
  card.addEventListener('keydown', e => {
    if ((e.key === 'Enter' || e.key === ' ') && !e.target.closest('.card-subtool-popup')) {
      e.preventDefault();
      if (card.classList.contains('popup-open')) {
        closePopup();
      } else {
        openPopup();
      }
    }
    if (e.key === 'Escape' && card.classList.contains('popup-open')) {
      e.preventDefault();
      closePopup();
    }
  });

  /* Close popup when focus leaves the card entirely */
  card.addEventListener('focusout', e => {
    requestAnimationFrame(() => {
      if (!card.contains(document.activeElement)) {
        card.classList.remove('popup-open');
      }
    });
  });
});

/* ── Ghost card unlock ─────────────────────────────────────────────────────── */
document.querySelectorAll('.ghost-card').forEach(card => {
  function unlock() {
    card.classList.add('unlocked');
    card.setAttribute('aria-disabled', 'false');
    if (window._neoSound) window._neoSound.unlock();
  }
  card.addEventListener('click', e => {
    if (card.classList.contains('unlocked')) return;
    e.preventDefault();
    unlock();
  });
  card.addEventListener('keydown', e => {
    if ((e.key === 'Enter' || e.key === ' ') && !card.classList.contains('unlocked')) {
      e.preventDefault();
      unlock();
    }
  });
});

/* ── Card arrow: pointer shortcut that opens the tool in a new tab ─────────
   Deliberately pointer-only: the arrow stays aria-hidden and unfocusable,
   because Cmd or Ctrl+Enter on the focused card is already the keyboard path
   to a new tab, and a nested control would add ~55 tab stops for no new
   ability. The tooltip rides an SVG <title> child (the HTML title attribute
   does not tooltip on svg elements). Stamped once at boot; cloneNode copies
   children, so every echo in the rail and the favorites shelf inherits it.
   Listeners are delegated because cloneNode drops them. */
(function () {
  document.querySelectorAll('svg.card-arrow').forEach(arrow => {
    const tip = document.createElementNS('http://www.w3.org/2000/svg', 'title');
    tip.textContent = 'Opens in a new tab';
    arrow.insertBefore(tip, arrow.firstChild);
  });

  function hrefFor(arrow) {
    const a = arrow.closest('a[href]'); /* live, archived, echoes, unlocked ghost */
    if (a) return a.href;
    const card = arrow.closest('.site-card');
    return (card && card.dataset.href) || null; /* multi-tool cards */
  }

  /* Capture phase, on purpose: the multi-tool popup and ghost unlock bind on
     the card element, so a bubbling delegate would run after the popup had
     already opened. */
  document.addEventListener('click', e => {
    const arrow = e.target.closest && e.target.closest('.card-arrow');
    if (!arrow) return;
    /* A modified click keeps the browser's own behavior on the anchor. */
    if (e.ctrlKey || e.metaKey || e.shiftKey || e.button !== 0) return;
    const ghost = arrow.closest('.ghost-card');
    if (ghost && !ghost.classList.contains('unlocked')) return;
    const href = hrefFor(arrow);
    if (!href) return;
    e.preventDefault();
    e.stopPropagation();
    window.open(href, '_blank', 'noopener,noreferrer');
  }, true);
})();
