/* ── Recently shipped ─────────────────────────────────────────────────────────
   Surfaces the newest tools above the categories, so a returning visitor sees
   what changed without scrolling 12 sections looking for something unfamiliar.

   Reads `data-added="YYYY-MM-DD"` off each card — the date lives next to the
   thing it describes, so adding a tool needs no list kept in sync here.

   The rail renders *clones*. Clones carry `data-echo-id` instead of
   `data-card-id` on purpose: search.js, previews.js and sortable.js all key on
   `data-card-id`, so renaming keeps the echo invisible to them and stops the
   same tool being counted twice in "N of M tools".
─────────────────────────────────────────────────────────────────────────────── */
(function () {
  var RAIL_SIZE = 6;      /* how many cards the rail shows */
  var NEW_DAYS = 30;      /* a tool stops being "new" after this many days */

  /* ── Safe clone, shared with js/favorites.js ────────────────────────────
     Two shelves now clone catalog cards, and every rule about what makes a
     clone safe is a rule both have to follow: retag the id so the catalog
     modules skip it, drop the inline delay entrance.js wrote, and turn a
     multi-tool card into something that still goes somewhere. Exported
     rather than duplicated, because a second copy of these rules is a
     second chance to get one of them wrong.

     Structure only. What the clone *says* — badges, stamps, stagger — is
     the calling shelf's business, and the two shelves disagree about it. */
  function makeEcho(card) {
    var echo = card.cloneNode(true);

    /* cloneNode copies inline styles, and js/entrance.js writes an
       `animation-delay` onto every catalog card. Inherited, that inline value
       beats `.site-card--echo { animation-delay: var(--echo-delay) }` in CSS —
       which is how the rail ended up revealing *after* the whole catalog it
       sits above. A shelf owns its own timing; drop whatever came with the
       clone before anything else reads it. */
    echo.style.animationDelay = '';

    /* Hand the clone a different key so the catalog modules skip it. */
    echo.removeAttribute('data-card-id');
    echo.setAttribute('data-echo-id', card.dataset.cardId);
    echo.classList.add('site-card--echo');

    /* A multi-tool card opens a popup wired by cards.js against
       data-card-id. Without that hook the clone would be a dead <div>, so
       point the echo at the tool's domain and let it behave like a link. */
    if (echo.classList.contains('multi-tool')) {
      var popup = echo.querySelector('.card-subtool-popup');
      if (popup) popup.remove();
      var first = card.querySelector('.card-subtool-popup a[href]');
      var domain = (card.querySelector('.card-domain') || {}).textContent || '';
      var href = first ? first.getAttribute('href') : 'https://' + domain.trim();
      var link = document.createElement('a');
      link.className = echo.className;
      link.setAttribute('href', href);
      link.setAttribute('data-echo-id', card.dataset.cardId);
      link.style.cssText = echo.style.cssText;
      link.innerHTML = echo.innerHTML;
      link.classList.remove('multi-tool');
      echo = link;
    }
    return echo;
  }
  window._neoMakeEcho = makeEcho;

  var rail = document.getElementById('recentRail');
  var grid = document.getElementById('recentRailGrid');
  if (!rail || !grid) return;

  function parseDate(str) {
    /* Parse as UTC midnight — `new Date('2026-08-06')` is already UTC, but
       building it explicitly avoids the local-timezone off-by-one that bites
       `new Date('2026-08-06 00:00')`. */
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(str || '');
    if (!m) return null;
    return Date.UTC(+m[1], +m[2] - 1, +m[3]);
  }

  function daysSince(ts) {
    return (Date.now() - ts) / 86400000;
  }

  /* Real tools only: external destinations, locked ghost cards and unshipped
     Soon cards are not "shipped tools" and would push genuine releases out of
     the rail. A Soon card should have no `data-added` in the first place — the
     check is here because getting that wrong would put an unreleased tool at
     the top of a shelf headed "Recently shipped", which is the one place the
     page cannot afford to be wrong.

     Archived tools are excluded for the same reason read the other way round:
     they shipped, but they are no longer what we recommend, and a shelf that
     leads with one is arguing against the catalog behind it.

     A group carrying `data-recent="off"` opts out of both recency surfaces —
     the rail *and* the badge below, since this list feeds both. UI Lab is the
     case it was built for: those tools are reference material, and a visitor
     scanning for what changed does not want a wireframe glossary handed to
     them as news. Group-level rather than per-card so a future reference
     category needs an attribute, not an edit here. */
  var candidates = Array.from(
    document.querySelectorAll('#tools .site-card[data-card-id][data-added]')
  ).filter(function (card) {
    var group = card.closest('.card-group');
    return !card.classList.contains('external-card') &&
           !card.classList.contains('ghost-card') &&
           card.dataset.status !== 'soon' &&
           card.dataset.status !== 'archived' &&
           !(group && group.dataset.recent === 'off');
  }).map(function (card) {
    return { el: card, ts: parseDate(card.dataset.added) };
  }).filter(function (c) {
    return c.ts !== null;
  });

  if (candidates.length === 0) return;

  candidates.sort(function (a, b) { return b.ts - a.ts; });

  /* ── NEW badge on the card in its own category ──────────────────────────
     Stamped on the original, not just the echo, so the badge is still there
     when someone finds the tool by browsing or searching. Expires on its own. */
  function stampBadge(card, ts) {
    if (daysSince(ts) > NEW_DAYS) return false;
    if (card.querySelector('.card-new-badge')) return true;
    var top = card.querySelector('.card-top');
    if (!top) return false;
    var badge = document.createElement('span');
    badge.className = 'card-new-badge';
    badge.textContent = 'New';
    /* The arrow/external glyph sits at the end of .card-top; insert before it
       so the badge reads after the icon rather than displacing the affordance. */
    var arrow = top.querySelector('.card-arrow, .external-badge');
    if (arrow) top.insertBefore(badge, arrow);
    else top.appendChild(badge);
    return true;
  }

  var freshCount = 0;
  candidates.forEach(function (c) {
    if (stampBadge(c.el, c.ts)) freshCount++;
  });

  /* ── Build the rail ─────────────────────────────────────────────────────── */
  var relFmt = (function () {
    /* Intl.RelativeTimeFormat is widely supported; fall back to plain text. */
    try { return new Intl.RelativeTimeFormat('en', { numeric: 'auto' }); }
    catch (e) { return null; }
  })();

  function relativeLabel(ts) {
    var days = Math.floor(daysSince(ts));
    if (!relFmt) return days <= 1 ? 'today' : days + ' days ago';
    if (days <= 0) return 'today';
    if (days < 7) return relFmt.format(-days, 'day');
    if (days < 31) return relFmt.format(-Math.floor(days / 7), 'week');
    return relFmt.format(-Math.floor(days / 30), 'month');
  }

  var shown = candidates.slice(0, RAIL_SIZE);

  shown.forEach(function (c, i) {
    var echo = makeEcho(c.el);

    /* Badges are stamped before cloning, so the echo inherits one — but every
       card in a shelf headed "Recently shipped" is new by definition, and the
       stamp below already says when. Drop it rather than labelling the obvious. */
    var inherited = echo.querySelector('.card-new-badge');
    if (inherited) inherited.remove();

    /* Stagger the entrance so the rail assembles left to right. */
    echo.style.setProperty('--echo-delay', (i * 60) + 'ms');

    /* Replace the tag row with when it shipped — in the rail, recency is the
       useful fact, and the tags are one scroll away on the real card. */
    var tags = echo.querySelector('.card-tags');
    if (tags) {
      var stamp = document.createElement('div');
      stamp.className = 'card-shipped';
      var dot = document.createElement('span');
      dot.className = 'card-shipped-dot';
      dot.setAttribute('aria-hidden', 'true');
      var text = document.createElement('span');
      var iso = c.el.dataset.added;
      text.textContent = 'Shipped ' + relativeLabel(c.ts);
      stamp.appendChild(dot);
      stamp.appendChild(text);
      stamp.setAttribute('title', iso);
      tags.replaceWith(stamp);
    }

    grid.appendChild(echo);
  });

  /* The rail shows at most RAIL_SIZE cards but the NEW badge covers everything
     inside NEW_DAYS, and those two numbers differ — a busy month puts 13 badges
     on the page while the rail holds 6. Saying only "13 new tools" next to six
     cards reads as a miscount, so state both and let the reader see the rail is
     a window, not the whole set. */
  var countEl = document.getElementById('recentRailCount');
  if (countEl) {
    if (freshCount > shown.length) {
      countEl.textContent = 'Latest ' + shown.length + ' of ' + freshCount + ' new this month';
    } else if (freshCount > 0) {
      countEl.textContent = freshCount + (freshCount === 1 ? ' new tool' : ' new tools') + ' this month';
    } else {
      countEl.textContent = 'Latest ' + shown.length;
    }
  }

  rail.hidden = false;

  /* Expose for the terminal's `new` command. */
  window._neoRecent = shown.map(function (c) {
    return {
      id: c.el.dataset.cardId,
      name: ((c.el.querySelector('.card-name') || {}).textContent || '').trim(),
      domain: ((c.el.querySelector('.card-domain') || {}).textContent || '').trim(),
      added: c.el.dataset.added,
      href: c.el.getAttribute('href') ||
            (c.el.querySelector('a[href]') || {}).getAttribute &&
            c.el.querySelector('a[href]').getAttribute('href') || ''
    };
  });
})();


