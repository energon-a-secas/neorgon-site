/* ── Command palette ──────────────────────────────────────────────────────────
   Cmd/Ctrl+K opens a fuzzy launcher over every tool. The hero search filters the
   page in place, which is the right behaviour for browsing but wrong when you
   already know where you are going — this is the "just take me there" path.

   Matches the pattern questline and agentlore already use, so the muscle memory
   carries across the fleet. Indexes the DOM, so new cards need no registration.
─────────────────────────────────────────────────────────────────────────────── */
(function () {
  var overlay = document.getElementById('paletteOverlay');
  var input = document.getElementById('paletteInput');
  var list = document.getElementById('paletteList');
  var empty = document.getElementById('paletteEmpty');
  if (!overlay || !input || !list) return;

  var items = [];
  var results = [];
  var active = 0;

  /* ── Index ──────────────────────────────────────────────────────────────── */
  function buildIndex() {
    items = Array.from(document.querySelectorAll('#tools .site-card[data-card-id]'))
      .filter(function (card) { return !card.classList.contains('ghost-card'); })
      .map(function (card) {
        var name = ((card.querySelector('.card-name') || {}).textContent || '').trim();
        var desc = ((card.querySelector('.card-desc') || {}).textContent || '').trim();
        var domain = ((card.querySelector('.card-domain') || {}).textContent || '').trim();
        var tags = Array.from(card.querySelectorAll('.card-tag')).map(function (t) {
          return t.textContent.trim();
        });
        var group = card.closest('.card-group');
        var groupLabel = group
          ? ((group.querySelector('.group-label') || {}).textContent || '').trim() : '';

        /* Multi-tool cards are not links; fall back to their domain. */
        var href = card.getAttribute('href');
        if (!href) {
          var sub = card.querySelector('.card-subtool-popup a[href]');
          href = sub ? sub.getAttribute('href') : 'https://' + domain;
        }

        return {
          id: card.dataset.cardId,
          name: name,
          desc: desc,
          domain: domain,
          group: groupLabel,
          added: card.dataset.added || '',
          external: card.classList.contains('external-card'),
          /* Findable, but not somewhere the palette can send you — Enter on a
             Soon tool scrolls to its card instead of opening a reserved domain
             that serves nothing. A blank query sorts it last on its own, since
             the recency tie-break reads `added` and a Soon card has none. */
          soon: card.dataset.status === 'soon',
          el: card,
          href: href,
          haystack: (name + ' ' + desc + ' ' + domain + ' ' + tags.join(' ') + ' ' + groupLabel).toLowerCase()
        };
      });
  }

  /* ── Scoring ────────────────────────────────────────────────────────────
     Cheap subsequence match. Exact prefix on the name beats a word-boundary
     hit, which beats a scattered subsequence — so typing "st" surfaces "Stash"
     above a tool that merely mentions "consistent" in its description. */
  function score(item, q) {
    if (!q) return 1;
    var name = item.name.toLowerCase();
    if (name === q) return 1000;
    if (name.indexOf(q) === 0) return 900 - name.length;
    if (item.domain.toLowerCase().indexOf(q) === 0) return 850;

    var wordStart = new RegExp('\\b' + q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    if (wordStart.test(name)) return 700 - name.length;
    if (name.indexOf(q) !== -1) return 600 - name.length;
    if (wordStart.test(item.haystack)) return 400;
    if (item.haystack.indexOf(q) !== -1) return 300;

    /* Subsequence over the name: "gbx" → "GlassBox". */
    var qi = 0;
    for (var i = 0; i < name.length && qi < q.length; i++) {
      if (name[i] === q[qi]) qi++;
    }
    if (qi === q.length) return 200 - name.length;

    return 0;
  }

  function search(q) {
    q = q.trim().toLowerCase();
    var scored = items.map(function (it) {
      return { it: it, s: score(it, q) };
    }).filter(function (x) { return x.s > 0; });

    scored.sort(function (a, b) {
      if (b.s !== a.s) return b.s - a.s;
      /* Tie-break on recency so a blank palette leads with the newest tools. */
      return (b.it.added || '').localeCompare(a.it.added || '');
    });

    return scored.slice(0, 40).map(function (x) { return x.it; });
  }

  /* ── Render ─────────────────────────────────────────────────────────────── */
  function highlight(text, q) {
    var frag = document.createDocumentFragment();
    if (!q) { frag.appendChild(document.createTextNode(text)); return frag; }
    var i = text.toLowerCase().indexOf(q.toLowerCase());
    if (i === -1) { frag.appendChild(document.createTextNode(text)); return frag; }
    frag.appendChild(document.createTextNode(text.slice(0, i)));
    var mark = document.createElement('mark');
    mark.className = 'pal-mark';
    mark.textContent = text.slice(i, i + q.length);
    frag.appendChild(mark);
    frag.appendChild(document.createTextNode(text.slice(i + q.length)));
    return frag;
  }

  function render() {
    var q = input.value.trim();
    list.textContent = '';

    results.forEach(function (it, i) {
      var row = document.createElement('li');
      row.className = 'pal-item' + (i === active ? ' active' : '');
      row.id = 'pal-item-' + i;
      row.setAttribute('role', 'option');
      row.setAttribute('aria-selected', i === active ? 'true' : 'false');

      var main = document.createElement('span');
      main.className = 'pal-item-main';

      var nm = document.createElement('span');
      nm.className = 'pal-item-name';
      nm.appendChild(highlight(it.name, q));
      main.appendChild(nm);

      if (it.group) {
        var grp = document.createElement('span');
        grp.className = 'pal-item-group';
        grp.textContent = it.group;
        main.appendChild(grp);
      }

      if (it.soon) {
        var soon = document.createElement('span');
        soon.className = 'pal-item-soon';
        soon.textContent = 'Soon';
        main.appendChild(soon);
      }

      var dom = document.createElement('span');
      dom.className = 'pal-item-domain';
      dom.textContent = it.domain;

      row.appendChild(main);
      row.appendChild(dom);

      row.addEventListener('click', function () { open(i); });
      row.addEventListener('mousemove', function () {
        if (active !== i) { active = i; paint(); }
      });

      list.appendChild(row);
    });

    if (empty) empty.classList.toggle('show', results.length === 0);
    syncActiveDescendant();
  }

  /* Repaint selection only — avoids rebuilding rows on every arrow key. */
  function paint() {
    Array.from(list.children).forEach(function (row, i) {
      var on = i === active;
      row.classList.toggle('active', on);
      row.setAttribute('aria-selected', on ? 'true' : 'false');
      if (on) row.scrollIntoView({ block: 'nearest' });
    });
    syncActiveDescendant();
  }

  function syncActiveDescendant() {
    if (results.length) input.setAttribute('aria-activedescendant', 'pal-item-' + active);
    else input.removeAttribute('aria-activedescendant');
  }

  function open(i) {
    var it = results[i];
    if (!it) return;
    close();
    /* Nothing is served at a Soon tool's domain, so "take me there" becomes
       "show me where it will be" — the card, in its category, with its badge. */
    if (it.soon) {
      if (it.el) it.el.scrollIntoView({ block: 'center', behavior: 'smooth' });
      return;
    }
    if (it.external) window.open(it.href, '_blank', 'noopener');
    else window.location.href = it.href;
  }

  /* ── Open / close ───────────────────────────────────────────────────────── */
  var lastFocus = null;

  function openPalette() {
    buildIndex();
    lastFocus = document.activeElement;
    overlay.classList.add('open');
    overlay.removeAttribute('hidden');
    document.body.classList.add('palette-open');
    input.value = '';
    active = 0;
    results = search('');
    render();
    setTimeout(function () { input.focus(); }, 20);
    if (window._neoSound && window._neoSound.termOpen) window._neoSound.termOpen();
  }

  function close() {
    overlay.classList.remove('open');
    document.body.classList.remove('palette-open');
    /* Wait out the fade before hiding from AT, so the transition still runs. */
    setTimeout(function () {
      if (!overlay.classList.contains('open')) overlay.setAttribute('hidden', '');
    }, 200);
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  function isOpen() { return overlay.classList.contains('open'); }

  input.addEventListener('input', function () {
    results = search(input.value);
    active = 0;
    render();
  });

  input.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (results.length) { active = (active + 1) % results.length; paint(); }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (results.length) { active = (active - 1 + results.length) % results.length; paint(); }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      open(active);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      close();
    } else if (e.key === 'Tab') {
      /* Only the input is focusable inside; keep focus trapped. */
      e.preventDefault();
    }
  });

  overlay.addEventListener('click', function (e) {
    if (e.target === overlay) close();
  });

  document.addEventListener('keydown', function (e) {
    if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
      e.preventDefault();
      if (isOpen()) close(); else openPalette();
      return;
    }
    /* Esc closes from anywhere — but let the terminal own Esc when it is up,
       since terminal.js uses a double-Esc to open and would otherwise fight. */
    if (e.key === 'Escape' && isOpen()) {
      e.preventDefault();
      close();
    }
  });

  window._neoPalette = { open: openPalette, close: close };
})();
