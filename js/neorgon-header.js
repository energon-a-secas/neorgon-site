/* ══════════════════════════════════════════════════════════════
   Neorgon Header Kit — header.js
   Behavior harness: overflow collapse, dropdowns, theme switcher,
   cross-subdomain theme cookie, app-mode auto-hide, live CSS flag.
   Vendored per site as js/neorgon-header.js — do not edit copies.
   No dependencies. Load with `defer`.
   ══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window.__neoHeaderInit) return;
  window.__neoHeaderInit = true;

  var CDN = 'https://cdn.neorgon.org/v1.0.0';
  var MOBILE = '(max-width: 700px)';
  var COOKIE = 'neo_theme';

  var THEMES = [
    { id: 'default',   label: 'Default',   swatch: '#B015B0' },
    { id: 'christmas', label: 'Christmas', swatch: '#16a34a' },
    { id: 'new-year',  label: 'New Year',  swatch: '#fcd34d' },
    { id: 'halloween', label: 'Halloween', swatch: '#f97316' },
    { id: 'rain',      label: 'Rain',      swatch: '#7dd3fc' },
    { id: 'sakura',    label: 'Sakura',    swatch: '#fbcfe8' },
    { id: 'matrix',    label: 'Matrix',    swatch: '#00ff41' },
    { id: 'danger',    label: 'Danger',    swatch: '#dc2626' }
  ];

  /* ── Live flag: ?header=live or <meta name="neo-header-source" content="live">
     swaps in CDN stylesheets after local ones (CDN wins). JS harness stays
     vendored — live updates are visual-only. ─────────────────────────── */
  (function liveFlag() {
    var params = new URLSearchParams(location.search);
    var meta = document.querySelector('meta[name="neo-header-source"]');
    var live = params.get('header') === 'live' || (meta && meta.content === 'live');
    if (!live) return;
    ['header/header.css', 'header/themes.css'].forEach(function (href) {
      var link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = CDN + '/' + href;
      document.head.appendChild(link);
    });
    document.documentElement.setAttribute('data-neo-header-live', '');
  })();

  /* ── Theme cookie (shared across *.neorgon.com) ─────────────────────── */
  function cookieDomain() {
    return /(^|\.)neorgon\.com$/.test(location.hostname) ? '; Domain=.neorgon.com' : '';
  }
  function readThemeCookie() {
    var m = document.cookie.match(new RegExp('(?:^|;\\s*)' + COOKIE + '=([\\w-]+)'));
    return m ? decodeURIComponent(m[1]) : null;
  }
  function writeThemeCookie(name) {
    document.cookie = COOKIE + '=' + encodeURIComponent(name) +
      '; Path=/; Max-Age=31536000; SameSite=Lax' + cookieDomain();
  }
  function validTheme(name) {
    return THEMES.some(function (t) { return t.id === name; });
  }

  function currentTheme() {
    var param = new URLSearchParams(location.search).get('theme');
    if (param && validTheme(param)) return param;
    var cookie = readThemeCookie();
    if (cookie && validTheme(cookie)) return cookie;
    return 'default';
  }

  function applyTheme(name, save) {
    if (!validTheme(name)) name = 'default';
    if (name === 'default') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', name);
    if (save !== false) writeThemeCookie(name);
    document.querySelectorAll('.header-theme-menu [data-theme-id]').forEach(function (item) {
      item.setAttribute('aria-checked', String(item.getAttribute('data-theme-id') === name));
    });
    tintFavicon(name);
  }

  /* ── Favicon tint: the tab icon joins the theme ──────────────────────
     With a visitor theme active, the favicon becomes the site's own logo
     silhouetted in that theme's swatch, so the tab matches the page
     (sakura turns the icon pink too). Default restores the original.
     Opt out per site with <meta name="neo-favicon" content="off">.
     A cross-origin logo (CDN) is only canvas-readable with CORS; when it
     is not, toDataURL throws and the original favicon simply stays. */
  function tintFavicon(name) {
    try {
      var meta = document.querySelector('meta[name="neo-favicon"]');
      if (meta && meta.content === 'off') return;
      var link = document.querySelector('link[rel~="icon"]');
      if (!link) return;
      if (!link.getAttribute('data-neo-original')) {
        link.setAttribute('data-neo-original', link.href);
      }
      if (name === 'default') {
        link.href = link.getAttribute('data-neo-original');
        return;
      }
      var theme = null;
      for (var i = 0; i < THEMES.length; i++) {
        if (THEMES[i].id === name) theme = THEMES[i];
      }
      var img = document.querySelector('.header-logo-img');
      var src = img && (img.currentSrc || img.src);
      if (!theme || !src) return;
      var pic = new Image();
      if (src.indexOf(location.origin) !== 0) pic.crossOrigin = 'anonymous';
      pic.onload = function () {
        try {
          var c = document.createElement('canvas');
          c.width = c.height = 64;
          var ctx = c.getContext('2d');
          var s = Math.min(64 / pic.width, 64 / pic.height);
          var w = pic.width * s, h = pic.height * s;
          ctx.drawImage(pic, (64 - w) / 2, (64 - h) / 2, w, h);
          ctx.globalCompositeOperation = 'source-in';
          ctx.fillStyle = theme.swatch;
          ctx.fillRect(0, 0, 64, 64);
          link.href = c.toDataURL('image/png');
        } catch (e) { /* tainted canvas: keep the original favicon */ }
      };
      pic.src = src;
    } catch (e) { /* the favicon must never break the header */ }
  }

  /* ── Dropdown controller: one open at a time, Esc / outside click,
     arrow-key navigation. Menus are .header-menu; triggers carry
     aria-haspopup="menu". ────────────────────────────────────────────── */
  var openMenu = null, openTrigger = null;

  function closeMenu() {
    if (!openMenu) return;
    openMenu.classList.remove('open');
    if (openTrigger) openTrigger.setAttribute('aria-expanded', 'false');
    openMenu = openTrigger = null;
  }
  function toggleMenu(trigger, menu) {
    var isOpen = menu === openMenu;
    closeMenu();
    if (isOpen) return;
    menu.classList.add('open');
    trigger.setAttribute('aria-expanded', 'true');
    openMenu = menu;
    openTrigger = trigger;
  }
  function menuItems(menu) {
    return Array.prototype.filter.call(
      menu.querySelectorAll('button, a, [role="menuitem"], [role="menuitemradio"]'),
      function (el) { return el.offsetParent !== null; }
    );
  }

  document.addEventListener('click', function (e) {
    if (openMenu && !openMenu.contains(e.target) && !(openTrigger && openTrigger.contains(e.target))) {
      closeMenu();
    }
  });
  document.addEventListener('keydown', function (e) {
    if (!openMenu) return;
    var items = menuItems(openMenu);
    var idx = items.indexOf(document.activeElement);
    if (e.key === 'Escape') {
      closeMenu();
      if (openTrigger) openTrigger.focus();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      (items[idx + 1] || items[0]) && (items[idx + 1] || items[0]).focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      (items[idx - 1] || items[items.length - 1]) && (items[idx - 1] || items[items.length - 1]).focus();
    } else if (e.key === 'Home') {
      e.preventDefault();
      items[0] && items[0].focus();
    } else if (e.key === 'End') {
      e.preventDefault();
      items[items.length - 1] && items[items.length - 1].focus();
    } else if (e.key === 'Tab') {
      closeMenu();
    }
  });

  /* ── Theme switcher (injected before .header-home) ──────────────────── */
  var PALETTE_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
    'stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg">' +
    '<path d="M12 22a10 10 0 1 1 10-10c0 1.66-1.34 3-3 3h-2.5a2.5 2.5 0 0 0-1.8 4.2c.4.43.3 1.05-.13 1.42A9.9 9.9 0 0 1 12 22z"/>' +
    '<circle cx="7.5" cy="11.5" r="1" fill="currentColor"/><circle cx="10.5" cy="7.5" r="1" fill="currentColor"/>' +
    '<circle cx="14.5" cy="7.5" r="1" fill="currentColor"/><circle cx="17.5" cy="11.5" r="1" fill="currentColor"/></svg>';

  function buildThemeSwitcher(header) {
    var right = header.querySelector('.header-right') || header;
    var wrap = document.createElement('div');
    wrap.className = 'header-theme';

    var toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'header-theme-toggle';
    toggle.setAttribute('aria-haspopup', 'menu');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-label', 'Theme');
    toggle.title = 'Theme';
    toggle.innerHTML = PALETTE_SVG;

    var menu = document.createElement('div');
    menu.className = 'header-menu header-theme-menu';
    menu.setAttribute('role', 'menu');

    THEMES.forEach(function (t) {
      var item = document.createElement('button');
      item.type = 'button';
      item.setAttribute('role', 'menuitemradio');
      item.setAttribute('data-theme-id', t.id);
      item.setAttribute('aria-checked', 'false');
      item.innerHTML = '<span class="theme-swatch" style="background:' + t.swatch + '"></span>' + t.label;
      item.addEventListener('click', function () {
        applyTheme(t.id);
        closeMenu();
        toggle.focus();
      });
      menu.appendChild(item);
    });

    toggle.addEventListener('click', function (e) {
      e.stopPropagation();
      toggleMenu(toggle, menu);
    });

    wrap.appendChild(toggle);
    wrap.appendChild(menu);
    var home = right.querySelector('.header-home');
    right.insertBefore(wrap, home || null);
  }

  /* ── Overflow manager: on mobile, action buttons without
     data-keep-mobile move into a ⋯ .header-menu. Moving (not cloning)
     preserves each site's own event listeners. ───────────────────────── */
  var mq = window.matchMedia(MOBILE);

  function buildOverflow(header) {
    var actions = header.querySelector('.header-actions');
    if (!actions) return null;

    var overflow = document.createElement('div');
    overflow.className = 'header-overflow';
    overflow.hidden = true;

    var toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'header-overflow-toggle';
    toggle.setAttribute('aria-haspopup', 'menu');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-label', 'More actions');
    toggle.title = 'More actions';
    toggle.textContent = '⋯';

    var menu = document.createElement('div');
    menu.className = 'header-menu header-overflow-menu';
    menu.setAttribute('role', 'menu');

    toggle.addEventListener('click', function (e) {
      e.stopPropagation();
      toggleMenu(toggle, menu);
      if (menu.classList.contains('open')) {
        var first = menuItems(menu)[0];
        if (first) first.focus();
      }
    });

    /* Site-owned buttons land here on mobile — they don't know about the
       menu, so the kit closes it for them on activation. */
    menu.addEventListener('click', function (e) {
      if (e.target.closest('button, a')) closeMenu();
    });

    overflow.appendChild(toggle);
    overflow.appendChild(menu);
    actions.appendChild(overflow);

    /* Movable = any direct child not marked data-keep-mobile. Covers plain
       buttons/links and grouped controls (.header-btn-group divs, navs) —
       groups travel into the menu as a unit so their listeners survive.
       A live query, not an init-time snapshot: a control injected after
       init (site JS, or the kit's own source link) still collapses. */
    function movable() {
      return Array.prototype.filter.call(actions.children, function (el) {
        return el !== overflow &&
               !el.hasAttribute('data-keep-mobile') &&
               !el.classList.contains('header-theme') &&
               el.matches('button, a, div, nav');
      });
    }

    return { actions: actions, overflow: overflow, menu: menu, movable: movable };
  }

  function syncOverflow(state) {
    if (!state) return;
    if (mq.matches) {
      state.movable().forEach(function (el) { state.menu.appendChild(el); });
    } else {
      /* Restore everything the menu holds (copy first: the list is live). */
      Array.prototype.slice.call(state.menu.children).forEach(function (el) {
        state.actions.insertBefore(el, state.overflow);
      });
      if (state.menu === openMenu) closeMenu();
    }
    state.overflow.hidden = state.menu.children.length === 0;
  }

  /* ── Auto-hide: hide on scroll down past threshold, reveal on scroll
     up. Never hides while a menu is open. Both conditions are read
     per-scroll so either can be toggled live.

     `app` mode gets this by definition. Any other mode opts in with
     `data-header-autohide="on"` — a hub or content bar that wants its own
     look while still handing the viewport back on the way down. The two
     were fused before, so wanting the behaviour meant taking the slim
     56px bar and its gradient with it. ───────────────────────────── */
  function initAutoHide(header) {
    var lastY = window.scrollY;
    var ticking = false;
    /* Focus entering the bar reveals it. CSS paints the same frame via
       .header-hidden:focus-within; dropping the class here keeps the next
       scroll decision in agreement with what is on screen. */
    header.addEventListener('focusin', function () {
      header.classList.remove('header-hidden');
    });
    window.addEventListener('scroll', function () {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function () {
        var y = window.scrollY;
        var hides = header.getAttribute('data-header-mode') === 'app' ||
                    header.getAttribute('data-header-autohide') === 'on';
        if (!hides) {
          header.classList.remove('header-hidden');
        } else if (y > lastY && y > 80 && !openMenu) {
          header.classList.add('header-hidden');
        } else if (y < lastY || y <= 80) {
          header.classList.remove('header-hidden');
        }
        lastY = y;
        ticking = false;
      });
    }, { passive: true });
  }

  /* ── Analytics (fleet-wide, inert until configured) ──────────────────
     Two beacons, one canonical switch: GoatCounter (pageviews + labelled
     events, one site for the whole fleet, paths prefixed with the host)
     and Cloudflare Web Analytics (zero-maintenance pageview baseline;
     no events by design). Set the two constants HERE and re-run
     sync-header.sh, never in a vendored copy. Empty string = that
     beacon never loads, no network, no globals.

     Guards, in order: only on *.neorgon.com (local dev and forks stay
     silent); never for visitors sending Do Not Track or Global Privacy
     Control; a site opts out entirely with
     <meta name="neo-analytics" content="off">.

     Share-link arrivals: a page opened with a payload in the URL
     (#d= / #t= hash, ?src=, legacy ?yaml=) or an explicit ?via= marker
     counts one GoatCounter event at share/<host>/<label>, which is the
     number the 2026-08-20 platform plan's 30-day experiment reads. */
  var GOATCOUNTER = 'https://neorgon.goatcounter.com/count';
  var CF_TOKEN = '51ec560427e5479e8a06550a0f194b56';   // Cloudflare Web Analytics site token (public by design)

  function shareArrivalLabel() {
    var q = new URLSearchParams(location.search);
    var via = q.get('via');
    if (via) return (via.replace(/[^\w-]/g, '').slice(0, 32) || 'link');
    if (/^#[dts]=./.test(location.hash)) return 'hash-payload';
    if (q.get('src')) return 'src-url';
    if (q.get('yaml')) return 'yaml-legacy';
    return null;
  }

  (function initAnalytics() {
    if (!GOATCOUNTER && !CF_TOKEN) return;
    if (!/(^|\.)neorgon\.com$/.test(location.hostname)) return;
    if (navigator.doNotTrack === '1' || navigator.globalPrivacyControl ||
        window.globalPrivacyControl) return;
    var meta = document.querySelector('meta[name="neo-analytics"]');
    if (meta && meta.content === 'off') return;

    if (CF_TOKEN) {
      var cf = document.createElement('script');
      cf.defer = true;
      cf.src = 'https://static.cloudflareinsights.com/beacon.min.js';
      cf.setAttribute('data-cf-beacon', JSON.stringify({ token: CF_TOKEN }));
      document.head.appendChild(cf);
    }

    if (GOATCOUNTER) {
      /* Read the arrival label before any app code cleans the URL with
         replaceState; this script evaluates first. */
      var arrival = shareArrivalLabel();
      window.goatcounter = {
        endpoint: GOATCOUNTER,
        path: function (p) { return location.host + p; }
      };
      var gc = document.createElement('script');
      gc.async = true;
      gc.src = 'https://gc.zgo.at/count.js';
      gc.setAttribute('data-goatcounter', GOATCOUNTER);
      if (arrival) {
        gc.addEventListener('load', function () {
          if (window.goatcounter && window.goatcounter.count) {
            window.goatcounter.count({
              path: 'share/' + location.host + '/' + arrival,
              title: 'share arrival',
              event: true
            });
          }
        });
      }
      document.head.appendChild(gc);
    }
  })();

  /* ── Epigraph: the subtitle rests in French, resolves to English ──────
     Author the ENGLISH as the element's real text and put the French in
     `data-fr`. That order matters: with JS off, or before this runs, the
     visitor reads the honest description rather than an untranslated
     ornament. The French is an enhancement layered on top.

         <div class="header-subtitle" data-fr="Faites vos gammes.">
           Game patterns, and the drills that prove them</div>

     Hovering or focusing the title scrambles one into the other. The
     animating span is aria-hidden and a visually hidden twin carries the
     English, so assistive tech reads a stable sentence instead of a stream
     of decoding glyphs. ──────────────────────────────────────────────── */
  var GLYPHS = '#$%&*+<>?@[]^_{}~/|';          /* no em dash: smoke check 12 */
  var REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)');

  function scramble(span, to, toLang) {
    if (span._raf) cancelAnimationFrame(span._raf);
    if (REDUCED.matches) { span.textContent = to; span.lang = toLang; return; }

    var from = span.textContent, len = Math.max(from.length, to.length), q = [], i;
    for (i = 0; i < len; i++) {
      q.push({
        from: from.charAt(i), to: to.charAt(i), ch: '',
        start: Math.floor(Math.random() * 16),
        end: Math.floor(Math.random() * 16) + 16
      });
    }
    var frame = 0;
    (function tick() {
      var out = '', settled = 0, j, it;
      for (j = 0; j < q.length; j++) {
        it = q[j];
        if (frame >= it.end) { settled++; out += it.to; }
        else if (frame >= it.start) {
          /* Spaces hold their place, so the phrase keeps its word rhythm
             while the letters churn. */
          if (it.to === ' ') out += ' ';
          else {
            if (!it.ch || Math.random() < 0.28) it.ch = GLYPHS.charAt(Math.floor(Math.random() * GLYPHS.length));
            out += it.ch;
          }
        } else out += it.from;
      }
      span.textContent = out;
      if (settled === q.length) { span.lang = toLang; span._raf = 0; return; }
      frame++;
      span._raf = requestAnimationFrame(tick);
    })();
  }

  function initEpigraph(header) {
    var sub = header.querySelector('.header-subtitle[data-fr]');
    if (!sub) return;
    /* A subtitle owned by a runtime translation system is not ours to rewrite.
       The i18n pass would either overwrite the epigraph or capture mid-scramble
       glyphs as its source string, and both fail silently. Bilingual sites opt
       out by construction rather than by remembering not to add data-fr. */
    if (sub.hasAttribute('data-i18n')) return;
    var fr = (sub.getAttribute('data-fr') || '').trim();
    var en = sub.textContent.trim();
    if (!fr || !en) return;

    var span = document.createElement('span');
    span.className = 'neo-epi';
    span.setAttribute('aria-hidden', 'true');
    span.lang = 'fr';
    span.textContent = fr;

    var sr = document.createElement('span');
    sr.className = 'neo-epi-sr';
    sr.textContent = en;

    sub.textContent = '';
    sub.appendChild(span);
    sub.appendChild(sr);

    /* Reserve the wider of the two so the header does not jitter when the
       phrase changes length mid-animation. Skipped when the subtitle is
       hidden (mobile), where offsetWidth is 0 and there is no hover anyway. */
    if (span.offsetWidth) {
      var wFr = span.offsetWidth;
      span.textContent = en;
      var wEn = span.offsetWidth;
      span.textContent = fr;
      sub.style.minWidth = Math.max(wFr, wEn) + 'px';
    }

    /* The title link is already focusable, so keyboard users get this for
       free and no new tab stop is introduced inside the header. */
    var trigger = sub.closest('.header-title-link') || sub;

    /* Track the target language rather than a shown/hidden boolean. A boolean
       desyncs whenever mouseenter fires without its mouseleave, which is what
       happens when the tab is switched mid-hover: the flag stays true, and
       every later hover is a no-op. Comparing against the target cannot drift. */
    var target = 'fr';
    function to(lang) {
      if (target === lang) return;
      target = lang;
      scramble(span, lang === 'en' ? en : fr, lang);
    }
    trigger.addEventListener('mouseenter', function () { to('en'); });
    trigger.addEventListener('mouseleave', function () { to('fr'); });
    trigger.addEventListener('focus', function () { to('en'); });
    trigger.addEventListener('blur', function () { to('fr'); });

    /* requestAnimationFrame stops in a hidden tab, so a scramble caught by a
       tab switch freezes with decoding glyphs on screen and the visitor sees
       that garbage when they come back. Settle immediately instead. */
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden || !span._raf) return;
      cancelAnimationFrame(span._raf);
      span._raf = 0;
      span.textContent = target === 'en' ? en : fr;
      span.lang = target;
    });
  }

  /* ── Source link (opt-in) ────────────────────────────────────────────── */
  /* <meta name="neo-source-link" content="on"> renders a GitHub mark in
     .header-actions linking the repo from the same neo-repo meta the
     footer's Source line reads (full URL or org/repo shorthand, normalized
     identically so the two links can never disagree). Always the repo,
     never the org; no star counts (the fleet's CSPs block api.github.com). */
  function buildSourceLink(header) {
    var meta = document.querySelector('meta[name="neo-repo"]');
    var repo = meta && meta.content ? meta.content.trim() : '';
    if (!repo) return;
    var right = header.querySelector('.header-right');
    if (!right) return;
    var actions = header.querySelector('.header-actions');
    if (!actions) {
      actions = document.createElement('div');
      actions.className = 'header-actions';
      right.insertBefore(actions, right.firstChild);
    }
    var a = document.createElement('a');
    a.className = 'header-source';
    a.href = /^https?:/.test(repo) ? repo : 'https://github.com/' + repo;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.title = 'Star on GitHub';
    a.setAttribute('aria-label', 'Star on GitHub');
    a.innerHTML = '<svg viewBox="0 0 16 16" width="18" height="18" fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z"/></svg>';
    actions.appendChild(a);
  }

  /* ── Init ────────────────────────────────────────────────────────────── */
  var overflowState = null;

  function init() {
    applyTheme(currentTheme(), false);

    var header = document.querySelector('.header-bar');
    if (!header) return;

    /* Manual theme switcher is OPT-IN per site — fleet-wide themes are
       pushed centrally via CDN season.css, so the bar stays clean by
       default. Add <meta name="neo-theme-switcher" content="on"> to a
       site's <head> to show the palette button there. (?theme=x and the
       neo_theme cookie work regardless.) */
    if (document.querySelector('meta[name="neo-theme-switcher"][content="on"]')) {
      buildThemeSwitcher(header);
    }
    if (document.querySelector('meta[name="neo-source-link"][content="on"]')) {
      buildSourceLink(header);
    }
    overflowState = buildOverflow(header);
    syncOverflow(overflowState);
    mq.addEventListener('change', function () { syncOverflow(overflowState); });
    initAutoHide(header);
    initEpigraph(header);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  /* Public API — sites and the hub can hook in (e.g. sync page effects).
     `list` carries labels/swatches so the footer kit can render its own
     theme menu from this one registry instead of copying it. */
  window.NeoHeader = {
    themes: THEMES.map(function (t) { return t.id; }),
    list: THEMES,
    getTheme: currentTheme,
    setTheme: function (name) { applyTheme(name); },
    /* For site JS that injects a header control after init: re-run the
       overflow sync so the new control collapses on mobile immediately. */
    syncOverflow: function () { syncOverflow(overflowState); }
  };
})();
