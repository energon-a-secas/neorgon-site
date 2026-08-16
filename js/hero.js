(function () {
  const el = document.getElementById('heroTyping');
  const cursor = document.getElementById('typingCursor');
  if (!el) return;

  /* The heading reads "Made to fit ___". Every completion has to finish that
     sentence and land on the same idea from a different side: one job, cut to
     size, and never called done. */
  const words = [
    'the exact problem',
    'one job, exactly',
    'the way you work',
    'what you asked for',
  ];
  const text = words[Math.floor(Math.random() * words.length)];
  let i = 0;

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    el.textContent = text;
    if (cursor) cursor.remove();
    return;
  }

  function type() {
    if (i <= text.length) {
      el.textContent = text.slice(0, i);
      i++;
      setTimeout(type, 85 + Math.random() * 45);
    } else {
      setTimeout(() => { if (cursor) cursor.style.display = 'none'; }, 2000);
    }
  }

  setTimeout(type, 50);
})();


(function () {
  const el = document.getElementById('badgeText');
  if (!el) return;
  /* What the badge is for: the terms of use, in four words, on rotation. Free,
     local, one job each, never finished — the same four claims the hero makes,
     said in turn so none of them has to crowd the heading. */
  const phrases = [
    'Free \u00b7 Local \u00b7 No account',
    'One job each \u00b7 No suites',
    'Sharpened, then sharpened again',
    'Your data never leaves the tab',
    'Replaces a subscription \u00b7 Costs nothing',
    'Nothing phones home',
    'Cut to fit \u00b7 Not licensed',
    'Still being improved',
  ];
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  let idx = 0;
  setInterval(function () {
    el.style.opacity = '0';
    setTimeout(function () {
      idx = (idx + 1) % phrases.length;
      el.textContent = phrases[idx];
      el.style.opacity = '1';
    }, 400);
  }, 5000);
})();


/* ── Scroll cue ───────────────────────────────────────────────────────────────
   The hero fills the fold almost exactly, so nothing on a first screen said a
   catalog existed underneath it. The cue points, and then gets out of the way:
   one scroll of any size retires it permanently. It does not come back on the
   way up, because by then the reader has seen what it was advertising.

   Clicking it jumps to the first section below the hero rather than to a fixed
   offset — the favorites shelf, the rail and the catalog take turns being that
   section depending on what the visitor has saved. */
(function () {
  var cue = document.getElementById('scrollCue');
  if (!cue) return;

  function nextSection() {
    var candidates = ['#favShelf', '#recentRail', '#catRail', '#tools'];
    for (var i = 0; i < candidates.length; i++) {
      var el = document.querySelector(candidates[i]);
      if (el && !el.hidden && el.offsetParent !== null) return el;
    }
    return null;
  }

  function retire() {
    cue.classList.add('is-gone');
    window.removeEventListener('scroll', onScroll);
  }

  function onScroll() {
    if (window.scrollY > 60) retire();
  }

  cue.addEventListener('click', function () {
    var target = nextSection();
    retire();
    if (!target) return;
    target.scrollIntoView({
      block: 'start',
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
        ? 'auto' : 'smooth'
    });
  });

  window.addEventListener('scroll', onScroll, { passive: true });
  /* A reload restores scroll position before this runs. */
  onScroll();
})();
