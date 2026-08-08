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

  /* Real tools only: external destinations and locked ghost cards are not
     "shipped tools" and would push genuine releases out of the rail. */
  var candidates = Array.from(
    document.querySelectorAll('#tools .site-card[data-card-id][data-added]')
  ).filter(function (card) {
    return !card.classList.contains('external-card') &&
           !card.classList.contains('ghost-card');
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
    var echo = c.el.cloneNode(true);

    /* Hand the clone a different key so the catalog modules skip it. */
    echo.removeAttribute('data-card-id');
    echo.setAttribute('data-echo-id', c.el.dataset.cardId);
    echo.classList.add('site-card--echo');

    /* Badges are stamped before cloning, so the echo inherits one — but every
       card in a shelf headed "Recently shipped" is new by definition, and the
       stamp below already says when. Drop it rather than labelling the obvious. */
    var inherited = echo.querySelector('.card-new-badge');
    if (inherited) inherited.remove();

    /* A multi-tool card opens a popup wired by cards.js against
       data-card-id. Without that hook the clone would be a dead <div>, so
       point the echo at the tool's domain and let it behave like a link. */
    if (echo.classList.contains('multi-tool')) {
      var popup = echo.querySelector('.card-subtool-popup');
      if (popup) popup.remove();
      var first = c.el.querySelector('.card-subtool-popup a[href]');
      var domain = (c.el.querySelector('.card-domain') || {}).textContent || '';
      var href = first ? first.getAttribute('href')
                       : 'https://' + domain.trim();
      var link = document.createElement('a');
      link.className = echo.className;
      link.setAttribute('href', href);
      link.setAttribute('data-echo-id', c.el.dataset.cardId);
      link.style.cssText = echo.style.cssText;
      link.innerHTML = echo.innerHTML;
      link.classList.remove('multi-tool');
      echo = link;
    }

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
