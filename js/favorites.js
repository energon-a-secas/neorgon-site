/* ── Favorites ────────────────────────────────────────────────────────────────
   A shelf of the visitor's own tools, above the catalog and separate from it.

   The catalog is ours: eleven categories in an order we chose. Favorites are
   theirs. Mixing the two would mean a hub whose shape depends on who is looking
   at it, so this adds a shelf instead of reordering anything — the categories
   below are byte-for-byte what a first-time visitor sees.

   Storage is localStorage, per browser, no account. Nothing leaves the page.

   The shelf renders *clones*, the same trick the Recently shipped rail uses:
   `window._neoMakeEcho` (js/recent.js) retags a card's `data-card-id` to
   `data-echo-id`, which is what keeps a favorited tool out of the search index,
   the "N of M tools" count, the drag-reorder and the command palette. Favorite
   a tool and no number on the page moves.

   Three states, three signals:
     saved   — the card's border warms and its top hairline stays lit
     pinned  — a saved tool that holds the front of the shelf
     order   — everything else, dragged or arrow-keyed into place
─────────────────────────────────────────────────────────────────────────────── */
(function () {
  var KEY = 'neorgon-favorites';
  var CLEAR_CONFIRM_MS = 3000;

  var shelf = document.getElementById('favShelf');
  var grid = document.getElementById('favShelfGrid');
  var countEl = document.getElementById('favShelfCount');
  var clearBtn = document.getElementById('favClear');
  if (!shelf || !grid) return;

  var ICON = {
    star: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>',
    pin: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path class="pin-head" d="M9.4 3h5.2l-.85 5.1 2.75 2.6V13H7.5v-2.3l2.75-2.6z"/><path d="M12 13v7.5"/></svg>',
    grip: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><circle cx="9" cy="6.5" r="1.5"/><circle cx="15" cy="6.5" r="1.5"/><circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/><circle cx="9" cy="17.5" r="1.5"/><circle cx="15" cy="17.5" r="1.5"/></svg>',
  };

  /* ── Storage ──────────────────────────────────────────────────────────────
     v2 is [{ id, pinned }]. v1 was a bare array of ids and is still out there
     in real browsers, so it is read and silently upgraded on the next write. */
  function cardFor(id) {
    return document.querySelector('#tools .site-card[data-card-id="' + id + '"]');
  }

  function read() {
    var raw;
    try { raw = JSON.parse(localStorage.getItem(KEY)); } catch (e) { return []; }
    if (!Array.isArray(raw)) return [];
    return raw.map(function (entry) {
      if (typeof entry === 'string') return { id: entry, pinned: false };
      if (entry && typeof entry.id === 'string') return { id: entry.id, pinned: !!entry.pinned };
      return null;
    }).filter(Boolean);
  }

  function write() {
    try { localStorage.setItem(KEY, JSON.stringify(items)); } catch (e) { /* private mode */ }
  }

  /* A saved id whose card is gone — a tool renamed or retired — would sit in
     storage forever, counting toward a shelf it can never fill. Drop it on load
     and persist the drop, so the stored list can only describe tools that
     exist. */
  var stored = read();
  var items = stored.filter(function (it) { return !!cardFor(it.id); });
  if (items.length !== stored.length) write();

  function indexOf(id) {
    for (var i = 0; i < items.length; i++) if (items[i].id === id) return i;
    return -1;
  }
  function has(id) { return indexOf(id) !== -1; }
  function isPinned(id) {
    var i = indexOf(id);
    return i !== -1 && items[i].pinned;
  }

  /* Pinned first, order preserved inside each band. Drag cannot cross the
     boundary (see onMove), so this is normally a no-op — it is the guarantee
     that a list edited any other way still renders the way the UI promises. */
  function ordered() {
    return items.filter(function (i) { return i.pinned; })
      .concat(items.filter(function (i) { return !i.pinned; }));
  }

  /* Returns true when saved, false when removed, and null when the id names
     nothing in the catalog. Three outcomes rather than two, because `false`
     for both "removed" and "not a tool" is how a caller ends up reporting a
     removal that never happened. */
  function toggleFav(id) {
    if (!cardFor(id)) return null;
    var at = indexOf(id);
    if (at === -1) items.push({ id: id, pinned: false });
    else items.splice(at, 1);
    write();
    render();
    return has(id);
  }

  /* Pinning something unsaved saves it in the same gesture — "keep this at the
     front" already means "keep this". */
  function togglePin(id) {
    if (!cardFor(id)) return null;
    var at = indexOf(id);
    if (at === -1) { items.push({ id: id, pinned: true }); }
    else { items[at].pinned = !items[at].pinned; }
    write();
    render();
    return isPinned(id);
  }

  /* Keyboard equivalent of a drag, so reordering is not mouse-only. Movement
     stays inside the item's own band for the same reason the drag does. */
  function move(id, delta) {
    var band = ordered().filter(function (i) { return i.pinned === isPinned(id); });
    var pos = band.map(function (i) { return i.id; }).indexOf(id);
    var next = pos + delta;
    if (pos === -1 || next < 0 || next >= band.length) return false;
    band.splice(next, 0, band.splice(pos, 1)[0]);
    var other = items.filter(function (i) { return i.pinned !== isPinned(id); });
    items = isPinned(id) ? band.concat(other) : other.concat(band);
    write();
    render();
    return true;
  }

  /* ── The control strip ────────────────────────────────────────────────────
     One pill, bottom-right, opposite the arrow. The arrow at the top is "go
     there"; this is "keep this", and the two gestures never share a corner.

     A pill rather than a bare icon because the old single 28px star was a
     precision target — hovering anywhere on the card now surfaces a strip with
     a real surface behind it, and the star alone stays visible on a saved card
     so the state reads at rest.

     Each control is a <span role="button">, not a <button>, because a card is
     an <a> and nesting a button in a link is invalid. Clicks are intercepted
     and stopped before they reach the card, the same interception cards.js
     already does for multi-tool cards. Named trade-off: a screen reader
     announces buttons inside a link. */
  function keyOf(el) { return el.dataset.cardId || el.dataset.echoId || null; }

  function makeTool(cls, label, html) {
    var b = document.createElement('span');
    b.className = 'card-tool ' + cls;
    b.setAttribute('role', 'button');
    b.setAttribute('tabindex', '0');
    b.setAttribute('aria-label', label);
    b.innerHTML = html;
    return b;
  }

  function bind(el, fn) {
    function go(e) { e.preventDefault(); e.stopPropagation(); fn(e); }
    el.addEventListener('click', go);
    el.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') go(e);
    });
  }

  function ping(on) {
    if (window._neoSoundPing) window._neoSoundPing(on ? 880 : 520, 0.014);
  }

  function mount(el, inShelf) {
    if (el.querySelector('.card-tools')) return;
    var id = keyOf(el);
    if (!id) return;
    var host = el.querySelector('.card-content');
    if (!host) return;

    var strip = document.createElement('div');
    strip.className = 'card-tools';

    if (inShelf) {
      var grip = makeTool('drag-handle', 'Reorder, or use the arrow keys', ICON.grip);
      grip.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); });
      grip.addEventListener('keydown', function (e) {
        var d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
        if (!d) return;
        e.preventDefault();
        e.stopPropagation();
        if (move(id, d)) {
          ping(true);
          var again = grid.querySelector('.site-card[data-echo-id="' + id + '"] .drag-handle');
          if (again) again.focus();
        }
      });
      strip.appendChild(grip);
    }

    var pin = makeTool('pin-toggle', 'Pin', ICON.pin);
    bind(pin, function () { ping(togglePin(id)); });
    strip.appendChild(pin);

    var star = makeTool('fav-toggle', 'Save', ICON.star);
    bind(star, function () { ping(toggleFav(id)); });
    strip.appendChild(star);

    el.classList.add('has-fav');
    host.appendChild(strip);
  }

  function mountAll() {
    document.querySelectorAll('#tools .site-card[data-card-id]').forEach(function (el) { mount(el, false); });
    document.querySelectorAll('#recentRailGrid .site-card--echo[data-echo-id]').forEach(function (el) { mount(el, false); });
    grid.querySelectorAll('.site-card--echo[data-echo-id]').forEach(function (el) { mount(el, true); });
  }

  /* Every control for a tool has to agree, and a tool can carry three strips at
     once: its catalog card, its echo in Recently shipped, and its echo here. */
  function sync() {
    document.querySelectorAll('.card-tools').forEach(function (strip) {
      var card = strip.closest('.site-card');
      var id = keyOf(card);
      var saved = has(id);
      var pinned = isPinned(id);
      var name = ((card.querySelector('.card-name') || {}).textContent || 'this tool').trim();

      card.classList.toggle('is-fav', saved);
      card.classList.toggle('is-pinned', pinned);

      var star = strip.querySelector('.fav-toggle');
      star.classList.toggle('is-on', saved);
      star.setAttribute('aria-pressed', saved ? 'true' : 'false');
      star.setAttribute('aria-label', (saved ? 'Remove ' : 'Save ') + name);
      star.setAttribute('title', saved ? 'Remove from favorites' : 'Save to favorites');

      var pin = strip.querySelector('.pin-toggle');
      pin.classList.toggle('is-on', pinned);
      pin.setAttribute('aria-pressed', pinned ? 'true' : 'false');
      pin.setAttribute('aria-label', (pinned ? 'Unpin ' : 'Pin ') + name);
      pin.setAttribute('title', pinned ? 'Unpin' : 'Pin to the front');
    });
  }

  /* ── The shelf ────────────────────────────────────────────────────────── */
  function render() {
    grid.textContent = '';

    ordered().forEach(function (it, i) {
      var card = cardFor(it.id);
      if (!card) return;
      var echo = window._neoMakeEcho ? window._neoMakeEcho(card) : card.cloneNode(true);

      /* The clone inherits the original's strip markup but none of its
         listeners, so drop it and let mount() fit a live one. */
      var stale = echo.querySelector('.card-tools');
      if (stale) stale.remove();
      echo.classList.remove('has-fav');

      /* Suppress the browser's native link drag so it cannot race Sortable. */
      echo.setAttribute('draggable', 'false');
      echo.style.setProperty('--echo-delay', (i * 55) + 'ms');
      grid.appendChild(echo);
    });

    shelf.hidden = items.length === 0;
    if (countEl) {
      var pins = items.filter(function (i) { return i.pinned; }).length;
      countEl.textContent = items.length + ' saved' + (pins ? ' · ' + pins + ' pinned' : '');
    }
    resetClear();

    mountAll();
    sync();
  }

  /* ── Drag to reorder ──────────────────────────────────────────────────────
     Bound once to the container, which survives render() replacing its
     children. `handle` keeps a plain click on the card opening the tool, and
     onMove refuses a move across the pinned boundary so the card is stopped
     live at the edge rather than snapping back after the drop. */
  if (typeof Sortable !== 'undefined') {
    Sortable.create(grid, {
      animation: 200,
      handle: '.drag-handle',
      ghostClass: 'sortable-ghost',
      dragClass: 'sortable-drag',
      chosenClass: 'sortable-chosen',
      easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
      delay: 120,
      delayOnTouchOnly: true,
      touchStartThreshold: 5,
      /* Pointer-driven instead of native HTML5 drag-and-drop. These cards are
         <a> elements, and native DnD on an anchor is the browser's own
         "drag this link somewhere" gesture — it competes for the same motion
         and hands back a link-shaped drag image. The fallback path never
         starts a native drag, so the two cannot race. */
      forceFallback: true,
      fallbackClass: 'sortable-fallback',
      fallbackTolerance: 4,
      onMove: function (evt) {
        if (!evt.related || !evt.related.dataset) return true;
        return isPinned(evt.dragged.dataset.echoId) === isPinned(evt.related.dataset.echoId);
      },
      onStart: function () { if (window._neoSound) window._neoSound.dragStart(); },
      onEnd: function () {
        if (window._neoSound) window._neoSound.dropCard();
        var seen = Array.from(grid.children).map(function (el) { return el.dataset.echoId; });
        var byId = {};
        items.forEach(function (it) { byId[it.id] = it; });
        var next = seen.map(function (id) { return byId[id]; }).filter(Boolean);
        /* Anything the DOM did not report keeps its place at the end rather
           than being dropped: a reorder must never lose a favorite. */
        items.forEach(function (it) { if (seen.indexOf(it.id) === -1) next.push(it); });
        items = next;
        write();
        render();
      },
    });
  }

  /* ── Clear, with a second look ────────────────────────────────────────────
     Losing a hand-built shelf to one misplaced click is the kind of thing
     nobody reports and everybody resents, and there is no undo behind this. */
  var armed = false;
  var armedTimer = null;

  function resetClear() {
    if (!clearBtn) return;
    armed = false;
    clearTimeout(armedTimer);
    clearBtn.textContent = 'Clear';
    clearBtn.classList.remove('is-armed');
  }

  if (clearBtn) {
    clearBtn.addEventListener('click', function () {
      if (!armed) {
        armed = true;
        clearBtn.textContent = 'Clear all?';
        clearBtn.classList.add('is-armed');
        armedTimer = setTimeout(resetClear, CLEAR_CONFIRM_MS);
        return;
      }
      items = [];
      write();
      render();
    });
  }

  mountAll();
  render();

  /* Exposed for terminal.js `fav` / `favs` / `pin`. */
  window._neoFavorites = {
    list: function () { return ordered().map(function (i) { return i.id; }); },
    has: has,
    isPinned: isPinned,
    toggle: toggleFav,
    pin: togglePin,
    clear: function () { items = []; write(); render(); },
  };
})();
