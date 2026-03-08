(function () {
  const btn = document.getElementById('musicToggle');
  if (!btn) return;

  /* ── Playlist ───────────────────────────────────────────────────── */
  const TRACKS = {
    stars:        'NkNy9qDWiAw',
    intervention: 'EQLJ1I3CFfg',
    matrix:       'ZIjfK4MGrGI'
  };

  let playing = false;
  let player = null;
  let playerReady = false;
  let pendingPlay = false;
  let currentVideoId = null;

  /* ── Icon spin ──────────────────────────────────────────────────── */
  const SPIN_DEG_PER_SEC = 45; /* one full rotation every 8 s */
  let spinAngle = 0;
  let spinRaf = null;
  let spinLast = null;
  const spinSvg = btn.querySelector('svg');

  function spinTick(ts) {
    if (spinLast !== null) {
      spinAngle = (spinAngle + SPIN_DEG_PER_SEC * (ts - spinLast) / 1000) % 360;
      if (spinSvg) spinSvg.style.transform = `rotate(${spinAngle}deg)`;
    }
    spinLast = ts;
    spinRaf = requestAnimationFrame(spinTick);
  }

  function startSpin() {
    if (spinRaf) return;
    spinLast = null;
    spinRaf = requestAnimationFrame(spinTick);
  }

  function stopSpin() {
    if (spinRaf) { cancelAnimationFrame(spinRaf); spinRaf = null; }
    spinLast = null;
    /* angle is intentionally kept — resume picks up where it left off */
  }

  function resetSpin() {
    stopSpin();
    spinAngle = 0;
    if (spinSvg) spinSvg.style.transform = '';
  }

  /* ── Helpers ────────────────────────────────────────────────────── */
  function getPrefs() {
    try { return JSON.parse(localStorage.getItem('neorgon-prefs') || '{}'); }
    catch { return {}; }
  }

  function resolveTrack() {
    const prefs = getPrefs();
    const autoMatch = prefs.musicAutoMatch !== false;
    const mode = autoMatch
      ? (prefs.bg || 'stars')
      : (prefs.musicTrack || prefs.bg || 'stars');
    return TRACKS[mode] || TRACKS.stars;
  }

  /* ── Playback ───────────────────────────────────────────────────── */
  function doPlay(videoId) {
    if (!player || !playerReady) { pendingPlay = true; return; }

    /* Mute first so browsers allow autoplay, then restore volume */
    player.mute();

    if (currentVideoId !== videoId) {
      /* Track changed — restart spin from zero */
      resetSpin();
      currentVideoId = videoId;
      player.loadVideoById({ videoId, startSeconds: 0 });
    } else {
      player.playVideo();
    }

    startSpin();

    setTimeout(() => {
      if (playing && player) { player.unMute(); player.setVolume(35); }
    }, 600);
  }

  function doStop() {
    stopSpin();
    if (player && playerReady) player.pauseVideo();
  }

  /* ── YouTube IFrame API ─────────────────────────────────────────── */
  window.onYouTubeIframeAPIReady = function () {
    /* No initial videoId — start empty so the first loadVideoById
       is always a clean user-gesture-triggered action.
       Use youtube-nocookie.com: privacy-enhanced mode with fewer
       signature-protection layers that can block embedding. */
    player = new YT.Player('ytMusicPlayer', {
      host: 'https://www.youtube-nocookie.com',
      playerVars: {
        autoplay: 0,
        controls: 0,
        rel: 0,
        modestbranding: 1,
        origin: window.location.origin
      },
      events: {
        onReady: function (e) {
          playerReady = true;
          e.target.setVolume(35);
          if (pendingPlay && playing) {
            pendingPlay = false;
            doPlay(resolveTrack());
          }
        },
        onStateChange: function (e) {
          /* Manual loop — replay on end */
          if (e.data === YT.PlayerState.ENDED && playing) {
            e.target.playVideo();
          }
        },
        onError: function (e) {
          /* 101/150 = embedding not allowed by video owner */
          currentVideoId = null;
          console.warn('[music] YouTube player error code:', e.data,
            e.data === 101 || e.data === 150
              ? '— embedding disabled for this video'
              : '');
        }
      }
    });
  };

  /* ── Cross-module hooks ─────────────────────────────────────────── */

  /* Called by settings when background changes */
  window._neoMusicSwitch = function (mode) {
    if (getPrefs().musicAutoMatch === false) return;
    if (playing) doPlay(TRACKS[mode] || TRACKS.stars);
  };

  /* Called when auto-match toggle changes */
  window._neoMusicAutoMatch = function () {
    if (playing) doPlay(resolveTrack());
  };

  /* Called when user manually picks a track */
  window._neoMusicTrackSwitch = function (track) {
    if (playing) doPlay(TRACKS[track] || TRACKS.stars);
  };

  /* ── Button ─────────────────────────────────────────────────────── */
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    btn.style.display = 'none';
    return;
  }

  btn.addEventListener('click', () => {
    if (window._neoSoundEnabled === false) return;
    if (playing) {
      doStop();
      playing = false;
      btn.classList.remove('playing');
    } else {
      playing = true;
      btn.classList.add('playing');
      doPlay(resolveTrack());
    }
  });
})();
