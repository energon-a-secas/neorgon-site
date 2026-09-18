(function () {
  const HOVER_DELAY = 1200;
  const PREVIEW_PATH = 'assets/previews/';
  const PREVIEW_MAP = {
    portent: 'portent.gif',
    gamme: 'gamme.gif',
    aficion: 'aficion.gif',
    dispatch: 'dispatch.gif',
    vitrina: 'vitrina.gif',
    pixeldoll: 'pixeldoll.gif',
    boardwright: 'boardwright.gif',
    enjeu: 'enjeu.gif',
    rushq: 'rushq.gif',
    rewind: 'rewind.gif',
    sortie: 'sortie.gif',
    neokeys: 'neokeys.gif',
    carnet: 'carnet.gif',
    cadrage: 'cadrage.gif',
    mosaic: 'mosaic.gif',
    releve: 'releve.gif',
    echeance: 'echeance.gif',
    quiz: 'quiz.gif',
    rappel: 'rappel.gif',
    runcible: 'runcible.gif',
    floorplan: 'floorplan.gif',
    proctor: 'proctor.gif',
    primer: 'primer.gif',
    headmap: 'headmap.gif',
    playbook: 'playbook.gif',
    parla: 'parla.gif',
    hiringpack: 'hiringpack.gif',
    minimap: 'minimap.gif',
    gamebin: 'gamebin.gif',
    teamplay: 'teamplay.gif',
    guildhall: 'guildhall.gif',
    anatomy: 'anatomy.gif',
    awesomesites: 'awesomesites.gif',
    stash: 'stash.gif',
    glassbox: 'glassbox.gif',
    agentlore: 'agentlore.gif',
    promptforge: 'promptforge.gif',
    sitrep: 'sitrep.gif',
    runbook: 'runbook.gif',
    lockdown: 'lockdown.gif',
    safeguard: 'safeguard.gif',
    cardforge: 'cardforge.gif',
    loadout: 'loadout.gif',
    doorman: 'doorman.gif',
    mettle: 'mettle.gif',
    questline: 'questline.gif',
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
    'resume-forge': 'resume-forge.gif',
    tubestack: 'tubestack.gif',
    stackrank: 'stackrank.gif',
  };

  /* The off default, claimed only if nobody has claimed it.
     settings.js loads BEFORE this file and has already published the visitor's
     saved `previews` pref by the time we get here, so a plain assignment
     overwrites it: the toggle rendered on, `aria-pressed="true"`, and the
     feature was off, with nothing on screen to explain why. Same guard
     settings.js already uses for _neoSoundEnabled, and unlike swapping the two
     script tags it cannot be undone by a future reorder. */
  if (window._neoPreviewsEnabled === undefined) window._neoPreviewsEnabled = false;

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
