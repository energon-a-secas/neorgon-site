/* ── Category rail ────────────────────────────────────────────────────────────
   A sticky jump-nav over the catalog. 12 categories and 50 cards previously had
   no navigation at all: finding "Health" meant scrolling past everything else
   and hoping to recognise the label on the way past.

   Built from the DOM rather than a hardcoded list, so a new `.card-group` shows
   up here automatically. Counts come from the cards actually present, which
   keeps the rail honest when the terminal's `ghost` command hides one.
─────────────────────────────────────────────────────────────────────────────── */
(function () {
  var rail = document.getElementById('catRail');
  var inner = document.getElementById('catRailInner');
  if (!rail || !inner) return;

  var groups = Array.from(
    document.querySelectorAll('#tools > .card-group:not(#catalogSearchMerged)')
  ).filter(function (g) {
    /* A chip pointing at an empty section is worse than no chip. */
    return g.querySelectorAll('.site-card[data-card-id]').length > 0;
  });

  if (groups.length < 2) return;

  var chips = [];

  groups.forEach(function (group) {
    var labelEl = group.querySelector('.group-label');
    if (!labelEl || !group.id) return;

    /* .group-label contains a decorative dot span — take text only. */
    var label = (labelEl.textContent || '').trim();
    var count = group.querySelectorAll('.site-card[data-card-id]').length;
    var color = group.style.getPropertyValue('--group-color').trim();

    var chip = document.createElement('a');
    chip.className = 'cat-chip';
    chip.href = '#' + group.id;
    if (color) chip.style.setProperty('--chip-color', color);

    var dot = document.createElement('span');
    dot.className = 'cat-chip-dot';
    dot.setAttribute('aria-hidden', 'true');

    var text = document.createElement('span');
    text.className = 'cat-chip-label';
    text.textContent = label;

    var num = document.createElement('span');
    num.className = 'cat-chip-count';
    num.textContent = count;

    chip.appendChild(dot);
    chip.appendChild(text);
    chip.appendChild(num);
    inner.appendChild(chip);

    chips.push({ el: chip, group: group });
  });

  if (!chips.length) return;
  rail.hidden = false;

  /* ── Anchor offset ───────────────────────────────────────────────────────
     Three different things scroll to a group: a chip click, the terminal's
     `open <cat>`, and the browser's own `#group-health` fragment jump. All
     three have to clear the sticky header and rail or the heading you asked
     for lands underneath them.

     `scroll-margin-top` is the only offset the *browser's* jump also honours,
     which is why it is used here instead of arithmetic. Chrome re-applies a
     fragment scroll every time layout shifts while the page is still loading,
     so a JS correction — even re-fired on a timer and on `load` — gets silently
     overwritten by the native jump and the group ends up back at y=0. A
     declared margin means every re-application already lands correctly.

     The value comes from JS rather than CSS because it depends on the live rail
     height, which changes when the chips wrap on narrow screens. */
  /* Where a jump parks a group's top edge. Everything that needs to know about
     the sticky chrome derives from this one function — the anchor offset, the
     rail's own sticky `top`, and the scroll-spy's reading line. When these were
     computed separately they disagreed by 8px on mobile, which was enough for a
     freshly-jumped-to group to sit just *below* the reading line and hand the
     highlight to the section above it. */
  function anchorOffset() {
    var header = document.querySelector('.header-bar');
    return rail.offsetHeight + (header ? header.offsetHeight : 0) + 16;
  }

  function syncAnchorOffset() {
    var header = document.querySelector('.header-bar');
    var headerH = header ? header.offsetHeight : 0;
    /* The rail's own sticky `top` also depends on the header height, and CSS
       cannot read it — a hardcoded 62px left 12px of the rail underneath the
       68px header. Set it here so both offsets come from one measurement. */
    document.documentElement.style.setProperty('--cat-rail-top', headerH + 'px');
    var offset = anchorOffset();
    groups.forEach(function (g) { g.style.scrollMarginTop = offset + 'px'; });
  }
  syncAnchorOffset();
  window.addEventListener('resize', syncAnchorOffset);

  function scrollToGroup(group) {
    group.scrollIntoView({
      block: 'start',
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
        ? 'auto' : 'smooth'
    });
  }

  chips.forEach(function (c) {
    c.el.addEventListener('click', function (e) {
      e.preventDefault();
      scrollToGroup(c.group);
      if (window._neoSoundPing) window._neoSoundPing(880, 0.02);
      /* Update the hash without letting the browser do its own jump. */
      if (history.replaceState) history.replaceState(null, '', '#' + c.group.id);
    });
  });

  /* ── Scroll-spy ─────────────────────────────────────────────────────────
     Tracks which group occupies the reading position. rootMargin pulls the
     detection band down past the sticky chrome so a group counts as "current"
     when it is under the rail, not when it first touches the viewport edge. */
  var current = null;

  function setActive(group) {
    if (group === current) return;
    current = group;
    chips.forEach(function (c) {
      var on = c.group === group;
      c.el.classList.toggle('active', on);
      if (on) {
        c.el.setAttribute('aria-current', 'true');
        /* Keep the active chip in view when the rail scrolls horizontally. */
        var cr = c.el.getBoundingClientRect();
        var ir = inner.getBoundingClientRect();
        if (cr.left < ir.left || cr.right > ir.right) {
          inner.scrollTo({
            left: c.el.offsetLeft - inner.clientWidth / 2 + c.el.offsetWidth / 2,
            behavior: 'smooth'
          });
        }
      } else {
        c.el.removeAttribute('aria-current');
      }
    });
  }

  /* Resolved from geometry, not from which groups intersect. "Topmost group
     still touching the band" sounds right and is wrong: after jumping to a
     section, the *previous* group's tail still occupies the top of the band and
     wins, so `open health` highlighted Lifehacks. The group that has most
     recently passed the reading line is the one you are looking at.

     The line sits a few px *below* where a jump parks the heading, so the group
     you just jumped to counts as passed rather than as still-approaching. */
  var readingLine = function () {
    return anchorOffset() + 8;
  };

  function resolveActive() {
    var line = readingLine();
    var pick = groups[0];
    groups.forEach(function (g) {
      if (g.getBoundingClientRect().top <= line) pick = g;
    });

    /* At the very bottom of the page the reading line stops being reachable:
       the last group's heading can only rise as far as the remaining scroll
       allows, so a short final section — Platforms is one row of cards above the
       footer — never crosses the line and its chip never lit, no matter how far
       you scrolled. When scrolling has bottomed out, the last group *is* what
       you are looking at. */
    var atBottom = window.innerHeight + window.scrollY >=
                   document.documentElement.scrollHeight - 2;
    if (atBottom) pick = groups[groups.length - 1];

    setActive(pick);
  }

  var spyQueued = false;
  function queueResolve() {
    if (spyQueued) return;
    spyQueued = true;
    requestAnimationFrame(function () { spyQueued = false; resolveActive(); });
  }

  /* IntersectionObserver only wakes the resolver — cheaper than a bare scroll
     listener while the catalog is off-screen. The scroll listener covers the
     movement *within* one long group, where no boundary is crossed. */
  if ('IntersectionObserver' in window) {
    var observer = new IntersectionObserver(queueResolve, {
      rootMargin: '-80px 0px -40% 0px',
      threshold: [0, 0.01, 0.25]
    });
    groups.forEach(function (g) { observer.observe(g); });
  }
  window.addEventListener('scroll', queueResolve, { passive: true });
  window.addEventListener('resize', queueResolve);
  queueResolve();

  /* Searching flattens the catalog into one merged grid, so section chips point
     at hidden groups and the rail is meaningless — hide it while filtering. */
  var bodyObserver = new MutationObserver(function () {
    rail.classList.toggle(
      'cat-rail--suppressed',
      document.body.classList.contains('search-active')
    );
  });
  bodyObserver.observe(document.body, { attributes: true, attributeFilter: ['class'] });

  /* ── Deep links ─────────────────────────────────────────────────────────
     `scroll-margin-top` above fixes the offset for the native jump, but the
     rail is `hidden` until this script runs, so a jump that fired before then
     was measured against a page 62px shorter. Re-assert the position once the
     rail exists and once images have settled, then light the right chip.
     Instant, not smooth: this is where the page should already have been. */
  if (location.hash) {
    var target = groups.filter(function (g) { return '#' + g.id === location.hash; })[0];
    if (target) {
      var settle = function () {
        target.scrollIntoView({ block: 'start', behavior: 'auto' });
        queueResolve();
      };
      settle();
      window.addEventListener('load', settle);
    }
  }
})();
