/* ── Konami Code — Warp Drive ─────────────────────────────────────────────── */
(function () {
  const code = [38,38,40,40,37,39,37,39,66,65];
  const labels = ['↑','↑','↓','↓','←','→','←','→','B','A'];
  const arrows = {
    38: '<polyline points="12 19 12 5"/><polyline points="5 12 12 5 19 12"/>',
    40: '<polyline points="12 5 12 19"/><polyline points="5 12 12 19 19 12"/>',
    37: '<polyline points="19 12 5 12"/><polyline points="12 5 5 12 12 19"/>',
    39: '<polyline points="5 12 19 12"/><polyline points="12 5 19 12 12 19"/>',
  };
  let pos = 0;
  let hideTimer = null;

  const hud = document.getElementById('konamiHud');

  function buildHud() {
    if (!hud) return;
    hud.innerHTML = '';
    for (let i = 0; i < code.length; i++) {
      const key = document.createElement('div');
      key.className = 'konami-key';
      if (arrows[code[i]]) {
        key.innerHTML = `<svg viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round">${arrows[code[i]]}</svg>`;
      } else {
        key.textContent = labels[i];
      }
      hud.appendChild(key);
    }
  }

  function showHud() {
    if (!hud) return;
    clearTimeout(hideTimer);
    hud.classList.add('visible');
  }

  function hideHud(delay) {
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => {
      if (hud) hud.classList.remove('visible');
      setTimeout(() => {
        if (hud) hud.querySelectorAll('.konami-key').forEach(k => {
          k.classList.remove('hit', 'miss');
        });
      }, 300);
    }, delay || 1500);
  }

  function updateHud(step, hit) {
    if (!hud) return;
    const keys = hud.querySelectorAll('.konami-key');
    if (hit) {
      if (keys[step]) keys[step].classList.add('hit');
    } else {
      keys.forEach(k => { if (!k.classList.contains('hit')) k.classList.add('miss'); });
      setTimeout(() => {
        keys.forEach(k => k.classList.remove('hit', 'miss'));
      }, 400);
    }
  }

  buildHud();

  document.addEventListener('keydown', e => {
    if (window._neoCodeLock && pos === 0) return;
    if (Date.now() < window._neoCodeCooldown && pos === 0) return;

    if (e.keyCode === code[pos]) {
      if (pos === 0) {
        window._neoCodeLock = true;
        showHud();
      }
      if (window._neoSound) window._neoSound.konamiKey(pos);
      updateHud(pos, true);
      pos++;
      if (pos === code.length) {
        hideHud(800);
        pos = 0;
        window._neoCodeCooldown = Date.now() + 3000;
        setTimeout(() => { window._neoCodeLock = false; }, 3000);
        engageWarp();
      }
    } else {
      if (pos > 0) {
        if (window._neoSound) window._neoSound.konamiFail(pos);
        updateHud(pos, false);
        hideHud(1000);
        window._neoCodeLock = false;
      }
      pos = 0;
    }
  });

  const destinations = [
    'Space Chile 🌶️',
    'Space Argentina 🥩',
    'Space Brazil 🪐',
    'Space México 🌮',
    'Space Colombia ☕',
    'Perusalem 🏔️',
    'Space Patagonia 🧊',
    'The Atacama Nebula 🔭',
    'Sector Machu Picchu 🗿',
    'Rio de Janebula ✨',
    'Cartagena Station 🚀',
    'The Andes Belt 🏔️',
  ];
  let lastDest = -1;

  window.engageWarp = function engageWarp() {
    if (warpMode) return;
    warpMode = true;
    document.body.classList.add('warp-active');
    if (window._neoSound) window._neoSound.warpEngage();

    const toast = document.getElementById('warpToast');
    toast.classList.add('visible');

    setTimeout(() => toast.classList.remove('visible'), 1200);
    setTimeout(() => {
      warpMode = false;
      document.body.classList.remove('warp-active');

      /* Show arrival destination after flash clears */
      setTimeout(() => {
        let idx;
        do { idx = Math.floor(Math.random() * destinations.length); } while (idx === lastDest);
        lastDest = idx;
        const arrivalToast = document.getElementById('arrivalToast');
        document.getElementById('arrivalDest').textContent = destinations[idx];
        arrivalToast.classList.add('visible');
        setTimeout(() => arrivalToast.classList.remove('visible'), 3000);
      }, 600);
    }, 2500);
  }
})();

