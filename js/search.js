(function () {
  const input = document.getElementById('heroSearch');
  const clearBtn = document.getElementById('searchClear');
  const countEl = document.getElementById('searchCount');
  const noResults = document.getElementById('searchNoResults');
  const box = document.getElementById('constellationBox');
  const canvas = document.getElementById('constellationCanvas');
  if (!input || !box || !canvas) return;
  const ctx = canvas.getContext('2d');

  const allGroups = Array.from(document.querySelectorAll('.card-group'));
  const cards = Array.from(document.querySelectorAll('.site-card[data-card-id]'));
  const ghost = cards.filter(c => c.classList.contains('ghost-card')).map(c => c.dataset.cardId);

  /* Build searchable index */
  const index = cards.map(card => {
    const name = (card.querySelector('.card-name') || {}).textContent || '';
    const desc = (card.querySelector('.card-desc') || {}).textContent || '';
    const domain = (card.querySelector('.card-domain') || {}).textContent || '';
    const tags = Array.from(card.querySelectorAll('.card-tag')).map(t => t.textContent);
    return {
      el: card,
      id: card.dataset.cardId,
      text: [name, desc, domain, ...tags].join(' ').toLowerCase(),
      tags: tags
    };
  });

  /* ── Curated categories ─────────────────────────────────────── */
  const CATEGORIES = [
    { label: 'Planning',      color: '#4ade80', ids: ['pathfinder','skillmap'], keywords: 'planning visual canvas export learning roadmap pathfinder skill map strategy' },
    { label: 'DevOps',        color: '#fbbf24', ids: ['infradrills','snippets','lockdown'], keywords: 'devops challenges cli cheatsheet search aws kubernetes docker k8s shell infra drills snippets security hardening lockdown guides' },
    { label: 'Data',          color: '#2dd4bf', ids: ['jsonstudio','references'], keywords: 'data editor privacy api search json reference matrix scrambler viewer' },
    { label: 'Productivity',  color: '#a78bfa', ids: ['slides','ogstudio'], keywords: 'productivity slides export audit presentation sage yaml pptx marp og preview design generator studio' },
    { label: 'Fun',           color: '#f472b6', ids: ['decisionwheel','memes','clientsays','emojis','guildhall','youtube'], keywords: 'fun randomizer community upload wheel spin memes timezone translator jargon client says decoded emoji archive search guild hall quests monster hunter gamified teams youtube video overflow' },
    { label: 'Social',        color: '#38bdf8', ids: ['vibecheck','charactersheet','parla'], keywords: 'social interviews scoring vibe check behavioral personality export character sheet know parla slang latin american regional language' },
    { label: 'Lifehacks',     color: '#f59e0b', ids: ['buyhacks'], keywords: 'lifehacks community reviews buyhacks buy hacks products shopping' },
    { label: 'Platforms',     color: '#64748b', ids: ['github','gitlab','dockerhub'], keywords: 'platforms github gitlab docker hub containers images repos code open source private ci cd pipelines' },
    { label: 'Game',          color: '#e879f9', ids: ['rushq'], keywords: 'game strategy rush q cards corporate' },
  ];

  /* ── Floating pills (physics) ───────────────────────────────── */
  var W = 0, H = 0;
  var pills = [];

  var canvasPad = 30; /* extra canvas bleed on each side */
  function resizeCanvas() {
    var rect = box.getBoundingClientRect();
    W = rect.width;
    H = rect.height;
    canvas.width = (W + canvasPad * 2) * devicePixelRatio;
    canvas.height = (H + canvasPad * 2) * devicePixelRatio;
    ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
    ctx.translate(canvasPad, canvasPad);
  }

  function randomPositions(count, w, h, minDist) {
    var padX = 50, padY = 22;
    var positions = [];
    for (var i = 0; i < count; i++) {
      var attempts = 0;
      var cx, cy, ok;
      do {
        cx = padX + Math.random() * (w - padX * 2);
        cy = padY + Math.random() * (h - padY * 2);
        ok = true;
        for (var j = 0; j < positions.length; j++) {
          var dx = cx - positions[j][0], dy = cy - positions[j][1];
          if (Math.sqrt(dx * dx + dy * dy) < minDist) { ok = false; break; }
        }
        attempts++;
      } while (!ok && attempts < 200);
      positions.push([cx, cy]);
    }
    return positions;
  }

  function createPills() {
    pills.forEach(p => p.el.remove());
    pills = [];
    var positions = randomPositions(CATEGORIES.length, W, H, 80);

    CATEGORIES.forEach(function (cat, i) {
      var el = document.createElement('button');
      el.className = 'tag-pill';
      el.textContent = cat.label;
      el.style.color = cat.color;
      el.style.setProperty('--pill-color', cat.color + '80');
      el.style.borderColor = 'color-mix(in srgb, ' + cat.color + ' 35%, transparent)';
      el.style.background = 'color-mix(in srgb, ' + cat.color + ' 8%, transparent)';
      box.appendChild(el);

      var cx = positions[i][0];
      var cy = positions[i][1];

      var pill = {
        el: el,
        cat: cat,
        x: cx, y: cy,
        homeX: cx, homeY: cy,
        vx: (Math.random() - 0.5) * 0.1,
        vy: (Math.random() - 0.5) * 0.08,
        matched: false,
        repelled: false
      };

      el.addEventListener('click', function () {
        var current = input.value.trim();
        var toggling = current.toLowerCase() === cat.label.toLowerCase();

        /* Planet zoom — animate scale via the physics-applied transform */
        el.classList.add('planet-zoom');
        pill._zoomScale = 1;
        var zoomStart = performance.now();
        var zoomDuration = 450;
        function animateZoom(now) {
          var t = Math.min(1, (now - zoomStart) / zoomDuration);
          /* Bell curve: 0→1→0 via sin, peak scale 1.4 at t=0.5 */
          pill._zoomScale = 1 + 0.4 * Math.sin(t * Math.PI);
          if (t < 1) requestAnimationFrame(animateZoom);
          else pill._zoomScale = 1;
        }
        requestAnimationFrame(animateZoom);

        /* Push other pills away gently */
        pills.forEach(function (other) {
          if (other === pill) return;
          var dx = other.x - pill.x;
          var dy = other.y - pill.y;
          var dist = Math.sqrt(dx * dx + dy * dy) || 1;
          other.vx += (dx / dist) * 2;
          other.vy += (dy / dist) * 1.5;
        });

        setTimeout(function () {
          el.classList.remove('planet-zoom');
          if (toggling) {
            input.value = '';
          } else {
            input.value = cat.label;
          }
          doFilter();
          input.focus();
        }, 400);
      });

      pills.push(pill);
    });
  }

  /* ── Connections between pills sharing cards ────────────────── */
  var connections = [];
  function buildConnections() {
    connections = [];
    for (var i = 0; i < CATEGORIES.length; i++) {
      for (var j = i + 1; j < CATEGORIES.length; j++) {
        /* Connect if they share keywords in common card descriptions */
        var shared = CATEGORIES[i].ids.some(function (id) {
          var card = index.find(function (c) { return c.id === id; });
          if (!card) return false;
          return CATEGORIES[j].keywords.split(' ').some(function (kw) {
            return card.text.includes(kw);
          });
        });
        if (shared) connections.push([i, j]);
      }
    }
    /* Also connect neighbors for visual density */
    for (var i = 0; i < CATEGORIES.length - 1; i++) {
      var pair = [i, i + 1];
      if (!connections.some(function (c) { return c[0] === pair[0] && c[1] === pair[1]; })) {
        connections.push(pair);
      }
    }
    /* Wrap last to first */
    connections.push([0, CATEGORIES.length - 1]);
  }

  /* ── Physics tick ───────────────────────────────────────────── */
  var centerX = 0, centerY = 0;
  var isFiltering = false;

  function tick() {
    centerX = W / 2;
    centerY = H / 2;

    pills.forEach(function (p, i) {
      if (isFiltering) {
        if (p.matched) {
          /* Attract to center */
          var dx = centerX - p.x;
          var dy = centerY - p.y;
          p.vx += dx * 0.003;
          p.vy += dy * 0.003;
        } else {
          /* Drift to assigned peripheral orbit position, not the wall */
          if (!p._orbitX) {
            var angle = (i / pills.length) * Math.PI * 2 + Math.random() * 0.5;
            var rx = W * 0.38 + Math.random() * W * 0.08;
            var ry = H * 0.35 + Math.random() * H * 0.08;
            p._orbitX = centerX + Math.cos(angle) * rx;
            p._orbitY = centerY + Math.sin(angle) * ry;
          }
          var dx = p._orbitX - p.x;
          var dy = p._orbitY - p.y;
          p.vx += dx * 0.008;
          p.vy += dy * 0.008;
          /* Keep a gentle drift even while filtered out */
          if (!p._wobblePhase) p._wobblePhase = Math.random() * Math.PI * 2;
          p._wobblePhase += 0.01;
          p.vx += Math.sin(p._wobblePhase) * 0.015;
          p.vy += Math.cos(p._wobblePhase * 0.7) * 0.01;
        }
      } else {
        p._orbitX = 0; p._orbitY = 0; /* Reset orbit targets */
        /* Drift toward home — stronger spring while returning, gentle at rest */
        var dx = p.homeX - p.x;
        var dy = p.homeY - p.y;
        var k = 0.008;
        if (p._returning > 0) {
          k = 0.04; /* Smooth glide, no bounce */
          p._returning -= 0.008;
          if (p._returning <= 0) p._returning = 0;
        }
        p.vx += dx * k;
        p.vy += dy * k;
        /* Organic planetary drift — two layered sine waves for natural movement */
        if (!p._wobblePhase) p._wobblePhase = Math.random() * Math.PI * 2;
        if (!p._wobblePhase2) p._wobblePhase2 = Math.random() * Math.PI * 2;
        p._wobblePhase += 0.012 + (i % 3) * 0.003;
        p._wobblePhase2 += 0.007 + (i % 4) * 0.002;
        p.vx += Math.sin(p._wobblePhase) * 0.04 + Math.cos(p._wobblePhase2) * 0.015;
        p.vy += Math.cos(p._wobblePhase * 0.7) * 0.03 + Math.sin(p._wobblePhase2 * 1.3) * 0.012;
      }

      /* Pill-to-pill repulsion — soft quadratic falloff */
      pills.forEach(function (other) {
        if (other === p) return;
        var dx = p.x - other.x;
        var dy = p.y - other.y;
        var dist = Math.sqrt(dx * dx + dy * dy) || 1;
        var minDist = 85;
        if (dist < minDist) {
          var t = (minDist - dist) / minDist;
          var force = t * t * 0.2;
          p.vx += (dx / dist) * force;
          p.vy += (dy / dist) * force;
        }
      });

      /* Damping — heavier while returning to prevent overshoot */
      var damp = p._returning > 0 ? 0.88 : 0.96;
      p.vx *= damp;
      p.vy *= damp;

      p.x += p.vx;
      p.y += p.vy;

      /* Soft bounds — gentle pull back instead of hard wall */
      var pw = p.el.offsetWidth / 2 || 40;
      var ph = p.el.offsetHeight / 2 || 12;
      var margin = 20;
      if (p.x < margin) p.vx += (margin - p.x) * 0.05;
      if (p.x > W - margin) p.vx += (W - margin - p.x) * 0.05;
      if (p.y < margin) p.vy += (margin - p.y) * 0.05;
      if (p.y > H - margin) p.vy += (H - margin - p.y) * 0.05;

      /* Apply position — GPU-composited transform for smooth sub-pixel movement */
      var s = p._zoomScale || 1;
      p.el.style.transform = 'translate(' + (p.x - pw) + 'px,' + (p.y - ph) + 'px)' + (s !== 1 ? ' scale(' + s + ')' : '');

      /* Visual state */
      p.el.classList.toggle('matched', p.matched && isFiltering);
      p.el.classList.toggle('repelled', !p.matched && isFiltering);
    });

    /* Draw connection lines */
    ctx.clearRect(-canvasPad, -canvasPad, W + canvasPad * 2, H + canvasPad * 2);
    connections.forEach(function (pair) {
      var a = pills[pair[0]], b = pills[pair[1]];
      if (!a || !b) return;
      var bothMatch = a.matched && b.matched && isFiltering;
      var opacity = isFiltering ? (bothMatch ? 0.25 : 0.03) : 0.08;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.strokeStyle = 'rgba(255,255,255,' + opacity + ')';
      ctx.lineWidth = bothMatch ? 1.5 : 0.8;
      ctx.stroke();
    });

    requestAnimationFrame(tick);
  }

  /* ── Search / filter ────────────────────────────────────────── */
  function updateGroupVisibility() {
    allGroups.forEach(function (group) {
      var visibleCards = group.querySelectorAll('.site-card[data-card-id]:not(.search-hidden)');
      group.classList.toggle('group-hidden', visibleCards.length === 0);
    });
  }

  function doFilter() {
    var q = input.value.trim().toLowerCase();
    clearBtn.classList.toggle('show', q.length > 0);

    if (!q) {
      isFiltering = false;
      /* Show all cards and groups */
      cards.forEach(function (c) { c.classList.remove('search-hidden'); });
      allGroups.forEach(function (g) { g.classList.remove('group-hidden'); });
      pills.forEach(function (p) {
        p.matched = false; p.repelled = false;
        p._orbitX = 0; p._orbitY = 0;
        p.vx *= 0.15;
        p.vy *= 0.15;
        p._returning = 1;
      });
      noResults.classList.remove('show');
      countEl.textContent = '';
      return;
    }

    isFiltering = true;

    /* Check which categories match */
    pills.forEach(function (p) {
      var catMatch = p.cat.label.toLowerCase().includes(q) ||
                     p.cat.keywords.includes(q);
      p.matched = catMatch;
    });

    /* Check which cards match (text search + category membership) */
    var matchedIds = new Set();
    pills.forEach(function (p) {
      if (p.matched) p.cat.ids.forEach(function (id) { matchedIds.add(id); });
    });
    /* Also direct text search on cards */
    index.forEach(function (item) {
      if (item.text.includes(q)) matchedIds.add(item.id);
    });

    /* Show/hide cards in place (no reordering — groups provide structure) */
    var visible = 0;
    var total = index.filter(function (i) { return !ghost.includes(i.id); }).length;

    cards.forEach(function (c) {
      var id = c.dataset.cardId;
      if (matchedIds.has(id)) {
        c.classList.remove('search-hidden');
        if (!ghost.includes(id)) visible++;
      } else {
        c.classList.add('search-hidden');
      }
    });

    /* Hide entire groups with no visible cards */
    updateGroupVisibility();

    /* Also update pill match state for pills not matched by label but by card overlap */
    pills.forEach(function (p) {
      if (!p.matched) {
        p.matched = p.cat.ids.some(function (id) { return matchedIds.has(id); });
      }
    });

    if (visible === 0) {
      noResults.classList.add('show');
      countEl.textContent = '';
    } else {
      noResults.classList.remove('show');
      countEl.textContent = visible + ' of ' + total + ' tools';
    }
  }

  input.addEventListener('input', doFilter);

  /* Scroll search bar to top on focus so pills + cards get maximum viewport */
  var searchWrap = input.closest('.hero-search-wrap');
  input.addEventListener('focus', function () {
    if (searchWrap) {
      var offset = searchWrap.getBoundingClientRect().top + window.scrollY - 12;
      window.scrollTo({ top: offset, behavior: 'smooth' });
    }
  });

  clearBtn.addEventListener('click', function (e) {
    e.preventDefault();
    e.stopPropagation();
    input.value = '';
    doFilter();
    input.focus();
  });

  /* Keyboard: / to focus, Esc to clear/blur */
  document.addEventListener('keydown', function (e) {
    if (e.key === '/' && document.activeElement !== input &&
        !document.activeElement.closest('.term-overlay') &&
        document.activeElement.tagName !== 'INPUT' &&
        document.activeElement.tagName !== 'TEXTAREA') {
      e.preventDefault();
      input.focus();
      input.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    if (e.key === 'Escape' && document.activeElement === input) {
      e.preventDefault();
      if (input.value) {
        input.value = '';
        doFilter();
      } else {
        input.blur();
      }
    }
  });

  /* ── Init ────────────────────────────────────────────────────── */
  function init() {
    resizeCanvas();
    createPills();
    buildConnections();
    tick();
  }

  /* Wait for layout */
  if (document.readyState === 'complete') init();
  else window.addEventListener('load', init);

  window.addEventListener('resize', function () {
    resizeCanvas();
    /* Recalc home positions with random scatter */
    var positions = randomPositions(pills.length, W, H, 80);
    pills.forEach(function (p, i) {
      p.homeX = positions[i][0];
      p.homeY = positions[i][1];
    });
  });
})();
