/* ── Spatial audio system ─────────────────────────────────────────────────── */
(function () {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  let ctx = null;
  let ready = false;

  const PENTATONIC = [523, 587, 659, 784, 880, 1047, 1175, 1319, 1568, 1760, 2093, 2349, 2637];

  function ensureContext() {
    if (!ctx) {
      try {
        ctx = new (window.AudioContext || window.webkitAudioContext)();
        ready = true;
      } catch { return false; }
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ready;
  }

  /* AudioContext requires a trusted gesture (click/keydown/touch) before
     it can run. Hover (mouseenter) is NOT trusted, so we must ensure the
     context is created and resumed during a real gesture. We keep listening
     until resume() actually resolves to 'running'. */
  function onGesture() {
    ensureContext();
    if (ctx && ctx.state === 'suspended') {
      ctx.resume().then(() => cleanup());
    } else if (ctx && ctx.state === 'running') {
      cleanup();
    }
  }
  function cleanup() {
    if (cleaned) return;
    cleaned = true;
    ['pointerdown', 'mousedown', 'keydown', 'touchstart'].forEach(ev =>
      document.removeEventListener(ev, onGesture, true)
    );
    /* Silent warm-up: schedule a near-inaudible blip so the context is fully
       primed and the next hover sound plays instantly with no lag. */
    if (ctx && window._neoSoundEnabled !== false) {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      g.gain.value = 0.001;
      osc.connect(g);
      g.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.01);
    }
  }
  let cleaned = false;
  ['pointerdown', 'mousedown', 'keydown', 'touchstart'].forEach(ev =>
    document.addEventListener(ev, onGesture, { capture: true })
  );

  function playTone(freq, duration, gain, type, sweep) {
    if (window._neoSoundEnabled === false) return;
    if (!ctx) ensureContext();
    if (!ready || !ctx) return;
    /* Wait for resume when suspended so we don't start the oscillator before
       the context is running (which would play nothing). Fixes hover sound
       sometimes requiring a click — after the first gesture, hover plays reliably. */
    if (ctx.state === 'suspended') {
      ctx.resume().then(function () {
        if (ctx.state === 'running') playTone(freq, duration, gain, type, sweep);
      });
      return;
    }

    const osc = ctx.createOscillator();
    const vol = ctx.createGain();
    const now = ctx.currentTime;

    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, now);
    if (sweep) osc.frequency.exponentialRampToValueAtTime(sweep, now + duration);

    vol.gain.setValueAtTime(0, now);
    vol.gain.linearRampToValueAtTime(gain, now + 0.008);
    vol.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc.connect(vol);
    vol.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + duration + 0.01);
  }

  function hoverIn(index) {
    const base = PENTATONIC[index % PENTATONIC.length];
    playTone(base, 0.09, 0.045, 'sine', base * 1.12);
  }

  function hoverOut(index) {
    const base = PENTATONIC[index % PENTATONIC.length];
    playTone(base * 0.85, 0.06, 0.02, 'sine');
  }

  function dragStart() {
    playTone(440, 0.15, 0.05, 'triangle', 660);
  }

  function dropCard() {
    playTone(880, 0.06, 0.04, 'sine', 1320);
    setTimeout(() => playTone(1320, 0.1, 0.035, 'sine'), 70);
  }

  function unlock() {
    playTone(523, 0.08, 0.04, 'triangle', 784);
    setTimeout(() => playTone(784, 0.08, 0.035, 'triangle', 1047), 80);
    setTimeout(() => playTone(1047, 0.12, 0.03, 'sine'), 160);
  }

  function termOpen() {
    playTone(1200, 0.12, 0.04, 'sine', 1600);
    setTimeout(() => playTone(1600, 0.15, 0.035, 'sine', 2000), 70);
  }

  function termClose() {
    playTone(1600, 0.1, 0.035, 'sine', 1200);
    setTimeout(() => playTone(1000, 0.12, 0.025, 'sine', 800), 60);
  }

  const KONAMI_SCALE = [262, 294, 330, 392, 440, 523, 587, 659, 784, 880];

  function konamiKey(step) {
    const freq = KONAMI_SCALE[step];
    const intensity = 0.03 + (step / KONAMI_SCALE.length) * 0.03;
    playTone(freq, 0.1, intensity, 'square', freq * 1.05);
  }

  function konamiFail(step) {
    if (step === 0) return;
    playTone(185, 0.18, 0.045, 'sawtooth', 120);
    setTimeout(() => playTone(140, 0.22, 0.035, 'square', 100), 90);
  }

  const CHEAT_SCALE = [330, 370, 415, 466, 523, 587, 659, 740, 831, 932, 1047, 1175, 1319, 1480];

  function cheatKey(step, total) {
    const freq = CHEAT_SCALE[step % CHEAT_SCALE.length];
    const intensity = 0.025 + (step / Math.max(total, 1)) * 0.035;
    playTone(freq, 0.08, intensity, 'triangle', freq * 1.08);
  }

  function cheatFail(step) {
    if (step === 0) return;
    playTone(220, 0.15, 0.04, 'square', 150);
    setTimeout(() => playTone(165, 0.2, 0.03, 'sawtooth', 110), 80);
  }

  function deny() {
    playTone(330, 0.15, 0.05, 'square', 220);
    setTimeout(() => playTone(220, 0.25, 0.045, 'square', 165), 150);
  }

  function warpEngage() {
    if (window._neoSoundEnabled === false) return;
    if (!ctx) ensureContext();
    if (!ready || !ctx) return;
    if (ctx.state === 'suspended') ctx.resume();
    const now = ctx.currentTime;

    /* Layer 1 — Rising charge-up sweep */
    const charge = ctx.createOscillator();
    const chargeGain = ctx.createGain();
    charge.type = 'sine';
    charge.frequency.setValueAtTime(200, now);
    charge.frequency.exponentialRampToValueAtTime(2400, now + 1.0);
    charge.frequency.exponentialRampToValueAtTime(6000, now + 1.8);
    chargeGain.gain.setValueAtTime(0, now);
    chargeGain.gain.linearRampToValueAtTime(0.05, now + 0.2);
    chargeGain.gain.linearRampToValueAtTime(0.06, now + 1.0);
    chargeGain.gain.exponentialRampToValueAtTime(0.0001, now + 2.0);
    charge.connect(chargeGain);
    chargeGain.connect(ctx.destination);
    charge.start(now);
    charge.stop(now + 2.1);

    /* Layer 2 — Shimmer: FM modulated sine for that sparkle */
    const mod = ctx.createOscillator();
    const modGain = ctx.createGain();
    mod.type = 'sine';
    mod.frequency.setValueAtTime(6, now);
    mod.frequency.exponentialRampToValueAtTime(30, now + 1.5);
    modGain.gain.setValueAtTime(100, now);
    modGain.gain.linearRampToValueAtTime(800, now + 1.5);
    const shimmer = ctx.createOscillator();
    const shimmerGain = ctx.createGain();
    shimmer.type = 'sine';
    shimmer.frequency.setValueAtTime(800, now);
    shimmer.frequency.exponentialRampToValueAtTime(3200, now + 1.5);
    mod.connect(modGain);
    modGain.connect(shimmer.frequency);
    shimmerGain.gain.setValueAtTime(0, now);
    shimmerGain.gain.linearRampToValueAtTime(0.035, now + 0.4);
    shimmerGain.gain.linearRampToValueAtTime(0.04, now + 1.2);
    shimmerGain.gain.exponentialRampToValueAtTime(0.0001, now + 2.2);
    shimmer.connect(shimmerGain);
    shimmerGain.connect(ctx.destination);
    mod.start(now);
    shimmer.start(now);
    mod.stop(now + 2.3);
    shimmer.stop(now + 2.3);

    /* Layer 3 — Hyperspace whoosh: filtered noise burst at the jump moment */
    const noise = ctx.createBufferSource();
    const noiseLen = ctx.sampleRate * 3;
    const noiseBuf = ctx.createBuffer(1, noiseLen, ctx.sampleRate);
    const noiseData = noiseBuf.getChannelData(0);
    for (let i = 0; i < noiseLen; i++) noiseData[i] = (Math.random() * 2 - 1) * 0.5;
    noise.buffer = noiseBuf;
    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'highpass';
    noiseFilter.frequency.setValueAtTime(800, now);
    noiseFilter.frequency.exponentialRampToValueAtTime(6000, now + 1.2);
    noiseFilter.frequency.exponentialRampToValueAtTime(12000, now + 2.0);
    noiseFilter.Q.value = 3;
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0, now);
    noiseGain.gain.linearRampToValueAtTime(0.025, now + 0.8);
    noiseGain.gain.linearRampToValueAtTime(0.04, now + 1.5);
    noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + 2.5);
    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(ctx.destination);
    noise.start(now);
    noise.stop(now + 2.6);

    /* Layer 4 — Sub-bass pulse for weight */
    const sub = ctx.createOscillator();
    const subGain = ctx.createGain();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(60, now);
    sub.frequency.exponentialRampToValueAtTime(120, now + 1.5);
    subGain.gain.setValueAtTime(0, now);
    subGain.gain.linearRampToValueAtTime(0.06, now + 0.5);
    subGain.gain.exponentialRampToValueAtTime(0.0001, now + 2.0);
    sub.connect(subGain);
    subGain.connect(ctx.destination);
    sub.start(now);
    sub.stop(now + 2.1);

    /* Drop-out chime — bright descending arrival bells */
    setTimeout(() => {
      playTone(2400, 0.1, 0.04, 'sine', 1800);
      setTimeout(() => playTone(1800, 0.12, 0.035, 'sine', 1200), 80);
      setTimeout(() => playTone(1200, 0.18, 0.03, 'sine', 900), 180);
    }, 2500);
  }

  let lastHover = 0;
  const DEBOUNCE = 60;

  /* Prime AudioContext on first card click so hover sound works immediately
     after (browsers require a user gesture before audio can play). */
  function primeOnCardInteraction() {
    if (!ctx || cleaned) return;
    ensureContext();
    if (ctx && ctx.state === 'suspended') {
      ctx.resume().then(function () { if (ctx) cleanup(); });
    }
  }

  const cards = document.querySelectorAll('.sites-grid .site-card');
  cards.forEach(function (card, i) {
    card.addEventListener('mouseenter', function () {
      const now = Date.now();
      if (now - lastHover < DEBOUNCE) return;
      lastHover = now;
      hoverIn(i);
    });
    card.addEventListener('mouseleave', function () {
      hoverOut(i);
    });
    card.addEventListener('pointerdown', primeOnCardInteraction, { once: true });
    card.addEventListener('keydown', primeOnCardInteraction, { once: true });
  });

  /* Logo & GitHub hover sounds */
  const logoWrap = document.querySelector('.logo-wrap');
  const ghLink = document.querySelector('.header-link[title="GitHub"]');
  if (logoWrap) {
    logoWrap.addEventListener('mouseenter', () => {
      if (window._neoSoundEnabled === false) return;
      playTone(880, 0.08, 0.04, 'sine', 1100);
      setTimeout(() => playTone(1100, 0.06, 0.03, 'sine', 1320), 50);
    });
  }
  if (ghLink) {
    ghLink.addEventListener('mouseenter', () => {
      if (window._neoSoundEnabled === false) return;
      playTone(660, 0.07, 0.04, 'triangle', 780);
    });
  }

  /* Proximity sonar ping — variable freq/vol */
  window._neoSoundPing = function (freq, vol) {
    if (window._neoSoundEnabled === false) return;
    if (!ctx) ensureContext();
    if (!ready || !ctx) return;
    if (ctx.state === 'suspended') ctx.resume();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.7, now + 0.15);
    gain.gain.setValueAtTime(vol, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.16);
  };

  /* Discovery reveal — ascending shimmer chord */
  window._neoSoundDiscover = function () {
    if (window._neoSoundEnabled === false) return;
    if (!ctx) ensureContext();
    if (!ready || !ctx) return;
    if (ctx.state === 'suspended') ctx.resume();
    const notes = [440, 554, 659, 880, 1108];
    notes.forEach((f, i) => {
      setTimeout(() => playTone(f, 0.3, 0.045, 'sine', f * 1.5), i * 80);
    });
    /* Deep sub hit */
    setTimeout(() => playTone(110, 0.4, 0.06, 'triangle'), 50);
  };

  /* ── IDDQD — Doom shotgun pump/reload ─────────────────── */
  function doomGodMode() {
    /* Pump: low noise burst */
    playTone(80, 0.08, 0.06, 'sawtooth', 40);
    setTimeout(() => playTone(120, 0.06, 0.05, 'square', 60), 60);
    /* Rack: metallic click */
    setTimeout(() => playTone(2800, 0.03, 0.04, 'square', 3500), 150);
    setTimeout(() => playTone(3200, 0.02, 0.03, 'triangle', 4000), 170);
    /* Power-up hum */
    setTimeout(() => {
      playTone(110, 0.5, 0.04, 'sawtooth', 220);
      playTone(165, 0.4, 0.03, 'square', 330);
    }, 250);
  }

  /* ── ABACABB — Mortal Kombat gong + impact ──────────── */
  function mkBloodCode() {
    /* Deep gong strike */
    playTone(65, 0.6, 0.07, 'triangle', 55);
    playTone(130, 0.5, 0.05, 'sine', 100);
    /* Metallic shimmer */
    setTimeout(() => playTone(1800, 0.25, 0.03, 'sine', 900), 80);
    setTimeout(() => playTone(2400, 0.2, 0.025, 'sine', 1200), 120);
    /* Low rumble */
    setTimeout(() => playTone(45, 0.8, 0.05, 'sawtooth', 30), 200);
    /* "Fight!" hit */
    setTimeout(() => {
      playTone(200, 0.12, 0.06, 'square', 100);
      playTone(400, 0.08, 0.04, 'sawtooth', 200);
    }, 500);
  }

  /* ── Justin Bailey — Metroid item acquisition jingle ── */
  function metroidSuit() {
    var notes = [523, 659, 784, 1047, 1319];
    notes.forEach(function (f, i) {
      setTimeout(() => playTone(f, 0.15, 0.04, 'square', f * 1.02), i * 90);
    });
    /* Power suit hum — sustained pad */
    setTimeout(() => {
      playTone(262, 0.8, 0.03, 'sine', 524);
      playTone(330, 0.7, 0.025, 'triangle', 660);
    }, notes.length * 90);
    /* Shield shimmer */
    setTimeout(() => playTone(3000, 0.3, 0.02, 'sine', 6000), notes.length * 90 + 100);
  }

  /* ── HESOYAM — GTA cash register / bling ─────────────── */
  function gtaHesoyam() {
    /* Cash register ka-ching */
    playTone(3500, 0.04, 0.05, 'square', 4500);
    setTimeout(() => playTone(4500, 0.03, 0.04, 'triangle', 6000), 50);
    /* Coin cascade */
    var coinFreqs = [1760, 2093, 2349, 2637, 3136, 3520];
    coinFreqs.forEach(function (f, i) {
      setTimeout(() => playTone(f, 0.06, 0.03, 'sine', f * 1.15), 100 + i * 55);
    });
    /* Deep "accepted" thud */
    setTimeout(() => playTone(150, 0.2, 0.05, 'triangle', 80), 80);
    /* Money sparkle */
    setTimeout(() => {
      playTone(5000, 0.15, 0.02, 'sine', 8000);
      playTone(6000, 0.12, 0.015, 'sine', 9000);
    }, 450);
  }

  /* ── SEGA — Synth choir "SEE-GAA" ─────────────────────── */
  function segaChoir() {
    if (window._neoSoundEnabled === false) return;
    if (!ctx) ensureContext();
    if (!ready || !ctx) return;
    if (ctx.state === 'suspended') ctx.resume();
    var now = ctx.currentTime;

    /* Build a 4-voice choir on a given freq + duration */
    function choirNote(freq, start, dur, vol) {
      var detunes = [-6, -2, 2, 7];
      detunes.forEach(function (d) {
        var osc = ctx.createOscillator();
        var g = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, now + start);
        osc.detune.setValueAtTime(d, now + start);
        g.gain.setValueAtTime(0, now + start);
        g.gain.linearRampToValueAtTime(vol, now + start + 0.04);
        g.gain.setValueAtTime(vol, now + start + dur - 0.1);
        g.gain.exponentialRampToValueAtTime(0.0001, now + start + dur);
        osc.connect(g);
        g.connect(ctx.destination);
        osc.start(now + start);
        osc.stop(now + start + dur + 0.01);
      });
    }

    /* "SEEE" — E4 (330Hz), sustained ~0.9s */
    choirNote(330, 0, 0.9, 0.025);
    choirNote(660, 0, 0.9, 0.012);

    /* "GAAA" — C4 (262Hz), starts at 0.9s, sustained ~1.1s */
    choirNote(262, 0.85, 1.1, 0.03);
    choirNote(524, 0.85, 1.1, 0.015);

    /* Bright shimmer on top */
    var shim = ctx.createOscillator();
    var shimG = ctx.createGain();
    shim.type = 'sine';
    shim.frequency.setValueAtTime(1320, now);
    shim.frequency.exponentialRampToValueAtTime(660, now + 1.8);
    shimG.gain.setValueAtTime(0, now);
    shimG.gain.linearRampToValueAtTime(0.01, now + 0.1);
    shimG.gain.setValueAtTime(0.01, now + 1.4);
    shimG.gain.exponentialRampToValueAtTime(0.0001, now + 2.0);
    shim.connect(shimG);
    shimG.connect(ctx.destination);
    shim.start(now);
    shim.stop(now + 2.1);
  }

  window._neoSound = { dragStart, dropCard, unlock, termOpen, termClose, konamiKey, konamiFail, cheatKey, cheatFail, warpEngage, deny, doomGodMode, mkBloodCode, metroidSuit, gtaHesoyam, segaChoir };
})();
