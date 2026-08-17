(function () {
  const input = document.getElementById('heroSearch');
  const clearBtn = document.getElementById('searchClear');
  const countEl = document.getElementById('searchCount');
  const noResults = document.getElementById('searchNoResults');
  const catsEl = document.getElementById('searchCats');
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
        /* Per-field, not one blob: the blob cannot tell "the card is called
           Parla" from "the card mentions Parla", and that distinction is the
           whole of the ranking below. */
        name: name.trim().toLowerCase(),
        desc: desc.toLowerCase(),
        domain: domain.trim().toLowerCase(),
        tagText: tags.join(' ').toLowerCase(),
        added: card.dataset.added || '',
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
    { label: 'DevOps',        color: '#fbbf24', ids: ['infradrills','snippets','safeguard','lockdown','runbook'], keywords: 'devops challenges cli cheatsheet search aws kubernetes docker k8s shell terminal commands bash powershell windows wsl macos git infra drills snippets lockdown security scanner endpoints headers incident runbook alert response on-call checklist cardforge card designer editor json export rush q game builder safeguard hardening guides accounts devices privacy' },
    { label: 'Data',          color: '#2dd4bf', ids: ['jsonstudio','references','sitrep'], keywords: 'data editor privacy api search json reference matrix scrambler viewer visualizer radar sitrep santiago chile earthquakes seismic weather forecast metro transit war room situation board dashboard usgs' },
    { label: 'Productivity',  color: '#a78bfa', ids: ['slides','promptforge','ogstudio','agentlore','glassbox','stash','resume-forge','stackrank','awesomesites','rigcheck','tickbox'], keywords: 'productivity slides export audit presentation sage yaml pptx marp og preview design generator studio resume forge gaming pdf psn steam stack rank priority lists drag drop collaboration awesome sites curated bookmarks external api whiteboard prompt forge ai prompts context pathfinder agent lore glass box claude architect certification exam agent loop subagents coordinator mcp anti-patterns planning mode config claude.md under the hood simulation stash design assets inspiration icons ui kits pixel art music sprites itch.io submissions votes wishlist json api learning tutorials ai agent cursor commands skills path rigcheck camera settings review contradict sony a6700 video shooting picture profile tickbox todo to-do tasks checklist puter offline sync account boardwright board game design tabletop zones cards deck hand tableau discard rules phases actions win conditions spec brief blueprint prototype engine agent handoff export json png playtest' },
    { label: 'UI Lab',        color: '#d946ef', ids: ['anatomy','guildhall','questline','rewind','sortie','neokeys'], keywords: 'neokeys keyboard shortcuts hotkeys keybindings key map registry help overlay cheatsheet remap rebind accessibility wcag chrome toggle fullscreen fleet switcher palette ui lab mockups wireframe components interface design anatomy learn names guild hall quests monster hunter gamified teams badges ranks questline operating model console nier command palette chapters playbooks atlas onboarding keyboard nav experiments prototypes rewind design history snapshots archive time machine wayback past versions before after era compare capture screenshot filmstrip sortie mech cockpit hud gundam anime robot frame parts glyph pixel editor burst mode overdrive sci-fi console boot sequence unlock' },
    { label: 'Board Games',   color: '#e4483c', ids: ['rushq','cardforge','pieza','boardwright'], keywords: 'board games tabletop cards card game deck print and play dice rush q corporate strategy quarters hire build ai opponents cardforge card designer editor template schema json export pieza dnd bilingual boss hunt improvised guardrails d20 plausibility boardwright board game design blueprint zones rules phases actions win conditions spec brief agent handoff uno colourful kids family playtest prototype' },
    { label: 'Fun',           color: '#f472b6', ids: ['decisionwheel','memes','clientsays','emojis','teamplay','gamebin','minimap','youtube'], keywords: 'minimap arpg parody dungeon boss grind level fun randomizer community upload wheel spin memes timezone translator jargon client says decoded emoji archive search gamebin game bin steam lists curate profile youtube video overflow pieza dice cards tabletop print play boss hunt dnd bilingual card game teamplay team building retros activities icebreakers games strategy' },
    { label: 'Social',        color: '#38bdf8', ids: ['vibecheck','hiringpack','charactersheet','parla','playbook','tubestack'], keywords: 'social interviews scoring vibe check behavioral personality export character sheet know parla slang latin american regional language playbook career advice tech job hunting bilingual english spanish tubestack youtube channels discovery engineers match community hiring pack resume bullets follow-up' },
    { label: 'Lifehacks',     color: '#f59e0b', ids: ['buyhacks'], keywords: 'lifehacks community reviews buyhacks buy hacks products shopping' },
    { label: 'Health',        color: '#059669', ids: ['headmap'], keywords: 'health head pain migraine headache sinus tension eye strain allergy flu tmj map 3d visualization share' },
    { label: 'Growth',        color: '#fcd34d', ids: ['mettle','primer','proctor'], keywords: 'growth mettle reasoning maturity self assessment introspection virtues courage wisdom tolerance eloquence imagination rank probe character moral compass private primer machine learning ml llm ai data science insights training embeddings rag pytorch scikit-learn ollama tutorial learn beginner hands-on pet projects fortune 500 proctor exam test quiz simulator json yaml questions answers study certification' },
    { label: 'Platforms',     color: '#64748b', ids: ['github','gitlab','dockerhub'], keywords: 'platforms github gitlab docker hub containers images repos code open source private ci cd pipelines' },
  ];

  /* ── Relevance ───────────────────────────────────────────────────
     There was no ranking at all: matches were emitted in catalog DOM order, so
     "parla" returned six cards with Parla fourth. Two separate defects produced
     that one symptom, and fixing either alone leaves the other visible.

     1. ORDER. Every match now carries a score and the merged grid is filled in
        score order, ship date breaking ties (newest first — the same tie-break
        palette.js already uses).

     2. MEMBERSHIP. A category's `keywords` blob is a *fallback vocabulary*, not
        an amplifier. It used to be enough that the query appeared anywhere in
        the blob for every card in that category to be declared a match — which
        is how one tool's name dragged in the five other Social tools. Now the
        blob only opens a group when the query named nothing at all ("cheatsheet"
        matches no card, so it is allowed to mean DevOps). A category's own
        *label* still expands unconditionally, because that is the pill-click
        path and showing the whole group is the entire point of clicking it.
  ─────────────────────────────────────────────────────────────────── */
  function escRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

  /* Matches at the start of a word, so "par" finds Parla and "box" finds Glass
     Box, while "art" does not find "smart". Prefixes have to keep working —
     this fires on every keystroke, and half a word is the normal state. */
  function wordStart(hay, q) {
    if (!hay) return false;
    return new RegExp('(^|[^a-z0-9])' + escRe(q)).test(hay);
  }

  var SCORE = {
    nameExact:  1000,
    nameWord:    700,
    nameLoose:   560,
    catExact:    520,  /* the query IS a category label — a pill click */
    domain:      460,
    tag:         380,
    desc:        220,
    loose:       120,  /* matched somewhere, mid-word */
    catLabel:     90,  /* part of a label: "dev" → DevOps */
    catKeyword:   80   /* fallback vocabulary; only when nothing matched */
  };

  function scoreCard(item, q) {
    if (item.name === q) return SCORE.nameExact;
    if (wordStart(item.name, q)) return SCORE.nameWord;
    if (item.name.indexOf(q) >= 0) return SCORE.nameLoose;
    if (wordStart(item.domain, q) || wordStart(item.id, q)) return SCORE.domain;
    if (wordStart(item.tagText, q)) return SCORE.tag;
    if (wordStart(item.desc, q)) return SCORE.desc;
    if (item.text.indexOf(q) >= 0) return SCORE.loose;
    return 0;
  }

  /* Returns the matches in the order they should be shown, plus which
     categories the query lit up (the pills read that, not the card list). */
  function rank(q, list) {
    var score = Object.create(null);
    var byId = Object.create(null);
    var hits = [];

    list.forEach(function (item) { byId[item.id] = item; });
    list.forEach(function (item) {
      var s = scoreCard(item, q);
      if (s > 0) { score[item.id] = s; hits.push(item); }
    });

    var labelCats = CATEGORIES.filter(function (c) {
      return c.label.toLowerCase().indexOf(q) >= 0;
    });
    var keywordCats = CATEGORIES.filter(function (c) {
      return labelCats.indexOf(c) < 0 && wordStart(c.keywords, q);
    });

    var expanding = labelCats.concat(hits.length ? [] : keywordCats);

    expanding.forEach(function (cat) {
      var base = cat.label.toLowerCase() === q ? SCORE.catExact
               : labelCats.indexOf(cat) >= 0 ? SCORE.catLabel
               : SCORE.catKeyword;
      cat.ids.forEach(function (id) {
        var item = byId[id];
        if (!item) return;
        if (score[id] === undefined) { score[id] = base; hits.push(item); }
        else if (score[id] < base) { score[id] = base; }
      });
    });

    hits.sort(function (a, b) {
      if (score[b.id] !== score[a.id]) return score[b.id] - score[a.id];
      if (a.added !== b.added) return a.added < b.added ? 1 : -1;
      return a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
    });

    var matchedIds = new Set(hits.map(function (h) { return h.id; }));

    /* A category is lit if the query names it, if its fallback vocabulary
       carries the query, or if it owns something that matched. The third case
       is what makes the pills a readout of the result set rather than of the
       query string. */
    var lit = CATEGORIES.filter(function (c) {
      return labelCats.indexOf(c) >= 0 ||
             wordStart(c.keywords, q) ||
             c.ids.some(function (id) { return matchedIds.has(id); });
    });

    return { hits: hits, order: hits.map(function (h) { return h.id; }),
             matchedIds: matchedIds, lit: lit };
  }

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

      /* Depth. Every pill used to render at the same size, which made the
         cloud a flat scatter of labels — twelve things at exactly one distance
         is a list that happens to be arranged in 2D. Giving each a standing
         scale reads as some being nearer than others, which is the whole
         difference between a scatter and a system you could travel through.

         Derived from the index rather than random, so a category keeps its
         distance across reloads and you can learn where things are. The stride
         of 5 over a period of 7 spreads twelve pills across the range without
         two neighbours landing on the same size. */
      var depth = 0.82 + ((i * 5) % 7) / 7 * 0.38;

      el.style.setProperty('--pill-depth', depth.toFixed(3));

      var pill = {
        el: el,
        cat: cat,
        depth: depth,
        x: cx, y: cy,
        homeX: cx, homeY: cy,
        vx: (Math.random() - 0.5) * 0.1,
        vy: (Math.random() - 0.5) * 0.08,
        /* Eased, not snapped: a pill that jumps to its selected size has
           changed, a pill that grows into it has approached. */
        _stateScale: 1,
        _breathPhase: Math.random() * Math.PI * 2,
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

  /* ── Route map ───────────────────────────────────────────────────
     The old graph connected any two categories whose keyword blobs happened to
     share a word, then added every neighbouring pair, then wrapped last to
     first: forty-odd chords across twelve moving points, which renders as a
     hairball. It was also unreadable in principle — "Data and Fun share the
     word 'cards'" is not a relationship anyone can see in a line, so the ink
     bought nothing.

     What replaces it is geometric. Each pill links to its two nearest
     neighbours, deduped; the graph is re-derived as the pills drift so a link
     always joins things that are actually close. That is why a star chart
     connects what is near rather than what is thematically alike, and it is
     the difference between a web and a route.

     Per-edge state (phase, speed, bow) is keyed by the pair and survives a
     rebuild, so a signal in flight is not teleported back to the start every
     time the graph is re-derived.
  ─────────────────────────────────────────────────────────────────── */
  var connections = [];
  var edgeState = Object.create(null);
  var LINK_K = 2;

  function buildConnections() {
    var seen = Object.create(null);
    connections = [];
    for (var i = 0; i < pills.length; i++) {
      var near = [];
      for (var j = 0; j < pills.length; j++) {
        if (i === j) continue;
        var dx = pills[i].x - pills[j].x;
        var dy = pills[i].y - pills[j].y;
        near.push([j, dx * dx + dy * dy]);
      }
      near.sort(function (a, b) { return a[1] - b[1]; });
      for (var k = 0; k < Math.min(LINK_K, near.length); k++) {
        var a = Math.min(i, near[k][0]);
        var b = Math.max(i, near[k][0]);
        var key = a + ':' + b;
        if (seen[key]) continue;
        seen[key] = true;
        if (!edgeState[key]) {
          edgeState[key] = {
            phase: Math.random(),
            speed: 0.0022 + Math.random() * 0.0026,
            /* Perpendicular bow. A straight chord between two drifting points
               reads as a constraint; a bowed one reads as a path. */
            bow: (Math.random() < 0.5 ? -1 : 1) * (0.06 + Math.random() * 0.13),
            dir: Math.random() < 0.5 ? -1 : 1
          };
        }
        connections.push({ a: a, b: b, st: edgeState[key] });
      }
    }
  }

  /* ── Drawing ─────────────────────────────────────────────────────
     A quadratic bezier whose control point is offset perpendicular to the
     chord. Both the base path and the travelling highlight sample the same
     curve, so the highlight rides the line instead of near it.
  ─────────────────────────────────────────────────────────────────── */
  function control(ax, ay, bx, by, bow) {
    var dx = bx - ax, dy = by - ay;
    return [(ax + bx) / 2 - dy * bow, (ay + by) / 2 + dx * bow];
  }

  function bezier(ax, ay, cx, cy, bx, by, t) {
    var it = 1 - t;
    return [it * it * ax + 2 * it * t * cx + t * t * bx,
            it * it * ay + 2 * it * t * cy + t * t * by];
  }

  /* Pill colours are authored as #rrggbb. */
  function rgba(hex, a) {
    var n = parseInt(hex.slice(1), 16);
    return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
  }

  var SIGNAL_LEN = 0.17;   /* fraction of the path the highlight occupies */
  var SIGNAL_SEGS = 7;     /* tail resolution — enough to taper, cheap to draw */

  function drawRoutes() {
    ctx.clearRect(-canvasPad, -canvasPad, W + canvasPad * 2, H + canvasPad * 2);
    ctx.lineCap = 'round';

    connections.forEach(function (link) {
      var a = pills[link.a], b = pills[link.b];
      if (!a || !b) return;

      var st = link.st;
      var live = isFiltering ? (a.matched && b.matched) : true;
      var dim = isFiltering && !live;

      var c = control(a.x, a.y, b.x, b.y, st.bow);

      /* Base path — a gradient between the two pill colours, so a route is
         visibly a route *between these two* rather than generic wiring. */
      var grad = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
      var baseA = dim ? 0.025 : (isFiltering ? 0.34 : 0.19);
      grad.addColorStop(0, rgba(a.cat.color, baseA));
      grad.addColorStop(0.5, rgba('#ffffff', baseA * 0.45));
      grad.addColorStop(1, rgba(b.cat.color, baseA));

      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.quadraticCurveTo(c[0], c[1], b.x, b.y);
      ctx.strokeStyle = grad;
      /* Same depth cue as the pills, so a route between two near ones is not
         hairlined into looking distant. */
      var near = (a.depth + b.depth) / 2;
      ctx.lineWidth = (live && isFiltering ? 1.3 : 0.7) * near;
      ctx.stroke();

      if (dim) return;

      /* Travelling highlight. It advances every frame and wraps, and it takes
         the colour of the pill it is heading toward — which is the whole read:
         something is moving from this category to that one. */
      st.phase += st.speed * (isFiltering ? 2.4 : 1);
      if (st.phase > 1 + SIGNAL_LEN) st.phase = -SIGNAL_LEN;

      var toward = st.dir > 0 ? b : a;
      var head = st.dir > 0 ? st.phase : 1 - st.phase;
      var peak = isFiltering ? 0.9 : 0.62;

      for (var i = 0; i < SIGNAL_SEGS; i++) {
        var t0 = head - st.dir * (SIGNAL_LEN * i / SIGNAL_SEGS);
        var t1 = head - st.dir * (SIGNAL_LEN * (i + 1) / SIGNAL_SEGS);
        if (Math.min(t0, t1) < 0 || Math.max(t0, t1) > 1) continue;
        var p0 = bezier(a.x, a.y, c[0], c[1], b.x, b.y, t0);
        var p1 = bezier(a.x, a.y, c[0], c[1], b.x, b.y, t1);
        /* Tail: alpha and width both fall away from the head, which is what
           makes it read as travelling rather than as a lit segment. */
        var fall = 1 - i / SIGNAL_SEGS;
        ctx.beginPath();
        ctx.moveTo(p0[0], p0[1]);
        ctx.lineTo(p1[0], p1[1]);
        ctx.strokeStyle = rgba(toward.cat.color, peak * fall * fall);
        ctx.lineWidth = (isFiltering ? 2.1 : 1.5) * fall;
        ctx.stroke();
      }

      /* One soft bloom at the head, drawn as two wide low-alpha dots rather
         than shadowBlur — same look, and it does not cost a blur pass per
         edge per frame. */
      if (head >= 0 && head <= 1) {
        var hp = bezier(a.x, a.y, c[0], c[1], b.x, b.y, head);
        [[6, 0.10], [3, 0.22]].forEach(function (ring) {
          ctx.beginPath();
          ctx.arc(hp[0], hp[1], ring[0] * (isFiltering ? 1.25 : 1), 0, Math.PI * 2);
          ctx.fillStyle = rgba(toward.cat.color, ring[1] * (isFiltering ? 1.4 : 1));
          ctx.fill();
        });
      }
    });
  }

  /* ── Physics tick ───────────────────────────────────────────── */
  var centerX = 0, centerY = 0;
  var isFiltering = false;
  var frame = 0;

  /* Lifted out of the tick loop so a filter still repaints the cloud when the
     loop is not running. Under prefers-reduced-motion `tick` draws one frame
     and stops, which used to mean the pills never dimmed and never lit — the
     one readout the cloud owes a reader was the one thing motion preference
     switched off. */
  function paintPillStates() {
    pills.forEach(function (p) {
      p.el.classList.toggle('matched', p.matched && isFiltering);
      p.el.classList.toggle('repelled', !p.matched && isFiltering);
    });
  }

  function tick() {
    centerX = W / 2;
    centerY = H / 2;

    pills.forEach(function (p, i) {
      if (isFiltering) {
        if (p.matched) {
          /* Travel to the middle. The spring used to be 0.003, which over the
             second a reader spends looking moved a pill perhaps a third of the
             way — the cloud appeared to have merely dimmed. It has to arrive
             for the arrival to be the message.

             Matched pills land on a small rosette rather than all on the same
             point: three categories converging on one pixel is three labels
             fighting the repulsion for the same spot, and the middle one is
             unreadable while they settle. One match still lands dead centre. */
          var n = p._slotN || 1;
          var ring = n < 2 ? 0 : Math.min(W, H) * (n < 4 ? 0.17 : 0.24);
          var ang = (p._slot / n) * Math.PI * 2 - Math.PI / 2;
          var tx = centerX + Math.cos(ang) * ring * 1.6;
          var ty = centerY + Math.sin(ang) * ring;
          var dx = tx - p.x;
          var dy = ty - p.y;
          p.vx += dx * 0.014;
          p.vy += dy * 0.014;
        } else {
          /* Drift to assigned peripheral orbit position, not the wall */
          /* Vacate the middle. Assigned once per filter so the ring is stable
             while the query stands, and spread by index rather than by where
             the pill happened to be — otherwise two pills that started close
             stay close and the ring has a gap opposite a clump. */
          if (!p._orbitX) {
            var angle = (i / pills.length) * Math.PI * 2 + Math.random() * 0.4;
            var rx = W * 0.46 + Math.random() * W * 0.05;
            var ry = H * 0.44 + Math.random() * H * 0.06;
            p._orbitX = centerX + Math.cos(angle) * rx;
            p._orbitY = centerY + Math.sin(angle) * ry;
          }
          var dx = p._orbitX - p.x;
          var dy = p._orbitY - p.y;
          p.vx += dx * 0.02;
          p.vy += dy * 0.02;
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
        /* Parallax. A near thing sweeps further across your view than a far
           thing moving at the same speed, so the drift is scaled by depth.
           Without it the sizes say "nearer" and the motion says "all at the
           same distance", and the motion wins. */
        var par = p.depth * p.depth;
        p.vx += (Math.sin(p._wobblePhase) * 0.04 + Math.cos(p._wobblePhase2) * 0.015) * par;
        p.vy += (Math.cos(p._wobblePhase * 0.7) * 0.03 + Math.sin(p._wobblePhase2 * 1.3) * 0.012) * par;
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

      /* ── Scale, composed from four independent things ──────────────
         depth      where the pill stands in the field, fixed per category
         breath     a slow in-and-out so nothing is ever perfectly still
         selection  matched pills come closer, unmatched fall back
         click      the bell-curve pop from the tap handler

         They multiply rather than override, so a far pill that gets selected
         still reads as the far one having come forward. Four separate springs
         all writing `transform` would fight; one product cannot. */
      p._breathPhase += 0.0055 + (i % 5) * 0.0009;
      var breath = 1 + 0.045 * Math.sin(p._breathPhase);

      var want = isFiltering ? (p.matched ? 1.26 : 0.74) : 1;
      p._stateScale += (want - p._stateScale) * 0.075;

      var s = p.depth * breath * p._stateScale * (p._zoomScale || 1);
      /* Round the position, not the scale: sub-pixel position is what keeps
         the drift smooth, and a rounded scale visibly steps during the pop. */
      p.el.style.transform = 'translate(' + (p.x - pw) + 'px,' + (p.y - ph) + 'px) scale(' + s.toFixed(4) + ')';

    });

    paintPillStates();

    /* The graph is proximity-based and the pills drift, so it has to be
       re-derived — but not every frame. Twelve pills move a few px per frame;
       every 40 is often enough that no link is ever visibly wrong, and it keeps
       the 66-pair sort off the hot path. */
    if ((frame++ % 40) === 0) buildConnections();
    drawRoutes();

    if (!reducedMotion.matches) requestAnimationFrame(tick);
  }

  /* ── Search / filter ────────────────────────────────────────── */
  /* `order` is the ranked id list. Appending in that order is what puts the
     best match first — the grid renders in DOM order, so ranking that is not
     applied here is ranking nobody sees. */
  function syncCatalogMerge(matchedIds, order) {
    if (!mergedGroup || !mergedGrid || catalogCardsOrdered.length === 0) return;

    nativeGroups.forEach(function (g) {
      g.classList.add('catalog-native-suppressed');
    });

    var cardById = new Map();
    catalogCardsOrdered.forEach(function (card) {
      cardById.set(card.dataset.cardId, card);
      if (matchedIds.has(card.dataset.cardId)) return;
      card.classList.add('search-hidden');
      var home = nativeGridByCard.get(card);
      if (home && card.parentElement !== home) home.appendChild(card);
    });

    (order || []).forEach(function (id) {
      var card = cardById.get(id);
      if (!card) return;
      card.classList.remove('search-hidden');
      mergedGrid.appendChild(card);
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

  /* ── Reveal ──────────────────────────────────────────────────────
     Entering search mode drops the favorites shelf, the Recently shipped rail
     and the category rail, so the merged grid lands right under the field. It
     still opens below the fold, because the hero heading above the field is
     ~370px tall. One scroll on the *transition* into search mode (never on
     later keystrokes, which would fight the typist) parks the field just under
     the header and gives the whole viewport to matches. Clearing the query
     returns to wherever reading had got to. */
  var preSearchScrollY = null;

  function headerOffset() {
    var raw = getComputedStyle(document.documentElement).getPropertyValue('--cat-rail-top');
    var px = parseFloat(raw);
    return isFinite(px) ? px : 62;
  }

  function revealResults() {
    var wrap = document.querySelector('.hero-search-wrap');
    if (!wrap) return;
    var target = Math.max(0, wrap.getBoundingClientRect().top + window.scrollY - headerOffset() - 12);
    /* Scroll in whichever direction the field is: searching from halfway down
       the catalog has to come back *up*, and an earlier `target <= scrollY`
       guard silently did nothing in exactly that case. */
    if (Math.abs(target - window.scrollY) < 8) return;
    window.scrollTo({
      top: target,
      behavior: prefersReducedMotion() ? 'auto' : 'smooth'
    });
  }

  /* The collapsed constellation still owes the reader one thing the pill cloud
     was showing: which curated categories the query hit. Rendered as chips
     beside the count, in CATEGORIES order so the row is stable between
     keystrokes rather than reshuffling as matches change.

     Derived from CATEGORIES + the query rather than from the `pills` objects,
     even though the pills carry the same `matched` flag. Pills only exist once
     the rAF-gated `tryInit` sees a laid-out box, so reading them made the chips
     disappear silently wherever that never happens — a throttled background
     tab, a headless pane. The chip row is information, not decoration; it must
     not depend on whether the decoration booted. */
  function renderCategoryChips(q, matched) {
    if (!catsEl) return;
    /* The pills say this better, and they are back on screen during a search
       now — two readouts of the same fact is one too many. The chips remain as
       the fallback for the case the comment above describes: a pill cloud that
       never booted (throttled background tab, headless pane, zero-size box) has
       to degrade to information, not to nothing. */
    if (pills.length) { catsEl.textContent = ''; return; }
    if (!matched.length) { catsEl.textContent = ''; return; }
    var frag = document.createDocumentFragment();
    matched.forEach(function (cat) {
      var chip = document.createElement('span');
      chip.className = 'search-cat-chip';
      chip.style.setProperty('--chip-color', cat.color);
      chip.textContent = cat.label;
      frag.appendChild(chip);
    });
    catsEl.textContent = '';
    catsEl.appendChild(frag);
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
      paintPillStates();
      noResults.classList.remove('show');
      countEl.textContent = '';
      if (catsEl) catsEl.textContent = '';

      if (preSearchScrollY !== null) {
        var back = preSearchScrollY;
        preSearchScrollY = null;
        window.scrollTo({ top: back, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
      }

      updateGroupVisibility();

      if (clearFlip.length) {
        runFilterMotion(clearFlip, []);
      }
      return;
    }

    isFiltering = true;
    var enteringSearch = !document.body.classList.contains('search-active');
    document.body.classList.add('search-active');
    if (enteringSearch) {
      preSearchScrollY = window.scrollY;
      revealResults();
    }

    var ranked = rank(q, currentIndex);
    var matchedIds = ranked.matchedIds;

    pills.forEach(function (p) {
      p.matched = ranked.lit.indexOf(p.cat) >= 0;
    });
    /* Slots for the rosette, assigned per filter so they stay put while the
       query stands. Order is CATEGORIES order, which is the order the pills
       were laid out in — neighbours on the chart stay neighbours in the ring
       instead of crossing each other on the way in. */
    var hit = pills.filter(function (p) { return p.matched; });
    hit.forEach(function (p, k) { p._slot = k; p._slotN = hit.length; });
    paintPillStates();

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

    syncCatalogMerge(matchedIds, ranked.order);

    /* "N of M tools" has to agree with the count the hero claims, so the
       denominator excludes the same things that count does: locked ghosts, the
       4 external destinations (github/gitlab/docker/youtube are not ours), the
       Recently shipped rail's clones, and Soon cards. Counting all 50 cards
       with an id produced "of 47", contradicting the hero one scroll above. */
    function countable(item) {
      return !ghost.includes(item.id) &&
             !item.el.classList.contains('external-card') &&
             !item.el.classList.contains('site-card--echo') &&
             item.el.dataset.status !== 'soon' &&
             !!item.el.closest('#tools');
    }

    var visible = currentIndex.filter(function (i) {
      return matchedIds.has(i.id) && countable(i);
    }).length;

    var total = currentIndex.filter(countable).length;

    /* Soon cards are searchable but uncountable, which would otherwise let a
       query match a card on screen and still report zero. Counted separately
       so the line describes what is actually visible without inflating M. */
    var soonVisible = currentIndex.filter(function (i) {
      return matchedIds.has(i.id) &&
             i.el.dataset.status === 'soon' &&
             !!i.el.closest('#tools');
    }).length;

    /* Same trap, second occupant. The 4 external destinations (github, gitlab,
       docker, youtube) are excluded from `countable` because they are not our
       tools and must not inflate M — but the empty-state check was reading that
       same number, so searching "github" put three cards on screen underneath
       the words "No tools match your search." Counted separately for exactly
       the reason the Soon cards above are. */
    var externalVisible = currentIndex.filter(function (i) {
      return matchedIds.has(i.id) &&
             i.el.classList.contains('external-card') &&
             !!i.el.closest('#tools');
    }).length;

    renderCategoryChips(q, ranked.lit);

    if (visible === 0 && soonVisible === 0 && externalVisible === 0) {
      noResults.classList.add('show');
      countEl.textContent = '';
    } else {
      noResults.classList.remove('show');
      var parts = [];
      if (visible > 0) parts.push(visible + ' of ' + total + ' tools');
      if (soonVisible > 0) parts.push(soonVisible + ' coming soon');
      if (externalVisible > 0) {
        parts.push(externalVisible + ' external' + (externalVisible === 1 ? '' : 's'));
      }
      countEl.textContent = parts.join(' · ');
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
      /* Two kinds of card carry no href. Multi-tool cards are <div>s whose
         sub-tool popup is wired by cards.js, and a click is the only way in.
         Soon cards are <div>s precisely so they cannot navigate anywhere; the
         click finds no handler and the scroll is the whole response. */
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
