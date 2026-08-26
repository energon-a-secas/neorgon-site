// Dispatch corner popup: surfaces fleet news on desktop, once per story.
// Fetches the Dispatch feed after idle; if the newest story is one this
// browser has not dismissed yet, a closable corner card embeds the
// ?embed=1 strip. Closing remembers the newest date in localStorage, so
// the popup returns only when there is actually news.
(function () {
  'use strict';

  // Double-inclusion guard: two script tags must not stack two cards.
  if (window.__neoDispatchPopup) return;
  window.__neoDispatchPopup = true;

  var KEY = 'neorgon-dispatch-seen';
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

  function injectStyles() {
    var css = ''
      + '.dispatch-pop{position:fixed;right:20px;bottom:20px;z-index:900;width:340px;'
      + 'background:#0a0c18;border:1px solid rgba(59,130,246,.4);border-radius:14px;'
      + 'box-shadow:0 18px 44px rgba(2,6,23,.6);overflow:hidden;'
      + 'animation:dispatchPopIn .35s cubic-bezier(.22,1,.36,1) both}'
      + '.dispatch-pop__bar{display:flex;align-items:center;justify-content:space-between;'
      + 'padding:8px 12px;border-bottom:1px solid rgba(148,163,184,.15)}'
      + '.dispatch-pop__label{font-size:11px;font-weight:700;letter-spacing:.14em;'
      + 'text-transform:uppercase;color:#60a5fa}'
      + '.dispatch-pop__close{all:unset;cursor:pointer;width:28px;height:28px;display:flex;'
      + 'align-items:center;justify-content:center;border-radius:8px;color:#94a3b8;font-size:16px;line-height:1}'
      + '.dispatch-pop__close:hover{background:rgba(148,163,184,.15);color:#fff}'
      + '.dispatch-pop__close:focus-visible{outline:2px solid #60a5fa}'
      + '.dispatch-pop__frame{display:block;width:100%;height:320px;border:0;background:#06070d}'
      + '@keyframes dispatchPopIn{from{opacity:0;transform:translateY(14px)}'
      + 'to{opacity:1;transform:translateY(0)}}'
      + '@media (prefers-reduced-motion: reduce){.dispatch-pop{animation:none}}';
    var style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);
  }

  function show(latest) {
    injectStyles();
    var pop = document.createElement('aside');
    pop.className = 'dispatch-pop';
    pop.setAttribute('role', 'complementary');
    pop.setAttribute('aria-label', 'Fleet news');

    var bar = document.createElement('div');
    bar.className = 'dispatch-pop__bar';
    var label = document.createElement('a');
    label.className = 'dispatch-pop__label';
    label.textContent = 'Fleet news';
    label.href = BASE;
    label.target = '_blank';
    label.rel = 'noopener noreferrer';
    label.style.textDecoration = 'none';
    var close = document.createElement('button');
    close.className = 'dispatch-pop__close';
    close.type = 'button';
    close.setAttribute('aria-label', 'Dismiss fleet news');
    close.textContent = '×';
    close.addEventListener('click', function () {
      try { localStorage.setItem(KEY, latest); } catch (e) { /* private browsing */ }
      pop.remove();
    });
    bar.appendChild(label);
    bar.appendChild(close);

    var frame = document.createElement('iframe');
    frame.className = 'dispatch-pop__frame';
    frame.src = BASE + '?embed=1&limit=3';
    frame.loading = 'lazy';
    frame.title = 'Dispatch: latest fleet news';
    // Sandbox blocks top-level navigation, downloads, and forms from the
    // framed page. allow-same-origin stays: Dispatch is our own origin, the
    // hub is a different origin either way, and without it the frame's ES
    // module loads become CORS-mode requests that no local dev server mix
    // reliably satisfies.
    frame.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox');

    pop.appendChild(bar);
    pop.appendChild(frame);
    document.body.appendChild(pop);
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
        if (seen && seen >= latest) return;
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