/* ── Shelf overflow ───────────────────────────────────────────────────────────
   Both shelves are one horizontal row now, and the trailing mask fade is what
   says so. A fade over a row that already fits reads as a rendering bug, not as
   an invitation, so the fade is conditional on there actually being something
   off to the right.

   Kept here rather than in either shelf's own module because both shelves need
   it and neither owns the other: recent.js renders once at load, favorites.js
   re-renders on every star, drag and prune. One observer over both grids cannot
   fall out of step with either.  */
(function () {
  var grids = ['recentRailGrid', 'favShelfGrid']
    .map(function (id) { return document.getElementById(id); })
    .filter(Boolean);
  if (!grids.length) return;

  function measure() {
    grids.forEach(function (g) {
      var over = g.scrollWidth - g.clientWidth > 4;
      g.classList.toggle('is-scrollable', over);
      /* Both classes from one measurement, so they can never disagree; a
         favorites re-render resets scrollLeft and this clears the fade. */
      g.classList.toggle('is-scrolled', over && g.scrollLeft > 2);
    });
  }

  measure();
  window.addEventListener('resize', measure);
  if ('ResizeObserver' in window) {
    var ro = new ResizeObserver(measure);
    grids.forEach(function (g) { ro.observe(g); });
  }
  /* Cards arriving or leaving changes the answer, and favorites does both. */
  var mo = new MutationObserver(measure);
  grids.forEach(function (g) { mo.observe(g, { childList: true }); });

  /* The leading fade and the lit column edge are scroll states (.is-scrolled),
     toggled here rather than styled per frame: the mask must only ever swap
     between discrete class states or it re-rasterizes continuously. */
  grids.forEach(function (g) {
    var raf = null;
    g.addEventListener('scroll', function () {
      if (raf) return;
      raf = requestAnimationFrame(function () {
        raf = null;
        g.classList.toggle('is-scrolled',
          g.classList.contains('is-scrollable') && g.scrollLeft > 2);
      });
    }, { passive: true });
  });
})();