/* ── Retro Cheat Codes ──────────────────────────────────────────────────── */
(function () {
  var cheatToast = document.getElementById('cheatToast');
  var cheatTimer = null;

  function showCheat(html, color, duration) {
    if (!cheatToast) return;
    cheatToast.innerHTML = html;
    cheatToast.style.textShadow = '0 0 30px ' + color + ', 0 0 60px ' + color.replace('1)', '.5)');
    cheatToast.classList.add('visible');
    clearTimeout(cheatTimer);
    cheatTimer = setTimeout(function () { cheatToast.classList.remove('visible'); }, duration || 2000);
  }

  /* ── Cheat HUD ─────────────────────────────────────────── */
  var hud = document.getElementById('cheatHud');
  var hudLabel = document.getElementById('cheatHudLabel');
  var hudKeys = document.getElementById('cheatHudKeys');
  var hudTimer = null;
  var activeCode = null;
  var activePos = 0;

  function buildCheatHud(code, label) {
    if (!hud || !hudKeys) return;
    hudKeys.innerHTML = '';
    hud.setAttribute('data-code', code);
    if (hudLabel) hudLabel.textContent = label;
    for (var i = 0; i < code.length; i++) {
      var key = document.createElement('div');
      key.className = 'konami-key';
      key.textContent = code[i].toUpperCase();
      hudKeys.appendChild(key);
    }
  }

  function showCheatHud() {
    if (!hud) return;
    clearTimeout(hudTimer);
    hud.classList.add('visible');
  }

  function hideCheatHud(delay) {
    clearTimeout(hudTimer);
    hudTimer = setTimeout(function () {
      if (hud) hud.classList.remove('visible');
      setTimeout(function () { resetCheatHud(); }, 300);
    }, delay || 1200);
  }

  function resetCheatHud() {
    if (!hudKeys) return;
    hudKeys.querySelectorAll('.konami-key').forEach(function (k) {
      k.classList.remove('hit', 'miss');
    });
    activeCode = null;
    activePos = 0;
  }

  function hitCheatKey(step) {
    if (!hudKeys) return;
    var keys = hudKeys.querySelectorAll('.konami-key');
    if (keys[step]) keys[step].classList.add('hit');
  }

  function missCheatHud() {
    if (!hudKeys) return;
    hudKeys.querySelectorAll('.konami-key').forEach(function (k) {
      if (!k.classList.contains('hit')) k.classList.add('miss');
    });
    hideCheatHud(800);
  }

  /* ── Cheat registry ────────────────────────────────────── */
  var cheatList = [
    { code: 'iddqd',        label: 'Doom',          fn: activateGodMode },
    { code: 'abacabb',      label: 'Mortal Kombat',  fn: activateBloodCode },
    { code: 'justinbailey', label: 'Metroid',        fn: activateSuitMode },
    { code: 'hesoyam',      label: 'GTA San Andreas', fn: activateHesoyam },
    { code: 'sega',         label: 'Sega',           fn: activateSega },
  ];

  document.addEventListener('keydown', function (e) {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    if (e.target.closest('.term-overlay')) return;
    if (e.key.length !== 1) return;
    if (window._neoCodeLock && !activeCode) return;
    if (Date.now() < window._neoCodeCooldown && !activeCode) return;
    var ch = e.key.toLowerCase();

    if (activeCode) {
      if (ch === activeCode.code[activePos]) {
        if (window._neoSound) window._neoSound.cheatKey(activePos, activeCode.code.length);
        hitCheatKey(activePos);
        activePos++;
        if (activePos === activeCode.code.length) {
          hideCheatHud(600);
          activeCode.fn();
          activeCode = null;
          activePos = 0;
          window._neoCodeCooldown = Date.now() + 3000;
          setTimeout(function () { window._neoCodeLock = false; }, 3000);
        }
      } else {
        if (window._neoSound) window._neoSound.cheatFail(activePos);
        missCheatHud();
        activeCode = null;
        activePos = 0;
        window._neoCodeLock = false;
      }
      return;
    }

    for (var i = 0; i < cheatList.length; i++) {
      if (ch === cheatList[i].code[0]) {
        window._neoCodeLock = true;
        activeCode = cheatList[i];
        activePos = 0;
        buildCheatHud(activeCode.code, activeCode.label);
        showCheatHud();
        if (window._neoSound) window._neoSound.cheatKey(0, activeCode.code.length);
        hitCheatKey(0);
        activePos = 1;
        clearTimeout(hudTimer);
        hudTimer = setTimeout(function () {
          if (activeCode) {
            if (window._neoSound) window._neoSound.cheatFail(activePos);
            missCheatHud();
            activeCode = null;
            activePos = 0;
            window._neoCodeLock = false;
          }
        }, 4000);
        return;
      }
    }
  });

  /* ── IDDQD — Doom God Mode ────────────────────────────── */
  var godActive = false;
  function activateGodMode() {
    godActive = !godActive;
    document.body.classList.toggle('god-mode', godActive);
    if (godActive) {
      if (window._neoSound) window._neoSound.doomGodMode();
      showCheat('God Mode<div class="cheat-sub">IDDQD — Degreelessness</div>', 'rgba(255,215,0,1)', 2500);
    } else {
      showCheat('Mortal Again', 'rgba(255,215,0,1)', 1500);
    }
  }

  /* ── ABACABB — Mortal Kombat Blood Code ───────────────── */
  function activateBloodCode() {
    if (window._neoSound) window._neoSound.mkBloodCode();
    showCheat('Blood Code<div class="cheat-sub">ABACABB — Mortal Kombat</div>', 'rgba(220,38,38,1)', 2500);

    var starfield = document.getElementById('starfield');
    if (starfield) starfield.style.filter = 'hue-rotate(-40deg) saturate(3)';

    var count = 80;
    for (var i = 0; i < count; i++) {
      (function (delay) {
        setTimeout(function () {
          var p = document.createElement('div');
          p.className = 'blood-particle';
          p.style.left = Math.random() * 100 + 'vw';
          p.style.top = '-10px';
          p.style.height = (8 + Math.random() * 20) + 'px';
          p.style.opacity = (0.4 + Math.random() * 0.5).toString();
          document.body.appendChild(p);
          var duration = 1200 + Math.random() * 2000;
          p.style.transition = 'top ' + duration + 'ms linear, opacity ' + (duration * 0.3) + 'ms ease ' + (duration * 0.7) + 'ms';
          requestAnimationFrame(function () {
            p.style.top = '110vh';
            p.style.opacity = '0';
          });
          setTimeout(function () { p.remove(); }, duration + 200);
        }, delay);
      })(Math.random() * 3000);
    }

    setTimeout(function () {
      if (starfield) starfield.style.filter = '';
    }, 8000);
  }

  /* ── Justin Bailey — Metroid Suit Mode ────────────────── */
  var suitActive = false;
  var originalDescs = [];
  var altDescs = [
    { id: 'pathfinder', text: 'Samus would use this to plan her Zebes escape route.' },
    { id: 'skillmap', text: 'Morph Ball → Bombs → Screw Attack. Map your upgrades.' },
    { id: 'infradrills', text: 'Mother Brain\'s infrastructure was full of misconfigs.' },
    { id: 'snippets', text: 'Even bounty hunters need cheat sheets.' },
    { id: 'lockdown', text: 'Space Pirates HATE this one weird security trick.' },
    { id: 'jsonstudio', text: 'Chozo artifacts were just nested JSON all along.' },
    { id: 'references', text: 'Every Metroid boss is a cultural reference if you think about it.' },
    { id: 'slides', text: 'Briefing slides for the Galactic Federation.' },
    { id: 'ogstudio', text: 'Social previews for your bounty hunter portfolio.' },
    { id: 'decisionwheel', text: 'Spin to decide: fight Ridley or run.' },
    { id: 'memes', text: 'Y CAN\'T METROID CRAWL' },
    { id: 'clientsays', text: 'The client says "circle back" but in Chozo language.' },
    { id: 'emojis', text: 'Custom emoji: Samus thumbs up, Ridley facepalm.' },
    { id: 'vibecheck', text: 'Scoring candidates like Chozo scored Samus: ruthlessly.' },
    { id: 'charactersheet', text: 'Samus Aran. Class: Bounty Hunter. Weakness: baby Metroids.' },
    { id: 'buyhacks', text: 'Power Suit: 10/10 would recommend.' },
    { id: 'guildhall', text: 'Accept quest: Defeat Ridley. Reward: 500 zenny.' },
    { id: 'parla', text: 'Samus in Chile: "Estoy chata de los Space Pirates, weón."' },
  ];

  function activateSuitMode() {
    suitActive = !suitActive;
    document.body.classList.toggle('suit-mode', suitActive);

    if (suitActive) {
      if (window._neoSound) window._neoSound.metroidSuit();
      showCheat('Suit Activated<div class="cheat-sub">JUSTIN BAILEY — Metroid</div>', 'rgba(74,222,128,1)', 2500);
      originalDescs = [];
      altDescs.forEach(function (alt) {
        var card = document.querySelector('[data-card-id="' + alt.id + '"]');
        if (!card) return;
        var desc = card.querySelector('.card-desc');
        if (!desc) return;
        originalDescs.push({ el: desc, text: desc.textContent });
        desc.textContent = alt.text;
      });
      setTimeout(function () {
        if (suitActive) {
          suitActive = false;
          document.body.classList.remove('suit-mode');
          originalDescs.forEach(function (o) { o.el.textContent = o.text; });
        }
      }, 12000);
    } else {
      showCheat('Suit Off', 'rgba(74,222,128,1)', 1500);
      originalDescs.forEach(function (o) { o.el.textContent = o.text; });
    }
  }

  /* ── HESOYAM — GTA San Andreas ────────────────────────── */
  function activateHesoyam() {
    if (window._neoSound) window._neoSound.gtaHesoyam();
    showCheat('$250,000<div class="cheat-sub">HESOYAM — Full Health · Armor</div>', 'rgba(251,191,36,1)', 3000);

    var badge = document.getElementById('badgeText');
    var oldBadge = badge ? badge.textContent : '';
    if (badge) {
      badge.style.opacity = '0';
      setTimeout(function () {
        badge.textContent = '$250,000 · Full Health · Armor';
        badge.style.opacity = '1';
      }, 400);
      setTimeout(function () {
        badge.style.opacity = '0';
        setTimeout(function () {
          badge.textContent = oldBadge;
          badge.style.opacity = '1';
        }, 400);
      }, 5000);
    }

    var cards = document.querySelectorAll('.sites-section:not(.secret-section) .site-card');
    cards.forEach(function (card) {
      var rect = card.getBoundingClientRect();
      var count = 6 + Math.floor(Math.random() * 6);
      for (var i = 0; i < count; i++) {
        (function (delay) {
          setTimeout(function () {
            var s = document.createElement('div');
            s.className = 'sparkle';
            var colors = ['#fbbf24', '#f59e0b', '#fcd34d', '#ffffff', '#fde68a'];
            s.style.background = colors[Math.floor(Math.random() * colors.length)];
            s.style.width = (4 + Math.random() * 6) + 'px';
            s.style.height = s.style.width;
            s.style.left = (Math.random() * rect.width) + 'px';
            s.style.top = (Math.random() * rect.height) + 'px';
            var sx = (Math.random() - 0.5) * 30;
            var sy = (Math.random() - 0.5) * 30;
            s.style.setProperty('--sx', sx + 'px');
            s.style.setProperty('--sy', sy + 'px');
            s.style.setProperty('--ex', sx * 2 + 'px');
            s.style.setProperty('--ey', (sy - 20) + 'px');
            card.style.position = 'relative';
            card.appendChild(s);
            setTimeout(function () { s.remove(); }, 700);
          }, delay);
        })(Math.random() * 1500);
      }
    });
  }

  /* ── SEGA — Classic startup splash ─────────────────────── */
  function activateSega() {
    if (window._neoSound) window._neoSound.segaChoir();
    var flash = document.getElementById('segaFlash');
    if (flash) {
      flash.classList.add('visible');
      setTimeout(function () { flash.classList.remove('visible'); }, 2200);
    }
  }
})();
