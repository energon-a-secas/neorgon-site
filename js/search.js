(function () {
  const input = document.getElementById('heroSearch');
  const clearBtn = document.getElementById('searchClear');
  const countEl = document.getElementById('searchCount');
  const noResults = document.getElementById('searchNoResults');
  const box = document.getElementById('constellationBox');
  const canvas = document.getElementById('constellationCanvas');
  if (!input || !box || !canvas) return;
  const ctx = canvas.getContext('2d');

  const catalogMain = document.getElementById('tools');
  const mergedGroup = document.getElementById('catalogSearchMerged');
  const mergedGrid = mergedGroup ? mergedGroup.querySelector('.sites-grid') : null;
  const nativeGroups = Array.from(document.querySelectorAll('#tools > .card-group:not(#catalogSearchMerged)'));

  let cards = Array.from(document.querySelectorAll('.site-card[data-card-id]'));
  const ghost = cards.filter(c => c.classList.contains('ghost-card')).map(c => c.dataset.cardId);

  var catalogCardsOrdered = [];
  if (catalogMain) {
    catalogMain.querySelectorAll('.card-group:not(#catalogSearchMerged) .sites-grid').forEach(function (grid) {
      grid.querySelectorAll('.site-card[data-card-id]').forEach(function (card) {
        catalogCardsOrdered.push(card);
      });
    });
  }

  const nativeGridByCard = new WeakMap();
  catalogCardsOrdered.forEach(function (card) {
    nativeGridByCard.set(card, card.parentElement);
  });

  /* Build searchable index */
  const buildIndex = function() {
    // Update cards collection
    cards = Array.from(document.querySelectorAll('.site-card[data-card-id]'));
    return cards.map(card => {
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
  };

  const index = buildIndex();

  /* ── Curated categories ─────────────────────────────────────── */
  const CATEGORIES = [
    { label: 'Planning',      color: '#4ade80', ids: ['pathfinder','skillmap'], keywords: 'planning visual canvas export learning roadmap pathfinder skill map strategy' },
    { label: 'DevOps',        color: '#fbbf24', ids: ['infradrills','snippets','lockdown'], keywords: 'devops challenges cli cheatsheet search aws kubernetes docker k8s shell infra drills snippets lockdown security scanner endpoints headers' },
    { label: 'Data',          color: '#2dd4bf', ids: ['jsonstudio','references'], keywords: 'data editor privacy api search json reference matrix scrambler viewer visualizer' },
    { label: 'Productivity',  color: '#a78bfa', ids: ['slides','ogstudio','resume-forge','stackrank'], keywords: 'productivity slides export audit presentation sage yaml pptx marp og preview design generator studio resume forge gaming pdf psn steam stack rank priority lists drag drop collaboration' },
    { label: 'Learning',      color: '#67e8f9', ids: ['agentlore','safeguard','anatomy'], keywords: 'learning tutorials ai agent claude cursor mcp commands skills path security hardening safeguard guides ui anatomy wireframe components interface design' },
    { label: 'Fun',           color: '#f472b6', ids: ['decisionwheel','memes','clientsays','emojis','guildhall','youtube'], keywords: 'fun randomizer community upload wheel spin memes timezone translator jargon client says decoded emoji archive search guild hall quests monster hunter gamified teams youtube video overflow' },
    { label: 'Social',        color: '#38bdf8', ids: ['vibecheck','charactersheet','parla','playbook','tubestack'], keywords: 'social interviews scoring vibe check behavioral personality export character sheet know parla slang latin american regional language playbook career advice tech job hunting bilingual english spanish tubestack youtube channels discovery engineers match community' },
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
      el.type = 'button';
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
  function syncCatalogMerge(matchedIds) {
    if (!mergedGroup || !mergedGrid || catalogCardsOrdered.length === 0) return;

    nativeGroups.forEach(function (g) {
      g.classList.add('catalog-native-suppressed');
    });

    catalogCardsOrdered.forEach(function (card) {
      var id = card.dataset.cardId;
      var match = matchedIds.has(id);
      var home = nativeGridByCard.get(card);
      if (match) {
        card.classList.remove('search-hidden');
        mergedGrid.appendChild(card);
      } else {
        card.classList.add('search-hidden');
        if (home && card.parentElement !== home) {
          home.appendChild(card);
        }
      }
    });

    var visibleTools = catalogCardsOrdered.filter(function (c) {
      return matchedIds.has(c.dataset.cardId) && !ghost.includes(c.dataset.cardId);
    }).length;

    mergedGroup.classList.toggle('catalog-merge-empty', visibleTools === 0);
  }

  function restoreCatalogNativeLayout() {
    nativeGroups.forEach(function (g) {
      g.classList.remove('catalog-native-suppressed');
    });
    if (mergedGroup) mergedGroup.classList.add('catalog-merge-empty');
    catalogCardsOrdered.forEach(function (card) {
      card.classList.remove('search-hidden');
      var home = nativeGridByCard.get(card);
      if (home) home.appendChild(card);
    });
  }

  function updateGroupVisibility() {
    if (document.body.classList.contains('search-active')) return;
    nativeGroups.forEach(function (group) {
      var visibleCards = group.querySelectorAll('.site-card[data-card-id]:not(.search-hidden)');
      group.classList.toggle('group-hidden', visibleCards.length === 0);
    });
  }

  function prefersReducedMotion() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  /**
   * After filter DOM updates: FLIP cards that stayed visible (slide into new grid
   * slots); subtle rise-in for newly revealed matches (motion toward search).
   */
  function runFilterMotion(flipPairs, riseEls) {
    if (prefersReducedMotion()) return;
    requestAnimationFrame(function () {
      flipPairs.forEach(function (pair) {
        var el = pair.el;
        var first = pair.first;
        var last = el.getBoundingClientRect();
        var dx = first.left - last.left;
        var dy = first.top - last.top;
        if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;

        el.classList.add('catalog-flip-active');
        el.style.transition = 'none';
        el.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
        requestAnimationFrame(function () {
          el.style.transition = 'transform 0.42s cubic-bezier(0.34, 1.56, 0.64, 1)';
          el.style.transform = '';
          var settled = false;
          function cleanup() {
            if (settled) return;
            settled = true;
            el.classList.remove('catalog-flip-active');
            el.style.transition = '';
            el.style.transform = '';
          }
          el.addEventListener('transitionend', function te(ev) {
            if (ev.propertyName !== 'transform') return;
            el.removeEventListener('transitionend', te);
            cleanup();
          });
          window.setTimeout(cleanup, 520);
        });
      });

      riseEls.forEach(function (el) {
        el.classList.add('catalog-rise-in');
        el.addEventListener('animationend', function onEnd() {
          el.removeEventListener('animationend', onEnd);
          el.classList.remove('catalog-rise-in');
        }, { once: true });
      });
    });
  }

  function doFilter() {
    var q = input.value.trim().toLowerCase();
    clearBtn.classList.toggle('show', q.length > 0);

    var currentCards = Array.from(document.querySelectorAll('.site-card[data-card-id]'));
    var currentIndex = buildIndex();

    if (!q) {
      var clearFlip = [];
      if (!prefersReducedMotion() && document.body.classList.contains('search-active') && mergedGrid) {
        mergedGrid.querySelectorAll('.site-card[data-card-id]').forEach(function (el) {
          clearFlip.push({ el: el, first: el.getBoundingClientRect() });
        });
      }

      isFiltering = false;

      restoreCatalogNativeLayout();

      nativeGroups.forEach(function (g) {
        g.classList.remove('group-hidden');
      });

      currentCards.forEach(function (c) {
        if (!nativeGridByCard.has(c)) {
          c.classList.remove('search-hidden');
        }
      });

      pills.forEach(function (p) {
        p.matched = false; p.repelled = false;
        p._orbitX = 0; p._orbitY = 0;
        p.vx *= 0.15;
        p.vy *= 0.15;
        p._returning = 1;
      });
      document.body.classList.remove('search-active');
      noResults.classList.remove('show');
      countEl.textContent = '';

      updateGroupVisibility();

      if (clearFlip.length) {
        runFilterMotion(clearFlip, []);
      }
      return;
    }

    isFiltering = true;
    document.body.classList.add('search-active');

    pills.forEach(function (p) {
      var catMatch = p.cat.label.toLowerCase().includes(q) ||
                     p.cat.keywords.includes(q);
      p.matched = catMatch;
    });

    var matchedIds = new Set();
    pills.forEach(function (p) {
      if (p.matched) p.cat.ids.forEach(function (id) { matchedIds.add(id); });
    });
    currentIndex.forEach(function (item) {
      if (item.text.includes(q)) matchedIds.add(item.id);
    });

    var flipPairs = [];
    var riseEls = [];
    catalogCardsOrdered.forEach(function (c) {
      var id = c.dataset.cardId;
      if (!matchedIds.has(id)) return;
      var wasShown = !c.classList.contains('search-hidden');
      if (wasShown) flipPairs.push({ el: c, first: c.getBoundingClientRect() });
      else riseEls.push(c);
    });

    currentCards.forEach(function (c) {
      if (nativeGridByCard.has(c)) return;
      var id = c.dataset.cardId;
      if (matchedIds.has(id)) {
        c.classList.remove('search-hidden');
      } else {
        c.classList.add('search-hidden');
      }
    });

    syncCatalogMerge(matchedIds);

    var visible = currentIndex.filter(function (i) {
      return matchedIds.has(i.id) && !ghost.includes(i.id);
    }).length;

    var total = currentIndex.filter(function (i) { return !ghost.includes(i.id); }).length;

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

    updateGroupVisibility();

    runFilterMotion(flipPairs, riseEls);
  }

  input.addEventListener('input', doFilter);

  /* Scroll hero search into view only when it is largely off-screen */
  var searchWrap = input.closest('.hero-search-wrap');
  input.addEventListener('focus', function () {
    if (!searchWrap) return;
    var rect = searchWrap.getBoundingClientRect();
    var vh = window.innerHeight || document.documentElement.clientHeight;
    var margin = 48;
    if (rect.top < margin || rect.bottom > vh - margin) {
      var offset = rect.top + window.scrollY - 12;
      window.scrollTo({ top: Math.max(0, offset), behavior: 'smooth' });
    }
  });
  clearBtn.addEventListener('click', function (e) {
    e.preventDefault();
    e.stopPropagation();
    input.value = '';
    // Small delay to ensure DOM state is clean
    setTimeout(function() {
      doFilter();
      input.focus();
    }, 10);
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
    /* Fade in all pills together — double rAF ensures opacity:0 is painted before transitioning */
    pills.forEach(function (p) {
      p.el.style.opacity = '0';
      p.el.style.transition = 'opacity .4s ease';
    });
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        pills.forEach(function (p) {
          p.el.style.opacity = '';
        });
      });
    });
  }

  /* Wait for box to have real dimensions — poll via rAF, no need to wait for full window.load */
  function tryInit() {
    var rect = box.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      init();
    } else {
      requestAnimationFrame(tryInit);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { requestAnimationFrame(tryInit); });
  } else {
    requestAnimationFrame(tryInit);
  }

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
