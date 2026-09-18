/* ── Tag row: one line at rest, the rest on demand ─────────────────────────
   A card's tag row is 314px wide and the wordiest sets already fill 94% of
   it, so a fourth tag wraps almost every card in the grid and the catalog
   grows a row of ragged two-line cards. The vocabulary is worth more than
   that: tags feed `scoreCard` in search.js at the `tagWord` tier, above a
   loose name match, so a tag is the strongest declaration we have of what a
   tool is about. This module lets a card carry as many as it deserves and
   show one line of them.

   THE CLIPPING IS VISUAL ONLY, and that is the whole design. Nothing is
   removed from the DOM and nothing is `display: none`, so:

     - search.js indexes every tag, hidden or not. It reads
       `querySelectorAll('.card-tag')`, which does not care what is painted.
     - a screen reader reads every tag, because overflow is a paint-time
       concern and the accessible tree is not clipped.

   Which is what makes the `+N` chip safe to leave out of the tab order, the
   same call `cards.js` makes for `.card-arrow`: it reveals nothing that
   assistive technology could not already read, so a tab stop on each of 73
   cards would buy an ability nobody lacks. A tag is likewise not focusable.
   Clicking one searches it, and the keyboard path to that is the search box
   the query lands in anyway.

   Which tags are hidden is MEASURED, never counted from the markup. The
   answer depends on the rendered width of the words, the card, and the
   viewport, so authoring `data-extra` on the fourth tag would be right at
   one width and wrong at every other.
   ───────────────────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  var ROWS = '.site-card .card-tags';
  var DEBOUNCE = 120;

  function tagsIn(row) {
    return Array.prototype.slice.call(row.querySelectorAll('.card-tag'));
  }

  /* How many tags sit below the first line. The row is the offsetParent (CSS
     gives it `position: relative`), so these tops are row-relative and the
     comparison holds wherever the card has been reparented to. */
  function hiddenCount(tags) {
    var top = tags[0].offsetTop;
    var n = 0;
    for (var i = 1; i < tags.length; i += 1) if (tags[i].offsetTop > top) n += 1;
    return n;
  }

  function chipFor(row) {
    var chip = row.querySelector('.card-tag-more');
    if (chip) return chip;
    chip = document.createElement('span');
    chip.className = 'card-tag-more';
    /* Pointer-only by design, see the header. `aria-hidden` keeps it from
       being announced as a control that does nothing for a reader who can
       already read the tags it would reveal. */
    chip.setAttribute('aria-hidden', 'true');
    row.appendChild(chip);
    return chip;
  }

  /* One row, measured twice, and the ORDER of the two is the whole thing.
     The first pass runs with no gutter reserved, because the chip is 46px
     wide and the wordiest rows already fill 94% of their 314px: reserving
     first makes the chip the cause of the overflow it then reports, and the
     row settles at a self-consistent but strictly worse answer. Measured, the
     gutter-first order clipped 16 of 73 rows, 14 of which had been showing
     every tag they had on one line. A card that fits three tags must keep
     showing three, not two and a `+1`.

     So: overflow with no chip is the only thing that earns a chip. Once one
     is earned the gutter goes in and the count is re-measured, since the
     chip's own width can push a further tag down, and that tag is genuinely
     hidden. */
  function layout(row) {
    var tags = tagsIn(row);
    if (tags.length < 2) return;

    var wasOpen = row.classList.contains('is-open');
    row.classList.remove('is-open', 'has-gutter', 'is-clipped');
    row.style.removeProperty('max-height');

    if (!hiddenCount(tags)) {
      var stale = row.querySelector('.card-tag-more');
      if (stale) stale.remove();
      return;
    }

    row.classList.add('has-gutter');
    var hidden = hiddenCount(tags);
    /* One line is the height of a tag, not a guess at the font's line box. */
    row.style.setProperty('--tag-line-h', tags[0].offsetHeight + 'px');
    row.classList.add('is-clipped');
    var chip = chipFor(row);
    chip.dataset.more = String(hidden);
    chip.textContent = '+' + hidden;
    if (wasOpen) open(row);
  }

  function open(row) {
    row.classList.add('is-open');
    var chip = row.querySelector('.card-tag-more');
    if (chip) chip.textContent = 'less';
  }

  function close(row) {
    row.classList.remove('is-open');
    var chip = row.querySelector('.card-tag-more');
    if (chip) chip.textContent = '+' + (chip.dataset.more || '');
  }

  function layoutAll() {
    Array.prototype.forEach.call(document.querySelectorAll(ROWS), layout);
  }

  /* ── Clicking a tag searches it ─────────────────────────────────────────
     Capture phase for the reason cards.js gives: a card is an `<a>` and the
     multi-tool popup binds on the card itself, so a bubbling delegate would
     run after the navigation or the popup had already happened. */
  function runSearch(text) {
    var input = document.getElementById('heroSearch');
    if (!input) return;
    input.value = text;
    /* The public path into search.js. Its own `input` listener calls
       doFilter(), which is private to that IIFE; reaching past the event
       would mean exporting the filter just for this caller. */
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.focus();
  }

  document.addEventListener('click', function (e) {
    if (!e.target.closest) return;
    if (e.ctrlKey || e.metaKey || e.shiftKey || e.button !== 0) return;

    var chip = e.target.closest('.card-tag-more');
    if (chip) {
      var row = chip.closest('.card-tags');
      e.preventDefault();
      e.stopPropagation();
      if (row.classList.contains('is-open')) close(row); else open(row);
      if (window._neoSoundPing) window._neoSoundPing(520, 0.01);
      return;
    }

    var tag = e.target.closest('.card-tag');
    if (!tag) return;
    var text = tag.textContent.trim();
    if (!text) return;
    e.preventDefault();
    e.stopPropagation();
    runSearch(text);
  }, true);

  /* ── When to re-measure ────────────────────────────────────────────────
     Width changes the answer, and so does search.js reparenting matched
     cards into `#catalogSearchMerged`, which is a different grid at a
     different column count. The MutationObserver catches the second without
     this module having to know the first module exists. */
  var pending = 0;
  function schedule() {
    clearTimeout(pending);
    pending = setTimeout(layoutAll, DEBOUNCE);
  }

  function init() {
    layoutAll();
    window.addEventListener('resize', schedule);
    var tools = document.getElementById('tools');
    if (tools && window.MutationObserver) {
      new MutationObserver(schedule).observe(tools, { childList: true, subtree: true });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      requestAnimationFrame(init);
    });
  } else {
    requestAnimationFrame(init);
  }

  window._neoTags = {
    refresh: layoutAll,
    /* What the row decided, for the terminal and for a check that does not
       want to reimplement the measurement. */
    state: function (cardId) {
      var card = document.querySelector('.site-card[data-card-id="' + cardId + '"]');
      var row = card && card.querySelector('.card-tags');
      if (!row) return null;
      var chip = row.querySelector('.card-tag-more');
      return {
        tags: tagsIn(row).map(function (t) { return t.textContent.trim(); }),
        clipped: row.classList.contains('is-clipped'),
        hidden: chip ? Number(chip.dataset.more) || 0 : 0,
        open: row.classList.contains('is-open')
      };
    }
  };
})();
