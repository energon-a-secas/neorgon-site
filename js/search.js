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
     group they name.

     One group is deliberately absent: **Archive**. The 1:1 rule exists to stop
     a pill filtering to nothing, and a group with no pill fails in the safe
     direction — an archived tool is still scored by name, so `skillmap` is a
     search away, it simply is not something the hero constellation offers.
     A pill would advertise the one shelf on the page we are arguing against. */
  const CATEGORIES = [
    { label: 'Planning',      color: '#4ade80', ids: ['pathfinder','doorman','loadout','floorplan'], keywords: 'floorplan team map teams groups sub-groups shared spaces bands rooms office pixel yaml profiles extends percentages allocation split org chart reorg planning visual canvas export learning roadmap pathfinder skill map strategy doorman build vs buy duplicate vendor deliverable cost estimate scope tokens engineers reverse engineer doorman fallacy loadout team meetings workload overload balance week manager distribution drag drop calendar bottle capacity' },
    { label: 'DevOps',        color: '#fbbf24', ids: ['infradrills','snippets','safeguard','lockdown','runbook'], keywords: 'devops challenges cli cheatsheet search aws kubernetes docker k8s shell terminal commands bash powershell windows wsl macos git infra drills snippets lockdown security scanner endpoints headers incident runbook alert response on-call checklist cardforge card designer editor json export rush q game builder safeguard hardening guides accounts devices privacy' },
    { label: 'Data',          color: '#2dd4bf', ids: ['jsonstudio','references','sitrep'], keywords: 'data editor privacy api search json reference matrix scrambler viewer visualizer radar sitrep santiago chile earthquakes seismic weather forecast metro transit war room situation board dashboard usgs' },
    { label: 'Productivity',  color: '#a78bfa', ids: ['slides','promptforge','ogstudio','agentlore','glassbox','stash','resume-forge','stackrank','awesomesites','rigcheck','tickbox','mosaic'], keywords: 'productivity slides export audit presentation sage yaml pptx marp og preview design generator studio resume forge gaming pdf psn steam stack rank priority lists drag drop collaboration awesome sites curated bookmarks external api whiteboard prompt forge ai prompts context pathfinder agent lore glass box claude architect certification exam agent loop subagents coordinator mcp anti-patterns planning mode config claude.md under the hood simulation stash design assets inspiration icons ui kits pixel art music sprites itch.io submissions votes wishlist json api learning tutorials ai agent cursor commands skills path rigcheck camera settings review contradict sony a6700 video shooting picture profile tickbox todo to-do tasks checklist puter offline sync account boardwright board game design tabletop zones cards deck hand tableau discard rules phases actions win conditions spec brief blueprint prototype engine agent handoff export json png playtest mosaic photo collage grid masonry heart shape layout rearrange columns thumbnail meme caption impact text background remove cutout batch resize instagram story crop reframe' },
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

  /* ── Constellation ──────────────────────────────────────────────
     The pills were a particle system: a spring toward a random home, two
     layered sine wobbles scaled by depth, pill-to-pill repulsion and damping,
     all re-solved every frame. Two separate things were wrong with it.

     The read. Planets do not jitter. A chart whose bodies wander says the
     arrangement is provisional, so no position is worth learning, which is
     the opposite of what a map is for.

     The engine. `randomPositions` was asked for twelve points at least 80px
     apart inside a box 680 wide and between 108 and 200 tall. No such
     arrangement exists. Placement gave up after 200 attempts and dropped
     pills on top of each other, and the repulsion then spent every frame
     failing to separate a layout that could not be separated. The wandering
     was a packing failure happening in public.

     Positions are derived now rather than searched: two concentric ellipses,
     fixed angles, scaled from the box, with the ellipses themselves drawn
     faintly underneath. Drawing them is the part that makes stillness
     legible. A body parked on a visible orbit reads as placed; the same body
     frozen in a random scatter reads as an animation that stopped.
  ─────────────────────────────────────────────────────────────── */
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

    /* The static layer shares the visible canvas's size and transform, so the
       two are drawn in one coordinate space and the blit is a straight copy. */
    stat.width = canvas.width;
    stat.height = canvas.height;
    sctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
    sctx.translate(canvasPad, canvasPad);
    staticDirty = true;
  }

  /* The two rings are phased against each other, and the quarter-step is the
     whole point of it. The outer ring's eight slots sit every 45deg; the inner
     ring's four sit every 90deg, so at phase 0 or 0.5 every inner pill has an
     outer pill at the *same angle*, directly behind it. Radially that is only
     `(rxOut - rxIn) * cos(angle)` apart, which at 135deg and 550px wide is 93px
     between two labels needing 116px — Productivity sat 4px inside Board Games
     before this was measured. Phase 0.25 puts the inner ring exactly between
     outer slots, which is the maximum offset available.

     Radii are fractions of the box rather than pixels, so the chart holds its
     shape from 601px (below that the mobile row takes over) up to the 680px
     cap. The binding constraint is vertical, not horizontal: what separates an
     inner pill from its outer neighbour is `(ryOut - ryIn) * H`, and every pill
     is ~28px tall no matter how small the box gets. Measured: at a 601px
     viewport (box 565x150, the worst case) the tightest pair clears by 9.8px,
     and at 680x200 by 20px. Check those before narrowing the gap between the
     two `ry`, or before lowering the height floor in css/style.css. */
  var RINGS = [
    { rx: 0.19, ry: 0.20, phase: 0.25, depth: 1.14 },
    { rx: 0.43, ry: 0.43, phase: 0,    depth: 0.84 }
  ];

  /* Every third category takes the inner orbit: for twelve that is four in
     and eight out, drawn from across CATEGORIES order instead of seating the
     first four together. */
  function ringSlots() {
    var counts = [0, 0];
    var slots = CATEGORIES.map(function (_, i) {
      var r = i % 3 === 0 ? 0 : 1;
      return { ring: r, k: counts[r]++ };
    });
    slots.forEach(function (s) { s.n = counts[s.ring]; });
    return slots;
  }

  /* Position goes on left/top, scale goes on a custom property. Splitting them
     across two properties is what lets the stylesheet own every scale change
     there is — hover, matched, unmatched, the click ping — without a script
     re-deriving a combined transform sixty times a second. */
  function layoutPills() {
    var cx = W / 2, cy = H / 2;
    pills.forEach(function (p) {
      var ring = RINGS[p.ring];
      var ang = ((p.slot + ring.phase) / p.slotN) * Math.PI * 2;
      p.x = cx + Math.cos(ang) * ring.rx * W;
      p.y = cy + Math.sin(ang) * ring.ry * H;
      p.el.style.left = p.x.toFixed(1) + 'px';
      p.el.style.top = p.y.toFixed(1) + 'px';
    });
  }

  function createPills() {
    pills.forEach(p => p.el.remove());
    pills = [];
    var slots = ringSlots();

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

      /* Depth follows the ring, not the index. Size and position now assert the
         same thing — inner is nearer — where a size derived from the index
         asserted something the layout then contradicted. The ±0.03 by slot is
         there so a ring does not render as one flat type size. */
      var s = slots[i];
      var depth = RINGS[s.ring].depth + ((s.k % 3) - 1) * 0.03;
      el.style.setProperty('--pill-depth', depth.toFixed(3));

      /* Where this pill sits along the ping's travel, 0 at the centre and 1 at
         the outermost orbit. It is the arrival time and the blip time both, so
         the DOM animation and the canvas ring cannot drift apart. */
      var wave = RINGS[s.ring].rx / RINGS[RINGS.length - 1].rx;
      el.style.animationDelay = Math.round(wave * SONAR_MS) + 'ms';

      var pill = {
        el: el,
        cat: cat,
        depth: depth,
        ring: s.ring,
        slot: s.k,
        slotN: s.n,
        wave: wave,
        x: 0, y: 0,
        matched: false,
        repelled: false
      };

      el.addEventListener('click', function () {
        var current = input.value.trim();
        var toggling = current.toLowerCase() === cat.label.toLowerCase();

        /* One ping, on the pill that was clicked. It used to also shove every
           other pill outward, which is the erratic motion arriving by a second
           route: clicking one label displaced eleven that had nothing to do
           with the query. Restarting the animation needs the class off and a
           forced reflow, or a second click inside 400ms does nothing. */
        el.classList.remove('planet-zoom');
        void el.offsetWidth;
        el.classList.add('planet-zoom');

        setTimeout(function () {
          el.classList.remove('planet-zoom');
          input.value = toggling ? '' : cat.label;
          doFilter();
          input.focus();
        }, 400);
      });

      pills.push(pill);
    });

    layoutPills();
  }

  /* ── Route map ───────────────────────────────────────────────────
     The old graph connected any two categories whose keyword blobs happened to
     share a word, then added every neighbouring pair, then wrapped last to
     first: forty-odd chords across twelve moving points, which renders as a
     hairball. It was also unreadable in principle — "Data and Fun share the
     word 'cards'" is not a relationship anyone can see in a line, so the ink
     bought nothing.

     What replaces it is geometric. Each pill links to its two nearest
     neighbours, deduped, so a link always joins things that are actually
     close. That is why a star chart connects what is near rather than what is
     thematically alike, and it is the difference between a web and a route.

     The graph used to be re-derived every fortieth frame because the pills
     drifted out from under it. They do not drift now, so it is built once per
     layout and rebuilt only on resize.

     Per-edge state (phase, speed, bow) is hashed from the pair rather than
     drawn from `Math.random`, so the same two categories get the same route
     on every load. The chart is worth learning only if it is the same chart
     twice, and that argument covers the routes as much as the positions.
  ─────────────────────────────────────────────────────────────────── */
  var connections = [];
  var edgeState = Object.create(null);
  var LINK_K = 2;

  /* FNV-1a, folded to 0..1. Any stable string-to-fraction would do; what
     matters is that it is a function of the pair and not of call order. */
  function hash(str) {
    var h = 2166136261;
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return (h >>> 0) / 4294967296;
  }

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
            phase: hash(key),
            /* Roughly half the old rate. With the pills still, the signals are
               the only motion left, so they set the tempo of the whole hero:
               a full traverse now takes ~11s instead of ~5s. */
            speed: 0.0011 + hash(key + 's') * 0.0009,
            /* Perpendicular bow. A straight chord between two points reads as
               a constraint; a bowed one reads as a path. */
            bow: (hash(key + 'b') < 0.5 ? -1 : 1) * (0.06 + hash(key + 'w') * 0.13),
            dir: hash(key + 'd') < 0.5 ? -1 : 1
          };
        }
        connections.push({ a: a, b: b, st: edgeState[key] });
      }
    }
    trimEdges();
  }

  /* ── Drawing ─────────────────────────────────────────────────────
     A quadratic bezier whose control point is offset perpendicular to the
     chord. Both the base path and the travelling highlight sample the same
     curve, so the highlight rides the line instead of near it.

     The curve is trimmed to the gap between the two pills rather than run
     centre to centre. A pill's background is `color-mix(... 8%, transparent)`,
     so a route drawn under one shows straight through it, and a signal spent
     its first and last beats crawling *behind* a label instead of arriving at
     it. Trimming is what makes the signal read as travelling between two
     things: it leaves an edge and reaches an edge.
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

  var EDGE_GAP = 7;      /* clear space between a pill's edge and its routes */
  var TRIM_STEPS = 48;   /* sampling resolution for the border crossing */

  /* Half-extents of a pill's painted box, in the same space the curve is in.
     `matched` scales a pill to 1.14, so the widest state is what the gap has
     to clear — otherwise a route that looked trimmed at rest slides under the
     label the moment its category is the one you searched for. */
  function halfBox(p, pad) {
    var s = p.depth * 1.14;
    return [p.el.offsetWidth * s / 2 + pad, p.el.offsetHeight * s / 2 + pad];
  }

  function inside(px, py, p, hb) {
    return Math.abs(px - p.x) < hb[0] && Math.abs(py - p.y) < hb[1];
  }

  /* Restricting a quadratic bezier to [t0,t1] yields another quadratic bezier,
     exactly — no polyline approximation, and the signal can keep sampling a
     single curve. */
  function subCurve(ax, ay, cx, cy, bx, by, t0, t1) {
    var p0 = bezier(ax, ay, cx, cy, bx, by, t0);
    var p1 = bezier(ax, ay, cx, cy, bx, by, t1);
    var u0 = 1 - t0, u1 = 1 - t1;
    return {
      ax: p0[0], ay: p0[1], bx: p1[0], by: p1[1],
      cx: u0 * u1 * ax + (u0 * t1 + u1 * t0) * cx + t0 * t1 * bx,
      cy: u0 * u1 * ay + (u0 * t1 + u1 * t0) * cy + t0 * t1 * by
    };
  }

  /* Positions are static, so every edge's trimmed geometry is derived once per
     layout instead of per frame. */
  function trimEdges() {
    connections.forEach(function (link) {
      var a = pills[link.a], b = pills[link.b];
      var c = control(a.x, a.y, b.x, b.y, link.st.bow);
      var ha = halfBox(a, EDGE_GAP), hb = halfBox(b, EDGE_GAP);
      var t0 = 0, t1 = 1, i, t, pt;
      for (i = 0; i <= TRIM_STEPS; i++) {
        t = i / TRIM_STEPS;
        pt = bezier(a.x, a.y, c[0], c[1], b.x, b.y, t);
        if (!inside(pt[0], pt[1], a, ha)) { t0 = t; break; }
      }
      for (i = TRIM_STEPS; i >= 0; i--) {
        t = i / TRIM_STEPS;
        pt = bezier(a.x, a.y, c[0], c[1], b.x, b.y, t);
        if (!inside(pt[0], pt[1], b, hb)) { t1 = t; break; }
      }
      /* Two pills close enough that the gap swallows the whole route: there is
         no line left to draw, and a zero-length one would render as a dot. */
      link.visible = t1 - t0 > 0.04;
      if (!link.visible) return;
      link.g = subCurve(a.x, a.y, c[0], c[1], b.x, b.y, t0, t1);

      /* Trimming the two ends is not enough on its own. Nearest-neighbour
         edges also pass clean through *third* pills — measured, 96 of 656
         stroked points landed inside a label, every one of them inside
         Productivity, the widest one and the one the inner ring's chords cross.
         A pill is `color-mix(... 8%, transparent)`, so that line is not hidden
         behind the label, it is drawn across it.

         An edge that has to tunnel under a third label is not a route anyone
         could trace anyway, so it is dropped rather than clipped into two
         pieces: a route broken in the middle reads as two unrelated routes. */
      for (i = 0; i <= TRIM_STEPS; i++) {
        t = i / TRIM_STEPS;
        pt = bezier(link.g.ax, link.g.ay, link.g.cx, link.g.cy, link.g.bx, link.g.by, t);
        for (var m = 0; m < pills.length; m++) {
          var o = pills[m];
          if (o === a || o === b) continue;
          if (inside(pt[0], pt[1], o, halfBox(o, 2))) { link.visible = false; break; }
        }
        if (!link.visible) break;
      }
    });

    /* Dropping edges can strand a pill with no route at all, which reads as a
       category that is not part of the chart. Each stranded pill gets back its
       shortest clean edge to a pill that still has one. */
    var degree = pills.map(function () { return 0; });
    connections.forEach(function (l) { if (l.visible) { degree[l.a]++; degree[l.b]++; } });
    pills.forEach(function (_, i) {
      if (degree[i] > 0) return;
      var best = null, bestLen = Infinity;
      connections.forEach(function (l) {
        if (l.visible || (l.a !== i && l.b !== i) || !l.g) return;
        var dx = l.g.bx - l.g.ax, dy = l.g.by - l.g.ay, len = dx * dx + dy * dy;
        if (len < bestLen) { bestLen = len; best = l; }
      });
      if (best) { best.visible = true; degree[best.a]++; degree[best.b]++; }
    });

    staticDirty = true;
  }

  var SIGNAL_LEN = 0.17;   /* fraction of the path the highlight occupies */
  var SIGNAL_SEGS = 5;     /* tail resolution — enough to taper, cheap to draw */

  /* ── Sonar arrival ───────────────────────────────────────────────
     The pills used to fade in on an index stagger: pill 0, then pill 1, in
     CATEGORIES order. That is an order the chart does not draw, so the
     entrance was animating a fact the reader cannot see.

     On a chart that is now explicitly two orbits, the order that means
     something is distance. One ping leaves the centre at a constant rate and
     each body appears as the front reaches it, so the inner ring answers
     first and the outer ring second because that is what the geometry says.
     Each contact sends back a small ring of its own, which is the half that
     makes it read as detection rather than as a wipe.

     The front is linear, not eased. A sonar pulse travels at one speed, and
     easing it would also mean easing every pill's delay to match or watching
     the two drift apart.
  ─────────────────────────────────────────────────────────────────── */
  var SONAR_MS = 820;      /* centre to outermost orbit */
  var SONAR_FADE = 1.3;    /* front keeps going past the last orbit, dimming */
  var BLIP_MS = 420;       /* how long one contact's return ring lives */
  var sonarStart = 0;
  var sonarRunning = false;

  function startSonar() {
    if (reducedMotion.matches) return;
    sonarStart = performance.now();
    sonarRunning = true;
  }

  function drawSonar(now) {
    var t = (now - sonarStart) / SONAR_MS;
    if (t > SONAR_FADE && t > 1 + BLIP_MS / SONAR_MS) { sonarRunning = false; return; }

    var cx = W / 2, cy = H / 2;
    var outer = RINGS[RINGS.length - 1];

    /* The front. It runs a little past the outer orbit and dies there, so the
       chart is not left with a ring sitting on its own edge. */
    if (t <= SONAR_FADE) {
      var k = t / SONAR_FADE;
      ctx.beginPath();
      ctx.ellipse(cx, cy, t * outer.rx * W, t * outer.ry * H, 0, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(192, 132, 252, ' + (0.45 * (1 - k) * (1 - k)) + ')';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    /* The returns. One expanding ring per pill the front has already passed,
       in that pill's own colour, so a contact is identifiable and not just a
       generic blip. */
    pills.forEach(function (p) {
      var age = now - sonarStart - p.wave * SONAR_MS;
      if (age < 0 || age > BLIP_MS) return;
      var a = age / BLIP_MS;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 5 + a * 30, 0, Math.PI * 2);
      ctx.strokeStyle = rgba(p.cat.color, 0.5 * (1 - a) * (1 - a));
      ctx.lineWidth = 1.6 * (1 - a) + 0.4;
      ctx.stroke();
    });
  }

  /* ── The static layer ────────────────────────────────────────────
     The orbits and the base routes are identical from frame to frame: fixed
     pills, fixed curves, and a gradient per edge that only changes when the
     matched set does. Re-deriving them 60 times a second cost ~72 canvas
     operations and 14 gradient allocations per frame for a picture that never
     differed. They are rendered once into an offscreen canvas and blitted,
     so a frame now pays one `drawImage` for all of it and spends the rest of
     its budget on the only thing that actually moves.

     Marked dirty by a re-layout and by any change to the matched set, which is
     a few times per keystroke rather than sixty times a second.
  ─────────────────────────────────────────────────────────────────── */
  var stat = document.createElement('canvas');
  var sctx = stat.getContext('2d');
  var staticDirty = true;

  function drawStatic() {
    staticDirty = false;
    sctx.clearRect(-canvasPad, -canvasPad, W + canvasPad * 2, H + canvasPad * 2);

    /* The orbits, under everything else. They are the reason a motionless pill
       reads as parked rather than as stuck, so they have to be visible — but
       only just. This is the ruled paper, not the writing, and at any weight
       where you notice it as a line it competes with the routes it carries. */
    var cx = W / 2, cy = H / 2;
    sctx.lineWidth = 1;
    sctx.strokeStyle = 'rgba(226, 232, 240, ' + (isFiltering ? 0.05 : 0.08) + ')';
    RINGS.forEach(function (ring) {
      sctx.beginPath();
      sctx.ellipse(cx, cy, ring.rx * W, ring.ry * H, 0, 0, Math.PI * 2);
      sctx.stroke();
    });

    sctx.lineCap = 'round';
    connections.forEach(function (link) {
      if (!link.visible) return;
      var a = pills[link.a], b = pills[link.b], g = link.g;
      var live = isFiltering ? (a.matched && b.matched) : true;
      var dim = isFiltering && !live;

      /* A gradient between the two pill colours, so a route is visibly a route
         *between these two* rather than generic wiring. */
      var grad = sctx.createLinearGradient(g.ax, g.ay, g.bx, g.by);
      var baseA = dim ? 0.025 : (isFiltering ? 0.34 : 0.19);
      grad.addColorStop(0, rgba(a.cat.color, baseA));
      grad.addColorStop(0.5, rgba('#ffffff', baseA * 0.45));
      grad.addColorStop(1, rgba(b.cat.color, baseA));

      sctx.beginPath();
      sctx.moveTo(g.ax, g.ay);
      sctx.quadraticCurveTo(g.cx, g.cy, g.bx, g.by);
      sctx.strokeStyle = grad;
      /* Same depth cue as the pills, so a route between two near ones is not
         hairlined into looking distant. */
      var near = (a.depth + b.depth) / 2;
      sctx.lineWidth = (live && isFiltering ? 1.3 : 0.7) * near;
      sctx.stroke();
    });
  }

  function drawRoutes(now) {
    if (staticDirty) drawStatic();
    ctx.clearRect(-canvasPad, -canvasPad, W + canvasPad * 2, H + canvasPad * 2);

    /* Routes arrive with the pills they join rather than waiting on the page
       fully drawn while their endpoints are still invisible. */
    var reveal = sonarRunning ? Math.max(0, Math.min(1, (now - sonarStart) / SONAR_MS)) : 1;
    ctx.globalAlpha = reveal;

    ctx.drawImage(stat, -canvasPad, -canvasPad, W + canvasPad * 2, H + canvasPad * 2);
    ctx.lineCap = 'round';

    connections.forEach(function (link) {
      if (!link.visible) return;
      var a = pills[link.a], b = pills[link.b], g = link.g;
      if (isFiltering && !(a.matched && b.matched)) return;

      var st = link.st;

      /* Travelling highlight. It advances every frame and wraps, and it takes
         the colour of the pill it is heading toward — which is the whole read:
         something is moving from this category to that one. Because the curve
         is trimmed, `t` 0 and 1 are now the two pill edges, so the signal is
         born at one border and dies at the other. */
      st.phase += st.speed * (isFiltering ? 1.8 : 1);
      if (st.phase > 1 + SIGNAL_LEN) st.phase = -SIGNAL_LEN;

      var toward = st.dir > 0 ? b : a;
      var head = st.dir > 0 ? st.phase : 1 - st.phase;
      var peak = isFiltering ? 0.9 : 0.62;

      for (var i = 0; i < SIGNAL_SEGS; i++) {
        var t0 = head - st.dir * (SIGNAL_LEN * i / SIGNAL_SEGS);
        var t1 = head - st.dir * (SIGNAL_LEN * (i + 1) / SIGNAL_SEGS);
        if (Math.min(t0, t1) < 0 || Math.max(t0, t1) > 1) continue;
        var p0 = bezier(g.ax, g.ay, g.cx, g.cy, g.bx, g.by, t0);
        var p1 = bezier(g.ax, g.ay, g.cx, g.cy, g.bx, g.by, t1);
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
        var hp = bezier(g.ax, g.ay, g.cx, g.cy, g.bx, g.by, head);
        [[6, 0.10], [3, 0.22]].forEach(function (ring) {
          ctx.beginPath();
          ctx.arc(hp[0], hp[1], ring[0] * (isFiltering ? 1.25 : 1), 0, Math.PI * 2);
          ctx.fillStyle = rgba(toward.cat.color, ring[1] * (isFiltering ? 1.4 : 1));
          ctx.fill();
        });
      }
    });

    ctx.globalAlpha = 1;
    if (sonarRunning) drawSonar(now);
  }

  /* ── Frame ──────────────────────────────────────────────────────
     Nothing in here moves a pill. The pills are placed once by `layoutPills`
     and re-scaled by the stylesheet; all this loop owns is the canvas: two
     orbit ellipses, the routes between pills, and the signals riding them.
     Bodies fixed, traffic between them not, which is the whole planetary
     read. It also costs one canvas repaint per frame and zero DOM writes,
     where the physics wrote a transform to twelve elements every frame and
     re-sorted 66 pairs every fortieth.
  ─────────────────────────────────────────────────────────────── */
  var isFiltering = false;

  /* Lifted out of the loop so a filter still repaints the cloud when the loop
     is not running. Under prefers-reduced-motion `tick` draws one frame and
     stops, which used to mean the pills never dimmed and never lit — the one
     readout the cloud owes a reader was the one thing motion preference
     switched off. */
  function paintPillStates() {
    pills.forEach(function (p) {
      p.el.classList.toggle('matched', p.matched && isFiltering);
      p.el.classList.toggle('repelled', !p.matched && isFiltering);
    });
    /* Base-route alpha and orbit alpha both key off the matched set, and this
       is the one function every path that changes it already calls. */
    staticDirty = true;
  }

  function tick(now) {
    drawRoutes(now || performance.now());
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
             item.el.dataset.status !== 'archived' &&
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

    /* Third occupant of the same trap. An archived tool is uncountable but
       findable, so searching "skill map" would otherwise put a card on screen
       under the words "No tools match your search." */
    var archivedVisible = currentIndex.filter(function (i) {
      return matchedIds.has(i.id) &&
             i.el.dataset.status === 'archived' &&
             !!i.el.closest('#tools');
    }).length;

    renderCategoryChips(q, ranked.lit);

    if (visible === 0 && soonVisible === 0 && externalVisible === 0 &&
        archivedVisible === 0) {
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
      if (archivedVisible > 0) parts.push(archivedVisible + ' archived');
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
    startSonar();
    tick();
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

  /* Re-derive the same layout at the new size. Two things changed here.

     It observes the box, not the window. The layout is a function of the box's
     own size, and `window.resize` is only a proxy for that — it misses a box
     that changes height because its `clamp()` crossed a breakpoint late, or
     because a font finished loading. Measured on a 609px pane, the window
     listener left `H` at 200 against a box that was 130, which put four pills
     outside their own container.

     And it re-derives rather than re-scatters. The old handler drew a fresh
     random layout here, so dragging a window edge shuffled the whole chart:
     the interaction most likely to be an accident was also the one that threw
     away everything the reader had learned about where things are. */
  new ResizeObserver(function () {
    resizeCanvas();
    layoutPills();
    buildConnections();
  }).observe(box);
})();
