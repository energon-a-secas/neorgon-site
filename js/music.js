(function () {
  const btn = document.getElementById('musicToggle');
  if (!btn) return;

  let playing = false;
  let audioCtx = null;
  let nodes = [];
  let currentMode = 'stars';

  function stopMusic() {
    playing = false;
    nodes.forEach(n => { try { n.stop(); } catch {} });
    nodes = [];
    if (audioCtx) { audioCtx.close(); audioCtx = null; }
  }

  function makeCtx() {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const master = audioCtx.createGain();
    master.gain.value = 0.12;
    master.connect(audioCtx.destination);
    return master;
  }

  /* ── Stars — cosmic ambient (original) ─────────────────────── */
  function startStarsMusic() {
    const master = makeCtx();

    function createDrone(freq) {
      const osc = audioCtx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = freq;
      const filter = audioCtx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 400;
      filter.Q.value = 2;
      const gain = audioCtx.createGain();
      gain.gain.value = 0.15;
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(master);
      osc.start();
      nodes.push(osc);
      (function sweep() {
        if (!audioCtx || !playing) return;
        const now = audioCtx.currentTime;
        filter.frequency.linearRampToValueAtTime(200 + Math.random() * 600, now + 4 + Math.random() * 4);
        setTimeout(sweep, 4000 + Math.random() * 4000);
      })();
    }
    createDrone(55);
    createDrone(82.41);
    createDrone(110);

    const NOTES = [220, 261.6, 329.6, 392, 440, 523.3, 659.3, 784];
    function chime() {
      if (!playing || currentMode !== 'stars') return;
      const freq = NOTES[Math.floor(Math.random() * NOTES.length)];
      const osc = audioCtx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq * (Math.random() > 0.5 ? 2 : 1);
      const gain = audioCtx.createGain();
      const now = audioCtx.currentTime;
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.08 + Math.random() * 0.06, now + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.5 + Math.random());
      osc.connect(gain);
      gain.connect(master);
      osc.start(now);
      osc.stop(now + 2.5);
      setTimeout(chime, 800 + Math.random() * 2200);
    }
    setTimeout(chime, 500);

    const sub = audioCtx.createOscillator();
    sub.type = 'sine';
    sub.frequency.value = 36.7;
    const subGain = audioCtx.createGain();
    subGain.gain.value = 0.1;
    sub.connect(subGain);
    subGain.connect(master);
    sub.start();
    nodes.push(sub);
  }

  /* ── Matrix — dark digital hum with glitchy pulses ─────────── */
  function startMatrixMusic() {
    const master = makeCtx();
    master.gain.value = 0.10;

    /* Deep digital drone — detuned square waves */
    [41.2, 61.7, 82.4].forEach(freq => {
      const osc = audioCtx.createOscillator();
      osc.type = 'square';
      osc.frequency.value = freq;
      const filter = audioCtx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 200;
      filter.Q.value = 4;
      const gain = audioCtx.createGain();
      gain.gain.value = 0.12;
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(master);
      osc.start();
      nodes.push(osc);
      (function sweep() {
        if (!audioCtx || !playing) return;
        const now = audioCtx.currentTime;
        filter.frequency.linearRampToValueAtTime(100 + Math.random() * 300, now + 3 + Math.random() * 5);
        setTimeout(sweep, 3000 + Math.random() * 5000);
      })();
    });

    /* Glitch blips — short high-pitched random bursts */
    function blip() {
      if (!playing || currentMode !== 'matrix') return;
      if (!audioCtx) return;
      const now = audioCtx.currentTime;
      const osc = audioCtx.createOscillator();
      osc.type = Math.random() > 0.5 ? 'square' : 'sawtooth';
      osc.frequency.setValueAtTime(800 + Math.random() * 2000, now);
      osc.frequency.exponentialRampToValueAtTime(200 + Math.random() * 400, now + 0.08);
      const gain = audioCtx.createGain();
      gain.gain.setValueAtTime(0.06 + Math.random() * 0.04, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
      osc.connect(gain);
      gain.connect(master);
      osc.start(now);
      osc.stop(now + 0.15);
      setTimeout(blip, 1500 + Math.random() * 4000);
    }
    setTimeout(blip, 800);

    /* Sub bass throb */
    const sub = audioCtx.createOscillator();
    sub.type = 'sine';
    sub.frequency.value = 30;
    const subGain = audioCtx.createGain();
    subGain.gain.value = 0.14;
    sub.connect(subGain);
    subGain.connect(master);
    sub.start();
    nodes.push(sub);

    /* Slow LFO on sub */
    const lfo = audioCtx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 0.08;
    const lfoGain = audioCtx.createGain();
    lfoGain.gain.value = 0.06;
    lfo.connect(lfoGain);
    lfoGain.connect(subGain.gain);
    lfo.start();
    nodes.push(lfo);
  }

  /* ── L Intervention — L's Theme A piano ──────────────────────── */
  function startInterventionMusic() {
    const master = makeCtx();
    master.gain.value = 0.14;

    /* L's Theme A (Death Note) — E minor, 3×7/8 + 1×6/8 */
    const E8 = 0.30; /* eighth note duration — bar of 7/8 ≈ 2.1s */

    function playPianoNote(freq, time, dur, vel) {
      if (!audioCtx) return;
      /* Main body — warm triangle wave */
      const osc = audioCtx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      const g = audioCtx.createGain();
      g.gain.setValueAtTime(0, time);
      g.gain.linearRampToValueAtTime(vel, time + 0.005);
      g.gain.exponentialRampToValueAtTime(vel * 0.4, time + 0.12);
      g.gain.exponentialRampToValueAtTime(vel * 0.08, time + dur * 0.5);
      g.gain.exponentialRampToValueAtTime(0.0001, time + dur);
      osc.connect(g); g.connect(master);
      osc.start(time); osc.stop(time + dur + 0.02);

      /* Soft octave harmonic — adds brightness without harshness */
      const h = audioCtx.createOscillator();
      h.type = 'sine';
      h.frequency.value = freq * 2;
      const hg = audioCtx.createGain();
      hg.gain.setValueAtTime(0, time);
      hg.gain.linearRampToValueAtTime(vel * 0.06, time + 0.004);
      hg.gain.exponentialRampToValueAtTime(0.0001, time + dur * 0.25);
      h.connect(hg); hg.connect(master);
      h.start(time); h.stop(time + dur * 0.3);
    }

    /* E minor: E F# G A B C D */
    const E4=329.6, Fs4=370.0, G4=392.0, B3=246.9;
    const E2=82.4, E3=164.8, B2=123.5, G3=196.0, A2=110.0;

    /* Melody: E-B-E-G-F# across 3×7/8 + 1×6/8 = 27 eighth notes
       7/8 bar rhythm: note(2) note(1) note(2) note(1) note(1)
       6/8 bar rhythm: note(2) note(1) note(1) note(1) note(1)
       [freq, startEighth, durationEighths, velocity] */
    const melody = [
      /* Bar 1 — 7/8 */
      [E4, 0, 2, 0.14], [B3, 2, 1, 0.10], [E4, 3, 2, 0.13], [G4, 5, 1, 0.12], [Fs4, 6, 1, 0.11],
      /* Bar 2 — 7/8 */
      [E4, 7, 2, 0.13], [B3, 9, 1, 0.10], [E4, 10, 2, 0.14], [G4, 12, 1, 0.13], [Fs4, 13, 1, 0.11],
      /* Bar 3 — 7/8 (variation: longer G) */
      [E4, 14, 2, 0.13], [B3, 16, 1, 0.09], [E4, 17, 1, 0.12], [G4, 18, 2, 0.15], [Fs4, 20, 1, 0.12],
      /* Bar 4 — 6/8 (resolving) */
      [E4, 21, 2, 0.14], [B3, 23, 1, 0.10], [E4, 24, 1, 0.11], [G4, 25, 1, 0.12], [Fs4, 26, 1, 0.10],
    ];

    /* Bass: steady low E pulse + harmonic shifts */
    const bassLine = [
      [E2, 0, 4, 0.10],  [E3, 4, 3, 0.06],
      [E2, 7, 4, 0.10],  [B2, 11, 3, 0.06],
      [E2, 14, 4, 0.10], [G3, 18, 3, 0.06],
      [E2, 21, 3, 0.10], [A2, 24, 3, 0.06],
    ];

    const CYCLE = 27; /* 7+7+7+6 eighth notes */

    function playMelodyLoop() {
      if (!playing || currentMode !== 'intervention' || !audioCtx) return;
      const now = audioCtx.currentTime + 0.05;

      melody.forEach(function (n) {
        playPianoNote(n[0], now + n[1] * E8, n[2] * E8 + 0.6, n[3]);
      });
      bassLine.forEach(function (n) {
        playPianoNote(n[0], now + n[1] * E8, n[2] * E8 + 1.0, n[3]);
      });

      setTimeout(playMelodyLoop, CYCLE * E8 * 1000);
    }
    setTimeout(playMelodyLoop, 600);

    /* Gentle E2 pad — just enough room tone, not fighting the piano */
    const pad = audioCtx.createOscillator();
    pad.type = 'sine';
    pad.frequency.value = 82.4;
    const padGain = audioCtx.createGain();
    padGain.gain.value = 0.03;
    pad.connect(padGain);
    padGain.connect(master);
    pad.start();
    nodes.push(pad);
  }

  function startMusic() {
    const prefs = JSON.parse(localStorage.getItem('neorgon-prefs') || '{}');
    currentMode = prefs.bg || 'stars';
    if (currentMode === 'matrix') startMatrixMusic();
    else if (currentMode === 'intervention') startInterventionMusic();
    else startStarsMusic();
  }

  /* Called by settings when bg changes while music is playing */
  window._neoMusicSwitch = function (mode) {
    currentMode = mode;
    if (playing) {
      stopMusic();
      playing = true;
      btn.classList.add('playing');
      startMusic();
    }
  };

  /* Hide button if user prefers reduced motion */
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    btn.style.display = 'none';
    return;
  }

  btn.addEventListener('click', () => {
    if (window._neoSoundEnabled === false) return;
    if (playing) {
      stopMusic();
      btn.classList.remove('playing');
    } else {
      playing = true;
      btn.classList.add('playing');
      startMusic();
    }
  });
})();
