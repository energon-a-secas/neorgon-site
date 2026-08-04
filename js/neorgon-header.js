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
       groups travel into the menu as a unit so their listeners survive. */
    var movable = Array.prototype.filter.call(actions.children, function (el) {
      return el !== overflow &&
             !el.hasAttribute('data-keep-mobile') &&
             !el.classList.contains('header-theme') &&
             el.matches('button, a, div, nav');
    });

    return { actions: actions, overflow: overflow, menu: menu, movable: movable };
  }

  function syncOverflow(state) {
    if (!state) return;
    if (mq.matches) {
      state.movable.forEach(function (el) { state.menu.appendChild(el); });
    } else {
      state.movable.forEach(function (el) { state.actions.insertBefore(el, state.overflow); });
      if (state.menu === openMenu) closeMenu();
    }
    state.overflow.hidden = state.menu.children.length === 0;
  }

  /* ── Auto-hide (app mode): hide on scroll down past threshold,
     reveal on scroll up. Never hides while a menu is open. Mode is
     checked per-scroll so it can be toggled live. ───────────────── */
  function initAutoHide(header) {
    var lastY = window.scrollY;
    var ticking = false;
    window.addEventListener('scroll', function () {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function () {
        var y = window.scrollY;
        if (header.getAttribute('data-header-mode') !== 'app') {
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

  /* ── Init ────────────────────────────────────────────────────────────── */
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
    var overflowState = buildOverflow(header);
    syncOverflow(overflowState);
    mq.addEventListener('change', function () { syncOverflow(overflowState); });
    initAutoHide(header);
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
    setTheme: function (name) { applyTheme(name); }
  };
})();
