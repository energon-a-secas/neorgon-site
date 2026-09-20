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

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const hoverPointer = window.matchMedia('(hover: hover)');
  const failed = new Set();
  let active = null;
  let timer = null;
  let waitingCard = null;

  function cardFor(target) {
    return target && target.closest && target.closest('.site-card[data-card-id], .site-card[data-echo-id]');
  }
  function idFor(card) { return card.dataset.cardId || card.dataset.echoId; }
  function titleFor(card) { return card.querySelector('.card-name').textContent.trim(); }
  function control(cls, label, html) {
    // Matches the existing favorite controls: no nested <button> inside a link.
    const el = document.createElement('span');
    el.className = cls;
    el.setAttribute('role', 'button');
    el.tabIndex = 0;
    el.setAttribute('aria-label', label);
    el.title = label;
    el.innerHTML = html;
    return el;
  }

  document.querySelectorAll('#tools .site-card[data-card-id]').forEach(card => {
    if (!PREVIEW_MAP[idFor(card)]) return;
    const button = control('card-preview-toggle', 'Preview ' + titleFor(card),
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>');
    button.setAttribute('aria-pressed', 'false');
    const top = card.querySelector('.card-top');
    top.insertBefore(button, top.querySelector('.card-arrow, .external-badge'));
  });

  function cancelTimer() {
    clearTimeout(timer);
    timer = null;
    waitingCard = null;
  }
  function hide(restoreFocus) {
    cancelTimer();
    if (!active) return;
    const old = active;
    active = null;
    old.image.onload = old.image.onerror = null;
    old.image.removeAttribute('src');
    old.layer.remove();
    old.card.classList.remove('is-previewing');
    old.trigger.setAttribute('aria-pressed', 'false');
    if (restoreFocus && old.trigger.isConnected) old.trigger.focus({ preventScroll: true });
  }

  function show(card, explicit) {
    cancelTimer();
    const id = idFor(card);
    if (!window._neoPreviewsEnabled || !PREVIEW_MAP[id] || (!explicit && failed.has(id))) return;
    hide(false);
    const layer = document.createElement('div');
    layer.className = 'card-preview visible';
    const caption = document.createElement('span');
    caption.className = 'card-preview-caption';
    caption.setAttribute('role', 'status');
    caption.textContent = 'Loading preview…';
    const close = control('card-preview-close', 'Close preview of ' + titleFor(card), '×');
    const image = new Image();
    image.alt = '';
    const trigger = card.querySelector('.card-preview-toggle');
    const entry = { card, layer, trigger, close, image, explicit };
    active = entry;
    trigger.setAttribute('aria-pressed', 'true');
    card.classList.add('is-previewing');
    layer.append(caption, close);
    card.appendChild(layer);
    // Under reduced motion only a canvas still is ever painted. The GIF is
    // decoded off-DOM, then released; CSS alone would merely hide an animation.
    image.onload = function () {
      if (active !== entry) return;
      if (reducedMotion.matches) {
        const canvas = document.createElement('canvas');
        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;
        canvas.setAttribute('aria-hidden', 'true');
        canvas.getContext('2d').drawImage(image, 0, 0);
        layer.prepend(canvas);
        image.onload = image.onerror = null;
        image.removeAttribute('src');
      } else {
        image.setAttribute('aria-hidden', 'true');
        layer.prepend(image);
      }
      failed.delete(id);
      caption.textContent = titleFor(card) + (reducedMotion.matches ? ' · Still preview' : ' · Preview');
    };
    image.onerror = function () {
      if (active !== entry) return;
      failed.add(id);
      caption.textContent = 'Preview unavailable. You can still open the tool.';
    };
    image.src = PREVIEW_PATH + PREVIEW_MAP[id];
    if (explicit) close.focus({ preventScroll: true });
  }

  function toggle(button) {
    const card = cardFor(button);
    if (active && active.card === card) hide(true);
    else show(card, true);
  }
  function previewControl(target) {
    return target.closest && target.closest('.card-preview-toggle, .card-preview-close');
  }
  // Delegation also covers shelf echoes created after this script runs.
  document.addEventListener('click', event => {
    const button = previewControl(event.target);
    if (button) {
      event.preventDefault();
      event.stopPropagation();
      if (button.classList.contains('card-preview-close')) hide(true);
      else toggle(button);
      return;
    }
    if (active) hide(false);
  }, true);
  document.addEventListener('keydown', event => {
    const button = previewControl(event.target);
    if (button && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      event.stopPropagation();
      if (button.classList.contains('card-preview-close')) hide(true);
      else toggle(button);
    } else if (event.key === 'Escape' && active) {
      event.preventDefault();
      event.stopPropagation();
      hide(active.explicit);
    }
  }, true);
  document.addEventListener('pointerover', event => {
    if (event.pointerType === 'touch' || !hoverPointer.matches || !window._neoPreviewsEnabled) return;
    const card = cardFor(event.target);
    if (!card || card.contains(event.relatedTarget) || !PREVIEW_MAP[idFor(card)]) return;
    if (active && active.explicit) return;
    cancelTimer();
    waitingCard = card;
    timer = setTimeout(() => show(card, false), HOVER_DELAY);
  });
  document.addEventListener('pointerout', event => {
    const card = cardFor(event.target);
    if (!card || card.contains(event.relatedTarget)) return;
    if (waitingCard === card) cancelTimer();
    if (active && active.card === card && !active.explicit) hide(false);
  });
  document.addEventListener('focusin', event => {
    if (active && event.target !== active.close &&
        (active.explicit || !active.card.contains(event.target))) hide(false);
  });
  document.addEventListener('input', event => {
    if (event.target.id === 'heroSearch') hide(false);
  });
  document.addEventListener('dragstart', () => hide(false), true);
  document.addEventListener('visibilitychange', () => { if (document.hidden) hide(false); });
  function syncPref() {
    document.body.classList.toggle('previews-enabled', !!window._neoPreviewsEnabled);
    if (!window._neoPreviewsEnabled) hide(false);
  }
  document.addEventListener('neorgon:previews-change', syncPref);
  reducedMotion.addEventListener('change', () => {
    if (active) show(active.card, active.explicit);
  });
  syncPref();
})();
