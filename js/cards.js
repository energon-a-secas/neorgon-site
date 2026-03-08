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
