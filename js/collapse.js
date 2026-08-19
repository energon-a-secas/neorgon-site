/* ── Collapsible card groups ──────────────────────────────────────────────────
   A `.card-group` carrying `data-collapsed="true"` ships closed and grows a
   toggle on its own heading. Two sections use it: Archive, where the whole
   point is that these tools are no longer the recommendation, and Platforms,
   which is four external destinations rather than tools we made.

   The default lives in the HTML; the visitor's choice overrides it and
   persists. Only *deviations* from the default are stored, so changing a
   group's shipped default later actually reaches everyone who never touched
   it, instead of being masked by a stale saved "open".

   Why the label text is never touched: js/catnav.js builds the category rail
   from `.group-label`'s `textContent`, so a count rendered as a text node
   would turn the chip "Archive" into "Archive 1 tool". The count is generated
   content off `data-count` and the chevron is an SVG, neither of which
   `textContent` can see.
─────────────────────────────────────────────────────────────────────────────── */
(function () {
  var KEY = 'neorgon-collapsed';

  var groups = Array.from(
    document.querySelectorAll('#tools > .card-group[data-collapsed]')
  );
  if (!groups.length) return;

  function readPrefs() {
    try {
      var raw = JSON.parse(localStorage.getItem(KEY));
      return (raw && typeof raw === 'object' && !Array.isArray(raw)) ? raw : {};
    } catch (e) { return {}; }
  }

  function writePrefs(prefs) {
    try { localStorage.setItem(KEY, JSON.stringify(prefs)); } catch (e) { /* private mode */ }
  }

  var prefs = readPrefs();

  var CHEVRON =
    '<svg class="group-chevron" aria-hidden="true" width="14" height="14" viewBox="0 0 24 24"' +
    ' fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"' +
    ' stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>';

  function countLabel(group) {
    var n = group.querySelectorAll('.site-card[data-card-id]').length;
    return n + (n === 1 ? ' tool' : ' tools');
  }

  var registry = {};

  groups.forEach(function (group) {
    var label = group.querySelector('.group-label');
    var grid = group.querySelector('.sites-grid');
    if (!label || !group.id || !grid) return;

    if (!grid.id) grid.id = group.id + '-grid';

    /* Move the heading's own children into a button rather than rebuilding
       them: the dot span and the label text node are the heading, and
       recreating them from a string is how the two drift apart. */
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'group-toggle';
    btn.setAttribute('aria-controls', grid.id);
    while (label.firstChild) btn.appendChild(label.firstChild);

    var count = document.createElement('span');
    count.className = 'group-count';
    count.setAttribute('data-count', countLabel(group));
    count.setAttribute('aria-hidden', 'true');
    btn.appendChild(count);
    btn.insertAdjacentHTML('beforeend', CHEVRON);

    label.appendChild(btn);

    /* The shipped default, before any stored preference is applied. */
    var defaultOpen = group.dataset.collapsed !== 'true';

    function isOpen() {
      var saved = prefs[group.id];
      if (saved === 'open') return true;
      if (saved === 'closed') return false;
      return defaultOpen;
    }

    function paint(open) {
      group.dataset.collapsed = open ? 'false' : 'true';
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      /* The count is only worth saying while the cards are out of sight. */
      count.setAttribute('data-count', open ? '' : countLabel(group));
    }

    function set(open, remember) {
      paint(open);
      if (remember) {
        if (open === defaultOpen) delete prefs[group.id];
        else prefs[group.id] = open ? 'open' : 'closed';
        writePrefs(prefs);
      }
      if (open) {
        /* Re-run once on expand: both shelves' overflow observer and the
           scroll-spy read layout, and this is the one moment the page grows
           by a whole section. */
        window.dispatchEvent(new Event('resize'));
      }
    }

    btn.addEventListener('click', function () {
      var next = !isOpen();
      set(next, true);
      if (next && window._neoSound && window._neoSound.dropCard) window._neoSound.dropCard();
    });

    registry[group.id] = {
      open: function () { if (!isOpen()) set(true, true); },
      isOpen: isOpen
    };

    paint(isOpen());
  });

  /* ── Jumping into a closed section ──────────────────────────────────────
     Three things scroll to a group: a category chip, the browser's own
     fragment jump, and the terminal's `open <cat>`. Landing on a heading with
     nothing under it reads as a broken page, so any of them opens it first.
     `expand` is exposed for the terminal, which scrolls without a hash. */
  function expand(id) {
    var entry = registry[id];
    if (entry) { entry.open(); return true; }
    return false;
  }

  window._neoCollapse = { expand: expand, isOpen: function (id) {
    return registry[id] ? registry[id].isOpen() : true;
  } };

  document.addEventListener('click', function (e) {
    var link = e.target.closest && e.target.closest('a[href^="#group-"]');
    if (!link) return;
    expand(link.getAttribute('href').slice(1));
  }, true);

  window.addEventListener('hashchange', function () {
    if (location.hash.length > 1) expand(location.hash.slice(1));
  });

  if (location.hash.length > 1) expand(location.hash.slice(1));
})();
