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
  /* Pills mirror the DOM `.card-group` sections one-for-one — same labels, same
     membership. They used to drift: a "Learning" pill matched no section (Agent
     Lore sits in Productivity, SafeGuard in DevOps) and a "Game" pill pointed
     only at a locked ghost card, so clicking it filtered the catalog to nothing.
     Keywords from those retired pills were folded into the groups that actually
     hold the cards, so no search term was lost. Keep `ids` in sync with the
     group they name. */
  const CATEGORIES = [
    { label: 'Planning',      color: '#4ade80', ids: ['pathfinder','skillmap','doorman','loadout'], keywords: 'planning visual canvas export learning roadmap pathfinder skill map strategy doorman build vs buy duplicate vendor deliverable cost estimate scope tokens engineers reverse engineer doorman fallacy loadout team meetings workload overload balance week manager distribution drag drop calendar bottle capacity' },
    { label: 'DevOps',        color: '#fbbf24', ids: ['cardforge','infradrills','snippets','safeguard','lockdown','runbook'], keywords: 'devops challenges cli cheatsheet search aws kubernetes docker k8s shell terminal commands bash powershell windows wsl macos git infra drills snippets lockdown security scanner endpoints headers incident runbook alert response on-call checklist cardforge card designer editor json export rush q game builder safeguard hardening guides accounts devices privacy' },
    { label: 'Data',          color: '#2dd4bf', ids: ['jsonstudio','references','sitrep'], keywords: 'data editor privacy api search json reference matrix scrambler viewer visualizer radar sitrep santiago chile earthquakes seismic weather forecast metro transit war room situation board dashboard usgs' },
    { label: 'Productivity',  color: '#a78bfa', ids: ['slides','promptforge','ogstudio','agentlore','glassbox','stash','resume-forge','stackrank','awesomesites'], keywords: 'productivity slides export audit presentation sage yaml pptx marp og preview design generator studio resume forge gaming pdf psn steam stack rank priority lists drag drop collaboration awesome sites curated bookmarks external api whiteboard prompt forge ai prompts context pathfinder agent lore glass box claude architect certification exam agent loop subagents coordinator mcp anti-patterns planning mode config claude.md under the hood simulation stash design assets inspiration icons ui kits pixel art music sprites itch.io submissions votes wishlist json api learning tutorials ai agent cursor commands skills path' },
    { label: 'UI Lab',        color: '#d946ef', ids: ['anatomy','guildhall','questline'], keywords: 'ui lab mockups wireframe components interface design anatomy learn names guild hall quests monster hunter gamified teams badges ranks questline operating model console nier command palette chapters playbooks atlas onboarding keyboard nav experiments prototypes' },
    { label: 'Fun',           color: '#f472b6', ids: ['decisionwheel','memes','clientsays','emojis','teamplay','gamebin','minimap','pieza','youtube'], keywords: 'minimap arpg parody dungeon boss grind level fun randomizer community upload wheel spin memes timezone translator jargon client says decoded emoji archive search gamebin game bin steam lists curate profile youtube video overflow pieza dice cards tabletop print play boss hunt dnd bilingual card game teamplay team building retros activities icebreakers games strategy' },
    { label: 'Social',        color: '#38bdf8', ids: ['vibecheck','hiringpack','charactersheet','parla','playbook','tubestack'], keywords: 'social interviews scoring vibe check behavioral personality export character sheet know parla slang latin american regional language playbook career advice tech job hunting bilingual english spanish tubestack youtube channels discovery engineers match community hiring pack resume bullets follow-up' },
    { label: 'Lifehacks',     color: '#f59e0b', ids: ['buyhacks'], keywords: 'lifehacks community reviews buyhacks buy hacks products shopping' },
    { label: 'Health',        color: '#059669', ids: ['headmap'], keywords: 'health head pain migraine headache sinus tension eye strain allergy flu tmj map 3d visualization share' },
    { label: 'Growth',        color: '#fcd34d', ids: ['mettle','primer'], keywords: 'growth mettle reasoning maturity self assessment introspection virtues courage wisdom tolerance eloquence imagination rank probe character moral compass private primer machine learning ml llm ai data science insights training embeddings rag pytorch scikit-learn ollama tutorial learn beginner hands-on pet projects fortune 500' },
    { label: 'Platforms',     color: '#64748b', ids: ['github','gitlab','dockerhub'], keywords: 'platforms github gitlab docker hub containers images repos code open source private ci cd pipelines' },
  ];

  /* ── Floating pills (physics) ───────────────────────────────── */
  var W = 0, H = 0;
  var pills = [];
  var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

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

    if (!reducedMotion.matches) requestAnimationFrame(tick);
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

    /* "N of M tools" has to agree with the 43 the hero claims, so the
       denominator excludes the same things that count does: locked ghosts, the
       4 external destinations (github/gitlab/docker/youtube are not ours), and
       the Recently shipped rail's clones. Counting all 50 cards with an id
       produced "of 47", contradicting the hero one scroll above. */
    function countable(item) {
      return !ghost.includes(item.id) &&
             !item.el.classList.contains('external-card') &&
             !item.el.classList.contains('site-card--echo') &&
             !!item.el.closest('#tools');
    }

    var visible = currentIndex.filter(function (i) {
      return matchedIds.has(i.id) && countable(i);
    }).length;

    var total = currentIndex.filter(countable).length;

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

  /* ── Keyboard walking ────────────────────────────────────────────
     Typing a query used to be a dead end: the catalog filtered, and reaching
     the one card left still meant taking hands off the keyboard. Arrow keys now
     walk the matches and Enter opens the highlighted one — Enter with nothing
     highlighted takes the top match, which is the common case of "type three
     letters, hit Enter".

     Results are read from the DOM at keypress time rather than cached, because
     the merged grid is re-ordered by doFilter and a stale list would highlight
     a card that has since moved. */
  var kbdIndex = -1;

  function kbdResults() {
    if (!document.body.classList.contains('search-active') || !mergedGrid) return [];
    return Array.from(mergedGrid.querySelectorAll('.site-card[data-card-id]'))
      .filter(function (c) {
        return !c.classList.contains('search-hidden') &&
               !c.classList.contains('ghost-card');
      });
  }

  function kbdPaint(list) {
    (list || kbdResults()).forEach(function (c, i) {
      c.classList.toggle('kbd-active', i === kbdIndex);
    });
  }

  function kbdClear() {
    kbdIndex = -1;
    document.querySelectorAll('.site-card.kbd-active').forEach(function (c) {
      c.classList.remove('kbd-active');
    });
  }

  function kbdMove(delta) {
    var list = kbdResults();
    if (!list.length) return;
    kbdIndex = kbdIndex < 0
      ? (delta > 0 ? 0 : list.length - 1)
      : (kbdIndex + delta + list.length) % list.length;
    kbdPaint(list);
    var el = list[kbdIndex];
    var rect = el.getBoundingClientRect();
    var vh = window.innerHeight || document.documentElement.clientHeight;
    /* Only scroll when the highlight would otherwise be off-screen — walking
       through a row that is already visible should not jerk the page. */
    if (rect.top < 90 || rect.bottom > vh - 24) {
      el.scrollIntoView({
        block: 'center',
        behavior: prefersReducedMotion() ? 'auto' : 'smooth'
      });
    }
    if (window._neoSoundPing) window._neoSoundPing(660, 0.012);
  }

  function kbdOpen() {
    var list = kbdResults();
    if (!list.length) return;
    var el = list[kbdIndex < 0 ? 0 : kbdIndex];
    var href = el.getAttribute('href');
    if (href) {
      if (el.classList.contains('external-card') || el.target === '_blank') {
        window.open(href, '_blank', 'noopener');
      } else {
        window.location.href = href;
      }
    } else {
      /* Multi-tool cards are <div>s whose sub-tool popup is wired by cards.js;
         a click is the only way in, and cards.js owns that behaviour. */
      el.click();
      el.scrollIntoView({ block: 'center' });
    }
  }

  input.addEventListener('input', function () {
    kbdClear();
    doFilter();
  });

  input.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowDown') { e.preventDefault(); kbdMove(1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); kbdMove(-1); }
    else if (e.key === 'Enter') { e.preventDefault(); kbdOpen(); }
  });

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
    kbdClear();
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
      if (kbdIndex >= 0) {
        /* First Esc drops the highlight, not the query — losing a typed query
           to a keystroke meant for "deselect" is the annoying outcome. */
        kbdClear();
      } else if (input.value) {
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

    if (reducedMotion.matches) {
      pills.forEach(function (p) { p.el.style.opacity = ''; });
      return;
    }

    /* Entrance: staggered fade + gentle scale-pop so the pills visibly
       materialize into the constellation one by one. Scale rides the
       physics-applied transform via _zoomScale so it never fights the
       per-frame position updates. */
    pills.forEach(function (p, i) {
      var delay = i * 70;
      p.el.style.opacity = '0';
      p.el.style.transition = 'opacity .5s ease ' + delay + 'ms';
      p._zoomScale = 0.55;

      var start = null;
      var duration = 480;
      function pop(now) {
        if (start === null) start = now;
        var t = (now - start - delay) / duration;
        if (t < 0) { requestAnimationFrame(pop); return; }
        if (t >= 1) {
          p._zoomScale = 1;
          p.el.style.transition = '';
          return;
        }
        p._zoomScale = 0.55 + 0.45 * (1 - Math.pow(1 - t, 3));
        requestAnimationFrame(pop);
      }
      requestAnimationFrame(pop);
    });

    /* Double rAF ensures opacity:0 is painted before transitioning */
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        pills.forEach(function (p) { p.el.style.opacity = ''; });
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
