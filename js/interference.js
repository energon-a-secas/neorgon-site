/* ── Interference ──────────────────────────────────────────────────────────
   An admin in the hub terminal forces the theme of every open hub tab. This
   module is the receiving half: it watches one Convex row and, when the row
   changes, plays a short burst of static and lands the theme underneath it.

   It owns a SECOND Convex client on purpose. terminal.js lazy-loads
   `ConvexHttpClient`, which is request/response only and cannot watch
   anything; a subscription needs the WebSocket `ConvexClient` and its
   `onUpdate`. Keeping the two separate means the terminal's auth path is
   untouched by anything here, and a socket that never opens costs the page
   nothing but this file.

   Precedence is the header kit's: visitor > season > opt-out > skin >
   default. Interference sits BELOW the visitor, so a tab opened with
   `?theme=` feels the burst and keeps its own theme. It is felt, not obeyed.

   No audio. Autoplay is blocked without a gesture, and a hub should not make
   noise at someone who did not ask it to.
   ───────────────────────────────────────────────────────────────────────── */
(function () {
  'use strict';
  if (window.__neoInterferenceInit) return;
  window.__neoInterferenceInit = true;

  var CONVEX_URL = 'https://quaint-cobra-151.convex.cloud';
  var BROWSER_MODULE = 'https://esm.sh/convex@1.21.0/browser';
  var SERVER_MODULE = 'https://esm.sh/convex@1.21.0/server';
  var QUERY = 'interference:get';
  var RECORD_KEY = 'neorgon-interference';
  var ATTR = 'data-interference';

  /* The theme lands under the veil and behind the static peak, so the swap
     itself is never seen as a hard cut. Reduced motion is a plain cross-fade
     and lands as soon as the veil is up. Both must match the CSS. */
  var TIMING = { land: 520, total: 1400 };
  var TIMING_REDUCED = { land: 200, total: 600 };

  var reduced = window.matchMedia
    ? window.matchMedia('(prefers-reduced-motion: reduce)')
    : { matches: false };

  var layer = null;
  var landTimer = 0;
  var endTimer = 0;
  var lastSeq = null;
  var current = null;
  var connected = false;
  var lastError = null;

  /* In-memory copies of the record. The record itself is per ORIGIN, so every
     tab in the browser shares one, and the first tab to process a release
     clears it out from under the others: without these two the second and
     third tab keep the forced theme forever. localStorage is what survives a
     reload; this is what survives a sibling. */
  var priorTheme = null;
  var forcedTheme = null;

  /* Every failure here is non-fatal: the page works without the burst. It is
     still recorded and warned once, because a silently swallowed import is a
     feature that looks dead with nothing to read. */
  function fail(where) {
    return function (err) {
      lastError = where + ': ' + ((err && err.message) || err);
      if (window.console && console.warn) console.warn('[interference] ' + lastError);
    };
  }

  /* ── The visitor's own record ──────────────────────────────────────────
     `{ seq, prior, forced }`. `prior` is the theme this browser had before
     the first forced one and is never overwritten, so a second order still
     releases to the theme the visitor actually chose. `forced` tracks the
     latest order, which is what makes the release conditional: a visitor who
     ran `theme` mid-interference keeps their pick. */
  function readRecord() {
    try { return JSON.parse(localStorage.getItem(RECORD_KEY)); }
    catch (e) { return null; }
  }
  function writeRecord(rec) {
    try { localStorage.setItem(RECORD_KEY, JSON.stringify(rec)); } catch (e) {}
  }
  function clearRecord() {
    try { localStorage.removeItem(RECORD_KEY); } catch (e) {}
  }

  /* ── The header kit is the only sanctioned way to set a theme ─────────── */
  function kit() { return window.NeoHeader || null; }

  function themeNow() {
    var k = kit();
    return (k && k.getTheme) ? k.getTheme() : 'default';
  }

  function setTheme(name) {
    var k = kit();
    if (k && k.setTheme) k.setTheme(name || 'default');
  }

  /* What THIS tab is showing, which is not what the cookie says: the cookie is
     shared across the browser and a sibling tab restoring it first would make
     every other tab think the viewer had changed their mind. */
  function renderedTheme() {
    return document.documentElement.getAttribute('data-theme') || 'default';
  }

  /* A `?theme=` the kit recognises outranks everything below the visitor,
     interference included. Read the same way the kit reads it. */
  function visitorPinned() {
    var k = kit();
    if (!k) return false;
    var param = null;
    try { param = new URLSearchParams(location.search).get('theme'); }
    catch (e) { return false; }
    if (!param) return false;
    return (k.themes || []).indexOf(param) !== -1;
  }

  /* ── Landing ──────────────────────────────────────────────────────────── */
  function landForced(theme, seq) {
    document.documentElement.setAttribute(ATTR, 'armed');
    forcedTheme = theme;
    if (visitorPinned()) return;
    var rec = readRecord();
    if (!rec || typeof rec.prior !== 'string') rec = { seq: seq, prior: themeNow(), forced: theme };
    else { rec.forced = theme; rec.seq = seq; }
    writeRecord(rec);
    priorTheme = rec.prior;
    setTheme(theme);
  }

  function landRelease() {
    document.documentElement.removeAttribute(ATTR);
    var prior = priorTheme;
    var forced = forcedTheme;
    if (prior === null) {
      /* No memory of the order: this tab loaded after the browser was closed
         during one. The record is the only witness left. */
      var rec = readRecord();
      if (rec) { prior = rec.prior; forced = rec.forced; }
    }
    clearRecord();
    priorTheme = null;
    forcedTheme = null;
    if (typeof prior !== 'string') return;
    if (visitorPinned()) return;
    /* A viewer who ran `theme` during the interference keeps their pick. */
    if (typeof forced === 'string' && renderedTheme() !== forced) return;
    setTheme(prior);
  }

  /* ── The burst ────────────────────────────────────────────────────────── */
  function ensureLayer() {
    if (layer && layer.isConnected) return layer;
    layer = document.createElement('div');
    layer.className = 'interference';
    layer.setAttribute('aria-hidden', 'true');
    ['veil', 'static', 'scanlines', 'wash'].forEach(function (name) {
      var child = document.createElement('div');
      child.className = name;
      layer.appendChild(child);
    });
    document.body.appendChild(layer);
    return layer;
  }

  function burst(land) {
    var el = ensureLayer();
    var t = reduced.matches ? TIMING_REDUCED : TIMING;
    clearTimeout(landTimer);
    clearTimeout(endTimer);
    /* A burst arriving mid-burst restarts rather than stacking: drop the
       class, force a reflow so the animations are rebuilt, add it back. */
    el.classList.remove('is-playing');
    void el.offsetWidth;
    el.classList.add('is-playing');
    landTimer = setTimeout(land, t.land);
    endTimer = setTimeout(function () { el.classList.remove('is-playing'); }, t.total + 40);
  }

  /* ── Delivery ─────────────────────────────────────────────────────────── */
  function apply(row) {
    current = row || null;
    var theme = (row && typeof row.theme === 'string') ? row.theme : null;
    var seq = (row && typeof row.seq === 'number') ? row.seq : 0;

    if (lastSeq === null) {
      lastSeq = seq;
      /* First delivery is the state of the world, not news. A tab opened
         while an order stands takes the theme with no burst; a tab opened
         after one was released puts its own theme back. */
      if (theme) landForced(theme, seq);
      else landRelease();
      return;
    }

    if (seq <= lastSeq) return;
    lastSeq = seq;
    if (theme) burst(function () { landForced(theme, seq); });
    else burst(landRelease);
  }

  /* ── The socket ───────────────────────────────────────────────────────── */
  var connecting = false;

  function connect() {
    if (connecting) return;
    connecting = true;
    import(BROWSER_MODULE).then(function (mod) {
      var client = new mod.ConvexClient(CONVEX_URL);
      try {
        client.onUpdate(QUERY, {}, apply, fail('subscription'));
        connected = true;
      } catch (e) {
        /* The string form is what terminal.js already uses. If this client
           refuses it, `anyApi` builds the reference instead; it lives in
           convex/server, so that module is only fetched on this path. */
        import(SERVER_MODULE).then(function (srv) {
          client.onUpdate(srv.anyApi.interference.get, {}, apply, fail('subscription'));
          connected = true;
        }).catch(fail('anyApi import'));
      }
    }).catch(fail('convex import'));
  }

  function schedule() {
    /* Idle time is the right moment, but requestIdleCallback is not guaranteed
       to run in a hidden tab, and a hub left open in a background tab is the
       normal case for this feature. The timer is the floor under it; connect()
       is idempotent so whichever arrives first wins. */
    if (typeof window.requestIdleCallback === 'function') {
      window.requestIdleCallback(connect, { timeout: 3000 });
      setTimeout(connect, 3500);
    } else {
      setTimeout(connect, 1500);
    }
  }

  if (document.readyState === 'complete') schedule();
  else window.addEventListener('load', schedule, { once: true });

  window._neoInterference = {
    /* `play(theme)` is one delivery without the bookkeeping: burst, then land
       that theme, or release when it is null. The terminal and the headless
       proof both use it; the real path is the subscription above. */
    play: function (theme) {
      var name = (typeof theme === 'string' && theme) ? theme : null;
      if (name) burst(function () { landForced(name, lastSeq || 0); });
      else burst(landRelease);
    },
    state: function () {
      return {
        connected: connected,
        seq: lastSeq,
        theme: current ? current.theme : null,
        by: current ? current.by : null,
        at: current ? current.at : null,
        armed: document.documentElement.getAttribute(ATTR) === 'armed',
        reduced: !!reduced.matches,
        error: lastError,
        record: readRecord()
      };
    }
  };
})();
