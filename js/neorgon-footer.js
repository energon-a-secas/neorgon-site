/* ══════════════════════════════════════════════════════════════
   Neorgon Footer Kit — footer.js
   Behavior harness: structure normalisation, meta bar (Neorgon /
   source / version / updated), back-to-top, optional theme menu,
   bottom-pinning guard for wrapped layouts.
   Vendored per site as js/neorgon-footer.js — do not edit copies.
   No dependencies. Load with `defer`.
   ══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window.__neoFooterInit) return;
  window.__neoFooterInit = true;

  var CDN = 'https://cdn.neorgon.org/v1.0.0';
  var HUB = 'https://neorgon.com/';
  var GH = 'https://github.com';
  var TOP_THRESHOLD = 600;

  function meta(name) {
    var el = document.querySelector('meta[name="' + name + '"]');
    return el ? el.content.trim() : '';
  }

  /* ── Live flag: ?footer=live or <meta name="neo-footer-source" content="live">
     appends the CDN stylesheet after the vendored one (CDN wins). Mirrors
     the header kit — JS harness always stays vendored. ────────────────── */
  (function liveFlag() {
    var live = new URLSearchParams(location.search).get('footer') === 'live' ||
               meta('neo-footer-source') === 'live';
    if (!live) return;
    var link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = CDN + '/footer/footer.css';
    document.head.appendChild(link);
    document.documentElement.setAttribute('data-neo-footer-live', '');
  })();

  /* ── Small builders ─────────────────────────────────────────────────── */
  function el(tag, cls, text) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text != null) node.textContent = text;
    return node;
  }
  function link(href, text, external) {
    var a = el('a', null, text);
    a.href = href;
    if (external) { a.target = '_blank'; a.rel = 'noopener noreferrer'; }
    return a;
  }
  function sep() {
    var s = el('span', 'neo-footer-sep', '·');
    s.setAttribute('aria-hidden', 'true');
    return s;
  }

  /* ── Structure: guarantee a .neo-footer-inner so sites can author the
     footer as one bare line of copy and still get kit layout. Loose
     children are moved (not cloned), so any site listeners survive. ──── */
  function ensureInner(footer) {
    var inner = footer.querySelector(':scope > .neo-footer-inner');
    if (inner) return inner;

    inner = el('div', 'neo-footer-inner');
    var moved = Array.prototype.slice.call(footer.childNodes);
    var hasElement = moved.some(function (n) { return n.nodeType === 1; });

    /* Bare text ("Part of Neorgon") becomes a proper note paragraph;
       richer markup is wrapped as-is. */
    var host = inner;
    if (!hasElement) { host = el('p', 'neo-footer-note'); inner.appendChild(host); }
    moved.forEach(function (n) { host.appendChild(n); });

    footer.appendChild(inner);
    return inner;
  }

  /* ── Bottom-pinning for wrapped layouts ─────────────────────────────
     The CSS pins the footer via `body:has(> .neo-footer)`. When a site
     nests the footer inside a wrapper that selector cannot match, so
     tag the chain here instead. ─────────────────────────────────────── */
  function ensurePinning(footer) {
    if (footer.getAttribute('data-stick') === 'off') return;
    var parent = footer.parentElement;
    if (!parent || parent === document.body) return;
    parent.classList.add('neo-footer-host');
    document.body.classList.add('neo-footer-root');
  }

  /* ── Theme menu — reuses the header kit's registry so themes are
     defined in exactly one place. No header kit on the page → no menu. ─ */
  var PALETTE_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M12 22a10 10 0 1 1 10-10c0 1.66-1.34 3-3 3h-2.5a2.5 2.5 0 0 0-1.8 4.2c.4.43.3 1.05-.13 1.42A9.9 9.9 0 0 1 12 22z"/>' +
    '<circle cx="7.5" cy="11.5" r="1" fill="currentColor"/><circle cx="10.5" cy="7.5" r="1" fill="currentColor"/>' +
    '<circle cx="14.5" cy="7.5" r="1" fill="currentColor"/><circle cx="17.5" cy="11.5" r="1" fill="currentColor"/></svg>';

  function themeRegistry() {
    var api = window.NeoHeader;
    if (!api) return null;
    if (api.list && api.list.length) return api.list;
    /* Older vendored header.js exposes ids only — derive a usable label. */
    return (api.themes || []).map(function (id) {
      return { id: id, label: id.charAt(0).toUpperCase() + id.slice(1), swatch: 'transparent' };
    });
  }

  function buildThemeMenu() {
    var themes = themeRegistry();
    if (!themes) return null;

    var wrap = el('div', 'neo-footer-theme');
    var toggle = el('button', 'neo-footer-theme-toggle');
    toggle.type = 'button';
    toggle.setAttribute('aria-haspopup', 'menu');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.innerHTML = PALETTE_SVG + '<span>Theme</span>';

    var menu = el('div', 'neo-footer-menu');
    menu.setAttribute('role', 'menu');

    function mark() {
      var active = window.NeoHeader.getTheme();
      menu.querySelectorAll('[data-theme-id]').forEach(function (item) {
        item.setAttribute('aria-checked', String(item.getAttribute('data-theme-id') === active));
      });
    }
    function close() {
      menu.classList.remove('open');
      toggle.setAttribute('aria-expanded', 'false');
    }

    themes.forEach(function (t) {
      var item = el('button');
      item.type = 'button';
      item.setAttribute('role', 'menuitemradio');
      item.setAttribute('data-theme-id', t.id);
      item.setAttribute('aria-checked', 'false');
      item.innerHTML = '<span class="theme-swatch" style="background:' + t.swatch + '"></span>';
      item.appendChild(document.createTextNode(t.label));
      item.addEventListener('click', function () {
        window.NeoHeader.setTheme(t.id);
        mark();
        close();
        toggle.focus();
      });
      menu.appendChild(item);
    });

    toggle.addEventListener('click', function (e) {
      e.stopPropagation();
      var open = menu.classList.toggle('open');
      toggle.setAttribute('aria-expanded', String(open));
      if (open) { mark(); var first = menu.querySelector('button'); if (first) first.focus(); }
    });
    document.addEventListener('click', function (e) {
      if (!wrap.contains(e.target)) close();
    });
    menu.addEventListener('keydown', function (e) {
      var items = Array.prototype.slice.call(menu.querySelectorAll('button'));
      var i = items.indexOf(document.activeElement);
      if (e.key === 'Escape') { e.preventDefault(); close(); toggle.focus(); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); (items[i + 1] || items[0]).focus(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); (items[i - 1] || items[items.length - 1]).focus(); }
      else if (e.key === 'Tab') close();
    });

    mark();
    wrap.appendChild(toggle);
    wrap.appendChild(menu);
    return wrap;
  }

  /* ── Meta bar ────────────────────────────────────────────────────────
     "Part of Neorgon · Source · v1.2.0 · updated Aug 2026 [· Theme]".
     The hub link is skipped when the site already links neorgon.com, so
     retrofitting an existing footer never produces a duplicate. ─────── */
  function formatUpdated(raw) {
    var d = new Date(raw);
    if (isNaN(d)) return raw;
    return 'updated ' + d.toLocaleDateString('en-GB', { month: 'short', year: 'numeric', timeZone: 'UTC' });
  }

  function buildBar(footer, inner) {
    var items = [];

    /* Only add the hub link when the site's own copy doesn't already
       carry one — retrofits keep their hand-written "Part of Neorgon". */
    if (!inner.querySelector('a[href*="neorgon.com"]')) {
      items.push(link(HUB, 'Part of Neorgon'));
    }

    var repo = meta('neo-repo');
    if (repo) items.push(link(/^https?:/.test(repo) ? repo : GH + '/' + repo, 'Source', true));

    var version = meta('neo-version');
    if (version) items.push(el('span', 'neo-footer-stamp', /^v/i.test(version) ? version : 'v' + version));

    var updated = meta('neo-updated');
    if (updated) items.push(el('span', 'neo-footer-stamp', formatUpdated(updated)));

    if (meta('neo-theme-switcher') === 'footer') {
      var theme = buildThemeMenu();
      if (theme) items.push(theme);
    }

    if (!items.length) return null;

    var bar = el('div', 'neo-footer-bar');
    /* Content mode splits the bar: © on the left, everything else right. */
    var host = bar;
    if (footer.getAttribute('data-footer-mode') === 'content') {
      bar.appendChild(el('span', null, '© ' + new Date().getFullYear() + ' Neorgon'));
      host = el('div', 'neo-footer-bar-group');
      bar.appendChild(host);
    }

    items.forEach(function (item, i) {
      if (i) host.appendChild(sep());
      host.appendChild(item);
    });
    return bar;
  }

  /* ── Back to top ─────────────────────────────────────────────────── */
  function buildBackToTop(footer) {
    if (footer.getAttribute('data-footer-top') === 'off') return;

    var btn = el('button', 'neo-top');
    btn.type = 'button';
    btn.title = 'Back to top';
    btn.setAttribute('aria-label', 'Back to top');
    btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" ' +
      'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 19V5M5 12l7-7 7 7"/></svg>';

    btn.addEventListener('click', function () {
      var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
      /* Keep keyboard users oriented: park focus on the top landmark. */
      var landmark = document.querySelector('.header-bar, header, #main');
      if (landmark) {
        landmark.setAttribute('tabindex', '-1');
        landmark.focus({ preventScroll: true });
      }
    });

    document.body.appendChild(btn);

    var ticking = false;
    function update() {
      btn.classList.toggle('is-visible', window.scrollY > TOP_THRESHOLD);
      ticking = false;
    }
    window.addEventListener('scroll', function () {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(update);
    }, { passive: true });
    update();
    return btn;
  }

  /* ── Init ────────────────────────────────────────────────────────── */
  function init() {
    /* Generic nicety: any element marked data-neo-year gets the current
       year, so hand-written © lines never go stale. */
    var year = String(new Date().getFullYear());
    document.querySelectorAll('[data-neo-year]').forEach(function (n) { n.textContent = year; });

    var footers = Array.prototype.slice.call(document.querySelectorAll('.neo-footer'));
    if (!footers.length) return;

    footers.forEach(function (footer) {
      if (footer.__neoDone) return;
      footer.__neoDone = true;
      if (!footer.hasAttribute('data-footer-mode')) footer.setAttribute('data-footer-mode', 'minimal');
      var inner = ensureInner(footer);
      var bar = buildBar(footer, inner);
      if (bar) footer.appendChild(bar);
    });

    /* The page's real footer is the last one under <body> (previews and
       embedded samples sit deeper). Only it gets pinned + back-to-top,
       and only it is the contentinfo landmark. */
    var primary = footers.filter(function (f) { return f.parentElement === document.body; }).pop() ||
                  footers[footers.length - 1];
    if (!primary.hasAttribute('role')) primary.setAttribute('role', 'contentinfo');
    ensurePinning(primary);
    buildBackToTop(primary);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  window.NeoFooter = { init: init };
})();
