(function () {
  const PREFS_KEY = 'neorgon-prefs';
  const btn = document.getElementById('settingsBtn');
  const panel = document.getElementById('settingsPanel');
  if (!btn || !panel) return;

  const defaults = { sound: true, glow: true, previews: false, bg: 'stars', musicAutoMatch: true, musicTrack: null };

  function loadPrefs() {
    try { return Object.assign({}, defaults, JSON.parse(localStorage.getItem(PREFS_KEY))); }
    catch { return { ...defaults }; }
  }

  function savePrefs(p) { localStorage.setItem(PREFS_KEY, JSON.stringify(p)); }

  const prefs = loadPrefs();

  function applyPref(key, val) {
    prefs[key] = val;
    savePrefs(prefs);
    if (key === 'sound') window._neoSoundEnabled = val;
    if (key === 'glow') {
      const glow = document.getElementById('cursorGlow');
      if (glow) glow.style.display = val ? '' : 'none';
    }
    if (key === 'previews') window._neoPreviewsEnabled = val;
  }

  function initToggle(id, key) {
    const tog = document.getElementById(id);
    if (!tog) return;
    tog.classList.toggle('on', prefs[key]);
    tog.setAttribute('aria-checked', String(prefs[key]));
    applyPref(key, prefs[key]);
    tog.addEventListener('click', () => {
      const val = !prefs[key];
      tog.classList.toggle('on', val);
      tog.setAttribute('aria-checked', String(val));
      applyPref(key, val);
    });
  }

  initToggle('togSound', 'sound');
  initToggle('togGlow', 'glow');
  initToggle('togPreviews', 'previews');

  /* Music auto-match toggle */
  const togMusicMatch = document.getElementById('togMusicMatch');
  const musicTrackRow = document.getElementById('musicTrackRow');

  function applyMusicAutoMatch(val) {
    prefs.musicAutoMatch = val;
    savePrefs(prefs);
    if (togMusicMatch) {
      togMusicMatch.classList.toggle('on', val);
      togMusicMatch.setAttribute('aria-checked', String(val));
    }
    if (musicTrackRow) musicTrackRow.style.display = val ? 'none' : '';
    if (window._neoMusicAutoMatch) window._neoMusicAutoMatch(val);
  }

  applyMusicAutoMatch(prefs.musicAutoMatch);

  if (togMusicMatch) {
    togMusicMatch.addEventListener('click', () => applyMusicAutoMatch(!prefs.musicAutoMatch));
  }

  /* Music track picker */
  const musicPicker = document.getElementById('musicPicker');
  if (musicPicker) {
    const trackBtns = musicPicker.querySelectorAll('button[data-track]');
    const activeTrack = prefs.musicTrack || prefs.bg || 'stars';
    trackBtns.forEach(b => b.classList.toggle('active', b.dataset.track === activeTrack));

    trackBtns.forEach(b => {
      b.addEventListener('click', () => {
        prefs.musicTrack = b.dataset.track;
        savePrefs(prefs);
        trackBtns.forEach(btn => btn.classList.toggle('active', btn.dataset.track === b.dataset.track));
        if (window._neoMusicTrackSwitch) window._neoMusicTrackSwitch(b.dataset.track);
      });
    });
  }

  /* Background picker */
  const bgPicker = document.getElementById('bgPicker');
  if (bgPicker) {
    const bgBtns = bgPicker.querySelectorAll('button[data-bg]');

    function applyBg(mode) {
      prefs.bg = mode;
      savePrefs(prefs);
      bgBtns.forEach(b => b.classList.toggle('active', b.dataset.bg === mode));

      if (mode === 'stars') {
        if (window.matrixOff) window.matrixOff();
        if (window.interventionOff) window.interventionOff();
      } else {
        if (window.matrixKill) window.matrixKill();
        if (window.interventionKill) window.interventionKill();
        if (mode === 'matrix' && window.matrixOn) window.matrixOn();
        if (mode === 'intervention' && window.interventionOn) window.interventionOn();
      }

      /* Switch music to match background */
      if (window._neoMusicSwitch) window._neoMusicSwitch(mode);
    }

    /* Restore saved bg */
    bgBtns.forEach(b => b.classList.toggle('active', b.dataset.bg === prefs.bg));
    if (prefs.bg === 'matrix') {
      setTimeout(() => { if (window.matrixOn) window.matrixOn(); }, 100);
    } else if (prefs.bg === 'intervention') {
      setTimeout(() => { if (window.interventionOn) window.interventionOn(); }, 100);
    }

    bgBtns.forEach(b => {
      b.addEventListener('click', () => applyBg(b.dataset.bg));
    });

    /* Sync: if terminal toggles matrix, update picker */
    window._neoBgSync = function (mode) {
      prefs.bg = mode;
      savePrefs(prefs);
      bgBtns.forEach(b => b.classList.toggle('active', b.dataset.bg === prefs.bg));
    };
  }

  /* Global flags default to true */
  if (window._neoSoundEnabled === undefined) window._neoSoundEnabled = prefs.sound;

  btn.addEventListener('click', () => {
    const open = panel.classList.toggle('open');
    btn.classList.toggle('open', open);
  });

  document.addEventListener('click', e => {
    if (!panel.contains(e.target) && !btn.contains(e.target)) {
      panel.classList.remove('open');
      btn.classList.remove('open');
    }
  });

  /* ── Keyboard shortcut: , ───────────────────────────────────────── */
  document.addEventListener('keydown', e => {
    if (e.key !== ',') return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const tag = document.activeElement && document.activeElement.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || document.activeElement.isContentEditable) return;
    if (document.activeElement.closest('.term-overlay')) return;
    btn.click();
  });
})();
