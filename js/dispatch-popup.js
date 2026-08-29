// Antenne corner popup (the fleet news site, served from dispatch.neorgon.com):
// surfaces fleet news on desktop, once per story.
// Fetches the Antenne feed after idle. If the newest story is one this
// browser has not dismissed yet, a closable corner card embeds the
// ?embed=1 strip; closing remembers the newest date in localStorage and
// collapses the card into a small satellite dock in the same corner, so
// the news stays reachable without asking for attention. When there is
// nothing new, only the dock appears.
(function () {
  'use strict';

  // Double-inclusion guard: two script tags must not stack two cards.
  if (window.__neoDispatchPopup) return;
  window.__neoDispatchPopup = true;

  var KEY = 'neorgon-dispatch-seen';
  /* Display name only; the domain, storage key and card id stay dispatch. */
  var NAME = 'Antenne';
  var local = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
  var BASE = local ? 'http://localhost:8873/' : 'https://dispatch.neorgon.com/';

  function latestDate(doc) {
    var latest = '';
    var posts = (doc && doc.posts) || [];
    for (var i = 0; i < posts.length; i++) {
      var d = posts[i] && posts[i].date;
      if (typeof d === 'string' && d > latest) latest = d;
    }
    return latest;
  }

  /* The card's inline --card-accent is the canonical home of this tool's
     colour; read it per root element so a recolour never leaves the popup
     or the dock behind. */
  function accentInto(el) {
    var card = document.querySelector('[data-card-id="dispatch"]');
    var accent = card ? getComputedStyle(card).getPropertyValue('--card-accent').trim() : '';
    el.style.setProperty('--pop-accent', accent || '#3b82f6');
  }

  /* Satellite mark, shared by the bar label and the dock. Solid silhouette
     (fill, not line art) so it holds at 16px: panel, body, panel in a line
     with a dish dome hanging off the side, drawn axis-aligned inside a
     -45deg-rotated group so the dish faces its own signal arcs at the lower
     left, the composition of the classic satnav glyph. The arcs animate
     only where CSS says so (label always, dock on hover). */
  function satSvg(cls, size) {
    return '<svg class="' + cls + '" viewBox="0 0 22 22" width="' + size + '" height="' + size + '" fill="none" aria-hidden="true" focusable="false">'
      + '<g fill="currentColor" transform="rotate(-45 11 11)">'
      + '<rect x="9" y="2.6" width="4" height="4.6" rx=".7"/>'
      + '<rect x="10.6" y="7.2" width=".8" height="1.2"/>'
      + '<rect x="8.6" y="8.4" width="4.8" height="5.2" rx="1.1"/>'
      + '<rect x="10.6" y="13.6" width=".8" height="1.2"/>'
      + '<rect x="9" y="14.8" width="4" height="4.6" rx=".7"/>'
      + '<rect x="7.6" y="10.8" width="1.4" height="1.2"/>'
      + '<path d="M7.9 8.2 A3.3 3.3 0 0 0 7.9 14.6 Z"/>'
      + '<circle cx="4.3" cy="11.4" r=".9"/>'
      + '</g>'
      + '<path class="dispatch-pop__wave dispatch-pop__wave--2" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" d="M6.55 19 A3 3 0 0 1 3.55 16"/>'
      + '<path class="dispatch-pop__wave dispatch-pop__wave--3" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" d="M6.55 21.2 A5.2 5.2 0 0 1 1.35 16"/>'
      + '</svg>';
  }

  /* Chrome: a brushed-metal shell around a dark glass body, hull plating
     around a viewport. The wider left edge is the tool rail (the machined
     groove is where future controls would dock); the accent stays confined
     to the label, hairline and focus ring the way cards do it. Tokens
     resolve at computed-value time with literal fallbacks, so injection
     order does not matter. z-index 150 sits above the sticky cat rail (40)
     and below the command palette (200). */
  var stylesDone = false;
  function injectStyles() {
    if (stylesDone) return;
    stylesDone = true;
    var metal = 'linear-gradient(150deg,#cdd2d9 0%,#9aa1ab 16%,#565c66 45%,#7d848f 70%,#e6eaef 100%)';
    var css = ''
      + '.dispatch-pop{position:fixed;right:20px;bottom:20px;z-index:150;width:356px;'
      + 'padding:5px 5px 5px 16px;border-radius:15px;'
      + 'background:' + metal + ';'
      + 'box-shadow:0 0 0 1px #14171c,var(--shadow-panel, 0 8px 40px rgba(0,0,0,.6), 0 24px 64px rgba(0,0,0,.35));'
      + 'animation:dispatchPopIn .45s cubic-bezier(.22,1,.36,1) both,dispatchGlow 1.1s ease-out}'
      /* The rail groove: a recessed slot machined into the left edge. */
      + '.dispatch-pop::before{content:"";position:absolute;left:6px;top:30px;bottom:30px;width:4px;'
      + 'border-radius:2px;background:linear-gradient(180deg,#23272e,#3a4149 30%,#23272e);'
      + 'box-shadow:inset 0 1px 2px rgba(0,0,0,.65),0 1px 0 rgba(255,255,255,.28);pointer-events:none}'
      + '.dispatch-pop__body{position:relative;border-radius:10px;overflow:hidden;'
      + 'background:rgba(4,7,20,.94);backdrop-filter:blur(20px) saturate(170%);'
      + '-webkit-backdrop-filter:blur(20px) saturate(170%);'
      + 'box-shadow:0 0 0 1px rgba(0,0,0,.6),inset 0 1px 0 rgba(255,255,255,.06)}'
      + '.dispatch-pop__body::before{content:"";position:absolute;top:0;left:0;right:0;height:1px;'
      + 'background:linear-gradient(90deg,transparent,var(--pop-accent,#3b82f6),transparent);'
      + 'opacity:.55;pointer-events:none;z-index:1}'
      + '.dispatch-pop__bar{display:flex;align-items:center;justify-content:space-between;'
      + 'padding:8px 12px;border-bottom:1px solid var(--border, rgba(255,255,255,.08));'
      + 'background:linear-gradient(180deg,color-mix(in srgb, var(--pop-accent,#3b82f6) 8%, transparent),transparent)}'
      + '.dispatch-pop__label{display:inline-flex;align-items:center;gap:6px;'
      + 'font-size:.7rem;font-weight:600;letter-spacing:.1em;text-transform:uppercase;'
      + 'color:color-mix(in srgb, var(--pop-accent,#3b82f6) 65%, #fff);'
      + 'text-decoration:none;transition:color .2s}'
      + '.dispatch-pop__label:hover{color:#fff;text-decoration:underline;text-underline-offset:3px}'
      + '.dispatch-pop__sat{flex:none}'
      + '.dispatch-pop__wave{opacity:.85;transform-box:view-box;transform-origin:6.6px 16px}'
      + '.dispatch-pop__wave--2{animation-delay:-2.35s}'
      + '.dispatch-pop__wave--3{animation-delay:-2s}'
      + '.dispatch-pop__label .dispatch-pop__wave{animation:dispatchWave 2.7s ease-in-out infinite}'
      + '.dispatch-dock:hover .dispatch-pop__wave{animation:dispatchWave 2.7s ease-in-out infinite}'
      + '@keyframes dispatchWave{0%,100%{opacity:.25;transform:scale(.94)}'
      + '35%{opacity:1;transform:scale(1.03)}}'
      /* The page gains no fourth permanent animator: the waves idle out.
         (After the label rule so equal specificity resolves to idle.) */
      + '.dispatch-pop--idle .dispatch-pop__wave{animation:none}'
      + '.dispatch-pop__close{all:unset;cursor:pointer;width:28px;height:28px;display:flex;'
      + 'align-items:center;justify-content:center;border-radius:8px;'
      + 'color:var(--text-muted, rgba(172,188,218,.78));font-size:16px;line-height:1}'
      + '.dispatch-pop__close:hover{background:rgba(255,255,255,.18);color:#fff}'
      + '.dispatch-pop__close:focus-visible{outline:2px solid var(--pop-accent,#60a5fa)}'
      + '.dispatch-pop__frame{display:block;width:100%;height:320px;border:0;background:var(--bg, #000912)}'
      /* Opaque veil until the framed doc has painted, so a slow CDN load
         never flashes white inside the dark card. */
      + '.dispatch-pop__wait{position:absolute;left:0;right:0;bottom:0;height:320px;display:flex;'
      + 'align-items:center;justify-content:center;gap:8px;background:var(--bg, #000912);'
      + 'color:var(--text-muted, rgba(172,188,218,.6));font-size:11px;letter-spacing:.18em;'
      + 'text-transform:uppercase;transition:opacity .3s;pointer-events:none}'
      + '.dispatch-pop__wait--done{opacity:0}'
      + '.dispatch-pop__wait::before{content:"";width:5px;height:5px;border-radius:50%;'
      + 'background:var(--pop-accent,#60a5fa);animation:dispatchBlink 1.2s ease-in-out infinite}'
      /* The dock: the satellite that stays behind. Quiet at rest, lights up
         and starts signalling on approach, reopens the card on click. */
      + '.dispatch-dock{position:fixed;right:20px;bottom:20px;z-index:150;width:44px;height:44px;'
      + 'padding:4px;border:0;border-radius:50%;cursor:pointer;'
      + 'background:' + metal + ';'
      + 'box-shadow:0 0 0 1px #14171c,0 10px 26px rgba(0,0,0,.5);'
      + 'opacity:.8;transition:opacity .2s,transform .2s;'
      + 'animation:dispatchDockIn .3s cubic-bezier(.22,1,.36,1)}'
      + '.dispatch-dock:hover{opacity:1;transform:translateY(-2px)}'
      + '.dispatch-dock:focus-visible{outline:2px solid var(--pop-accent,#60a5fa);outline-offset:2px}'
      + '.dispatch-dock__disc{width:100%;height:100%;border-radius:50%;'
      + 'background:rgba(4,7,20,.95);display:flex;align-items:center;justify-content:center;'
      + 'color:color-mix(in srgb, var(--pop-accent,#3b82f6) 65%, #fff);'
      + 'box-shadow:inset 0 1px 0 rgba(255,255,255,.08)}'
      + '@keyframes dispatchDockIn{from{opacity:0;transform:translateY(8px)}}'
      + '@keyframes dispatchBlink{0%,100%{opacity:.25}50%{opacity:1}}'
      + '@keyframes dispatchPopIn{from{opacity:0;transform:translateY(14px) scale(.97)}'
      + 'to{opacity:1;transform:translateY(0) scale(1)}}'
      + '@keyframes dispatchGlow{from{box-shadow:0 0 0 1px #14171c,0 8px 40px rgba(0,0,0,.6),'
      + '0 24px 64px rgba(0,0,0,.35),0 0 26px color-mix(in srgb, var(--pop-accent,#3b82f6) 30%, transparent)}'
      + 'to{box-shadow:0 0 0 1px #14171c,0 8px 40px rgba(0,0,0,.6),0 24px 64px rgba(0,0,0,.35),0 0 0 transparent}}'
      + '@media (prefers-reduced-motion: reduce){.dispatch-pop,.dispatch-pop__wave,'
      + '.dispatch-pop__wait::before,.dispatch-dock{animation:none;transition:none}}';
    var style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);
  }

  var dock = null;
  function showDock(latest) {
    injectStyles();
    if (dock) { dock.hidden = false; return; }
    dock = document.createElement('button');
    dock.type = 'button';
    dock.className = 'dispatch-dock';
    dock.setAttribute('aria-label', 'Fleet news');
    dock.title = NAME + ': fleet news';
    accentInto(dock);
    dock.innerHTML = '<span class="dispatch-dock__disc">' + satSvg('dispatch-dock__sat', 20) + '</span>';
    dock.addEventListener('click', function () {
      dock.hidden = true;
      show(latest);
    });
    document.body.appendChild(dock);
  }

  function show(latest) {
    injectStyles();
    var pop = document.createElement('aside');
    pop.className = 'dispatch-pop';
    pop.setAttribute('role', 'complementary');
    pop.setAttribute('aria-label', 'Fleet news');
    accentInto(pop);

    var bar = document.createElement('div');
    bar.className = 'dispatch-pop__bar';
    var label = document.createElement('a');
    label.className = 'dispatch-pop__label';
    label.textContent = NAME + ' · Fleet news';
    /* After textContent, which would wipe children. Static string, own DOM. */
    label.insertAdjacentHTML('afterbegin', satSvg('dispatch-pop__sat', 16));
    label.href = BASE;
    label.target = '_blank';
    label.rel = 'noopener noreferrer';
    var close = document.createElement('button');
    close.className = 'dispatch-pop__close';
    close.type = 'button';
    close.setAttribute('aria-label', 'Dismiss fleet news');
    close.textContent = '×';
    close.addEventListener('click', function () {
      try { localStorage.setItem(KEY, latest); } catch (e) { /* private browsing */ }
      pop.remove();
      showDock(latest);
    });
    bar.appendChild(label);
    bar.appendChild(close);

    var frame = document.createElement('iframe');
    frame.className = 'dispatch-pop__frame';
    /* brand=0: the bar above already names the site, so the embed drops its
       own masthead instead of saying it twice. */
    frame.src = BASE + '?embed=1&limit=3&brand=0';
    frame.title = NAME + ': latest fleet news';
    // Sandbox blocks top-level navigation, downloads, and forms from the
    // framed page. allow-same-origin stays: Dispatch is our own origin, the
    // hub is a different origin either way, and without it the frame's ES
    // module loads become CORS-mode requests that no local dev server mix
    // reliably satisfies.
    frame.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox');

    /* "Receiving" veil: lifts on the frame's load event, which fires after
       the framed doc's stylesheets, so no white leaks through the fade. */
    var wait = document.createElement('div');
    wait.className = 'dispatch-pop__wait';
    wait.textContent = 'receiving…';
    frame.addEventListener('load', function () {
      wait.classList.add('dispatch-pop__wait--done');
      setTimeout(function () { wait.remove(); }, 350);
    });

    var body = document.createElement('div');
    body.className = 'dispatch-pop__body';
    body.appendChild(bar);
    body.appendChild(frame);
    body.appendChild(wait);
    pop.appendChild(body);

    document.body.appendChild(pop);
    setTimeout(function () { pop.classList.add('dispatch-pop--idle'); }, 10000);
  }

  function boot() {
    // Desktop only, judged when we are about to show, not at script load:
    // on mobile a corner iframe is just an ad.
    if (!window.matchMedia('(min-width: 900px)').matches) return;
    fetch(BASE + 'data/posts.json', { cache: 'no-cache' })
      .then(function (res) { return res.ok ? res.json() : null; })
      .then(function (doc) {
        if (!doc) return;
        var latest = latestDate(doc);
        if (!latest) return;
        var seen = null;
        try { seen = localStorage.getItem(KEY); } catch (e) { /* private browsing */ }
        // Old news: no card, just the quiet satellite in the corner.
        if (seen && seen >= latest) { showDock(latest); return; }
        show(latest);
      })
      .catch(function () { /* dispatch unreachable: no popup, no noise */ });
  }

  if ('requestIdleCallback' in window) {
    requestIdleCallback(boot, { timeout: 4000 });
  } else {
    setTimeout(boot, 2500);
  }
})();
