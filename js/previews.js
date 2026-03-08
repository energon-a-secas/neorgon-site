(function () {
  const HOVER_DELAY = 1200;
  const PREVIEW_PATH = 'assets/previews/';
  const PREVIEW_MAP = {
    pathfinder: 'pathfinder.gif',
    infradrills: 'infradrills.gif',
    skillmap: 'skillmap.gif',
    clientsays: 'clientsays.gif',
    decisionwheel: 'decisionwheel.gif',
    references: 'references.gif',
    jsonstudio: 'jsonstudio.gif',
    slides: 'slides.gif',
    emojis: 'emojis.gif',
    memes: 'memes.gif',
    charactersheet: 'charactersheet.gif',
    ogstudio: 'og-studio.gif',
    buyhacks: 'buyhacks.gif',
    snippets: 'snippets.gif',
    vibecheck: 'vibecheck.gif',
    autopilot: 'autopilot.gif',
    rushq: 'rushq.gif',
    ehq: 'ehq.gif',
  };

  /* Global flag — settings panel sets this */
  window._neoPreviewsEnabled = false;

  const failed = new Set();

  document.querySelectorAll('.site-card[data-card-id]').forEach(function (card) {
    const id = card.dataset.cardId;
    if (!PREVIEW_MAP[id]) return;

    let timer = null;
    let previewEl = null;

    function getOrCreatePreview() {
      if (previewEl) return previewEl;
      previewEl = document.createElement('div');
      previewEl.className = 'card-preview';
      previewEl.innerHTML = '<img alt="" loading="lazy">';
      card.appendChild(previewEl);
      return previewEl;
    }

    function show() {
      if (!window._neoPreviewsEnabled) return;
      if (failed.has(id)) return;
      var el = getOrCreatePreview();
      var img = el.querySelector('img');
      if (!img.src || img.src === location.href) {
        img.src = PREVIEW_PATH + PREVIEW_MAP[id];
        img.onerror = function () {
          failed.add(id);
          el.classList.remove('visible');
          img.removeAttribute('src');
        };
      }
      el.classList.add('visible');
    }

    function hide() {
      clearTimeout(timer);
      timer = null;
      if (previewEl) previewEl.classList.remove('visible');
    }

    card.addEventListener('mouseenter', function () {
      if (!window._neoPreviewsEnabled) return;
      if (failed.has(id)) return;
      timer = setTimeout(show, HOVER_DELAY);
    });
    card.addEventListener('mouseleave', hide);
    card.addEventListener('dragstart', hide);
  });
})();
