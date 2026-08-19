/* ── Terminal ─────────────────────────────────────────────────────────────── */
(function () {
  const overlay = document.getElementById('termOverlay');
  const body = document.getElementById('termBody');
  const input = document.getElementById('termInput');
  const history = [];
  let histIdx = -1;

  /* ── Auth state ── */
  let authedUser = null;

  /* ── Convex HTTP client (lazy-loaded) ── */
  const CONVEX_URL = 'https://quaint-cobra-151.convex.cloud';
  let ConvexHttpClient = null;
  let convex = null;

  async function getConvex() {
    if (convex) return convex;
    if (!ConvexHttpClient) {
      const mod = await import('https://esm.sh/convex@1.21.0/browser');
      ConvexHttpClient = mod.ConvexHttpClient;
    }
    convex = new ConvexHttpClient(CONVEX_URL);
    return convex;
  }

  /* ── Client-side rate limiter (prevents Convex calls = zero cost) ── */
  const RL_KEY = 'neorgon-term-rl';
  const LOCKOUT_TIERS = [
    { threshold: 3, duration: 30_000 },
    { threshold: 5, duration: 120_000 },
    { threshold: 8, duration: 600_000 },
    { threshold: 10, duration: 1_800_000 },
  ];

  function getRateLimit() {
    try { return JSON.parse(localStorage.getItem(RL_KEY)) || { attempts: 0, lockedUntil: 0 }; }
    catch { return { attempts: 0, lockedUntil: 0 }; }
  }

  function setRateLimit(data) {
    localStorage.setItem(RL_KEY, JSON.stringify(data));
  }

  function clientLockoutDuration(attempts) {
    let d = 0;
    for (const t of LOCKOUT_TIERS) { if (attempts >= t.threshold) d = t.duration; }
    return d;
  }

  function checkClientRateLimit() {
    const rl = getRateLimit();
    const now = Date.now();
    if (rl.lockedUntil > now) {
      const secs = Math.ceil((rl.lockedUntil - now) / 1000);
      return { blocked: true, remaining: secs };
    }
    return { blocked: false };
  }

  function recordClientFailure() {
    const rl = getRateLimit();
    rl.attempts += 1;
    rl.lockedUntil = Date.now() + clientLockoutDuration(rl.attempts);
    setRateLimit(rl);
  }

  function resetClientRateLimit() {
    setRateLimit({ attempts: 0, lockedUntil: 0 });
  }

  /* ── Login banner ──────────────────────────────────────────────────────────
     The terminal used to open on one line of prose baked into index.html. A
     login banner is the shape this interface was already imitating, and it can
     carry something the prose could not: the state of the catalog at the moment
     you opened it, read from the same DOM every other command reads.

     Two wordmarks, because `.term-body` is `white-space: pre-wrap` inside a box
     that is `min(640px, 90vw)`. The block form is 66 columns and wraps into
     confetti on a phone, so the width is measured rather than assumed. */
  const BANNER_WIDE = [
    '  ███╗   ██╗███████╗ ██████╗ ██████╗  ██████╗  ██████╗ ███╗   ██╗',
    '  ████╗  ██║██╔════╝██╔═══██╗██╔══██╗██╔════╝ ██╔═══██╗████╗  ██║',
    '  ██╔██╗ ██║█████╗  ██║   ██║██████╔╝██║  ███╗██║   ██║██╔██╗ ██║',
    '  ██║╚██╗██║██╔══╝  ██║   ██║██╔══██╗██║   ██║██║   ██║██║╚██╗██║',
    '  ██║ ╚████║███████╗╚██████╔╝██║  ██║╚██████╔╝╚██████╔╝██║ ╚████║',
    '  ╚═╝  ╚═══╝╚══════╝ ╚═════╝ ╚═╝  ╚═╝ ╚═════╝  ╚═════╝ ╚═╝  ╚═══╝'
  ];
  const BANNER_NARROW = [
    '  ┌┐┌┌─┐┌─┐┬─┐┌─┐┌─┐┌┐┌',
    '  │││├┤ │ │├┬┘│ ┬│ ││││',
    '  ┘└┘└─┘└─┘┴└─└─┘└─┘┘└┘'
  ];

  /* Columns the body can actually hold, measured off a probe in the body's own
     font rather than guessed from a character-width constant that is wrong on
     every machine without the first font in the stack. */
  const FALLBACK_COLS = 80;

  function termColumns() {
    const probe = document.createElement('span');
    probe.className = 'term-line';
    probe.style.cssText = 'position:absolute;visibility:hidden;white-space:pre;';
    probe.textContent = 'M'.repeat(40);
    body.appendChild(probe);
    const per = probe.getBoundingClientRect().width / 40;
    probe.remove();
    if (!(per > 0)) return FALLBACK_COLS;

    const style = getComputedStyle(body);
    let inner = body.clientWidth -
                parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);

    /* An unlaid-out body measures 0 and this arithmetic goes negative, which
       floors to a number below every threshold and silently serves the phone
       banner to a desktop. Estimate from the box's own rule instead
       (`min(640px, 90vw)` less the body padding), and only if that is also
       unusable assume the 80 columns every terminal has had by default. */
    if (!(inner > 0)) {
      const vw = document.documentElement.clientWidth || window.innerWidth || 0;
      inner = Math.min(640, vw * 0.9) - 32;
    }
    if (!(inner > 0)) return FALLBACK_COLS;

    return Math.floor(inner / per);
  }

  const LOGIN_KEY = 'neorgon-term-login';

  /* Real last-login, the way a real MOTD means it: the stored stamp is
     overwritten on the way past, so the line always describes the previous
     visit rather than this one. */
  function lastLoginLine() {
    let prev = null;
    try { prev = localStorage.getItem(LOGIN_KEY); } catch (e) { /* private mode */ }
    try { localStorage.setItem(LOGIN_KEY, new Date().toISOString()); } catch (e) { /* ditto */ }
    if (!prev) return 'First login on this browser.';
    const d = new Date(prev);
    if (isNaN(d.getTime())) return 'First login on this browser.';
    const stamp = d.toLocaleString(undefined, {
      weekday: 'short', month: 'short', day: '2-digit',
      hour: '2-digit', minute: '2-digit'
    });
    return `Last login: ${stamp}`;
  }

  function relDaysLabel(iso) {
    const d = relDays(iso);
    if (d === null) return '';
    if (d <= 0) return ' (today)';
    return ` (${d}d ago)`;
  }

  /* `label ....... value`, the alignment every MOTD has used since before any
     of these tools existed.

     The leader narrows on a narrow terminal, and the wrapped remainder of a
     long value hangs to the value column instead of returning to the margin.
     Without it a phone renders "tools .......... 46 live · 1" and then
     "archived · 4 external" hard against the left edge, which reads as a
     second stat rather than the rest of the first one.

     The indent is derived from the leader rather than typed into the
     stylesheet: 3 spaces + label + space + dots (padded to `width`) + space
     puts the value at column `width + 5`, and `ch` is exact in a monospace
     face. One number, so the two cannot drift. */
  function statLine(label, value, width) {
    const dots = '.'.repeat(Math.max(1, width - label.length));
    const line = addLine(`   ${label} ${dots} ${value}`, 'sys');
    if (line) {
      line.style.paddingLeft = (width + 5) + 'ch';
      line.style.textIndent = '-' + (width + 5) + 'ch';
    }
  }

  function printBanner() {
    const cols = termColumns();
    const narrow = cols < 68;
    const art = narrow ? BANNER_NARROW : BANNER_WIDE;
    art.forEach(row => addLine(row, 'banner'));
    addLine('', 'sys');

    const all = catalog();
    const live = liveTools();
    const archived = all.filter(t => t.archived).length;
    const external = all.filter(t => t.external).length;
    const groups = new Set(all.filter(t => !t.locked && t.group).map(t => t.group));
    const dated = live.map(t => t.added).filter(Boolean).sort();
    const last = dated.length ? dated[dated.length - 1] : '';
    const fresh = live.filter(t => { const d = relDays(t.added); return d !== null && d <= 30; });

    addLine('  NEORGON TOOLWORKS · web terminal', 'motd');
    addLine(`  ${lastLoginLine()}`, 'sys');
    addLine('', 'sys');

    /* A 15-wide leader spends 20 of a phone's ~38 columns before the value
       starts. Narrow the leader and shorten the one value that carries three
       facts, rather than letting every line wrap. */
    const w = narrow ? 9 : 15;
    statLine('system', 'neorgon.com', w);
    statLine('tools', narrow
      ? `${live.length} live · ${archived} arch · ${external} ext`
      : `${live.length} live · ${archived} archived · ${external} external`, w);
    statLine('categories', groups.size, w);
    if (last) statLine('last ship', last + relDaysLabel(last), w);
    statLine('theme', (window.NeoHeader && window.NeoHeader.getTheme()) || 'default', w);
    addLine('', 'sys');
    if (fresh.length) {
      addLine(`  * ${fresh.length} ${fresh.length === 1 ? 'tool' : 'tools'} shipped in the last 30 days. ` +
              'Type "new" to see them.', 'motd');
    }
    addLine('  Type "help" for commands. Tab completes. Esc Esc closes.', 'sys');
    addLine('', 'sys');
  }

  /* ── Terminal open/close ── */
  function isOpen() { return overlay.classList.contains('open'); }

  let bannerShown = false;

  function openTerm() {
    overlay.classList.add('open');
    if (window._neoSound) window._neoSound.termOpen();
    /* Once per page load, like a login. Reprint on demand with "banner". */
    if (!bannerShown) { bannerShown = true; printBanner(); }
    setTimeout(() => input.focus(), 50);
  }

  function closeTerm() {
    overlay.classList.remove('open');
    if (window._neoSound) window._neoSound.termClose();
  }

  let escCount = 0;
  let escTimer = null;

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      if (isOpen()) { closeTerm(); escCount = 0; return; }
      escCount++;
      clearTimeout(escTimer);
      if (escCount >= 2) { escCount = 0; openTerm(); }
      else { escTimer = setTimeout(() => { escCount = 0; }, 500); }
    }
  });

  overlay.addEventListener('click', e => { if (e.target === overlay) closeTerm(); });

  /* ── Output helpers ── */
  function addLine(text, cls) {
    const inputRow = body.querySelector('.term-input-row');
    const line = document.createElement('div');
    line.className = 'term-line' + (cls ? ' ' + cls : '');
    line.textContent = text;
    body.insertBefore(line, inputRow);
    body.scrollTop = body.scrollHeight;
    return line;
  }

  function updatePrompt() {
    const prompt = body.querySelector('.term-prompt');
    prompt.textContent = authedUser ? `${authedUser}@neorgon ❯ ` : '~ ❯ ';
  }

  /* ── Catalog, read from the page ──────────────────────────────────────────
     `tools` and `goto` used to carry hardcoded 14-entry lists. The hub now
     ships 43 tools, so both had been wrong for months: `goto stash` reported
     "unknown site" for a site that is right there on the page. Reading the DOM
     means the terminal cannot drift from the catalog again.

     Excludes .site-card--echo — the Recently shipped rail holds clones, and
     counting them would report every recent tool twice. */
  function catalog() {
    /* Document-wide, not scoped to #tools: the three locked ghost cards live in
       the hidden secret section, and scoping to #tools made `stats` report
       "0 locked" while three ghosts sat on the page. */
    return Array.from(document.querySelectorAll('.site-card[data-card-id]'))
      .filter(el => !el.classList.contains('site-card--echo'))
      .map(el => {
        const txt = sel => ((el.querySelector(sel) || {}).textContent || '').trim();
        const group = el.closest('.card-group');
        const domain = txt('.card-domain');
        let href = el.getAttribute('href');
        if (!href) {
          const sub = el.querySelector('.card-subtool-popup a[href]');
          href = sub ? sub.getAttribute('href') : (domain ? 'https://' + domain : '');
        }
        return {
          id: el.dataset.cardId,
          name: txt('.card-name'),
          desc: txt('.card-desc'),
          domain: domain,
          added: el.dataset.added || '',
          group: group ? (group.querySelector('.group-label') || {}).textContent.trim() : '',
          groupId: group ? group.id : '',
          tags: Array.from(el.querySelectorAll('.card-tag')).map(t => t.textContent.trim()),
          locked: el.classList.contains('ghost-card'),
          external: el.classList.contains('external-card'),
          soon: el.dataset.status === 'soon',
          archived: el.dataset.status === 'archived',
          href: href,
          el: el
        };
      });
  }

  /* Live tools only — a locked ghost is not somewhere you can be sent, an
     external link is not one of ours, and a Soon tool has a reserved domain
     that serves nothing. Restricted to #tools so this matches the count the
     hero claims; the ghosts sit outside it in the secret section.

     Archived tools are excluded too, which is what keeps `random` from
     recommending the one tool the catalog has stopped recommending. `goto`
     and `whois` still reach them: resolveTool works over the whole catalog,
     so an archived tool is findable by name, just never volunteered. */
  function liveTools() {
    return catalog().filter(t =>
      !t.locked && !t.external && !t.soon && !t.archived && t.el.closest('#tools'));
  }

  /* Resolve one argument to a tool: exact id, then name, then a unique prefix.
     Ambiguity is reported rather than guessed — silently opening the wrong site
     is worse than asking which one. */
  function resolveTool(query) {
    const q = (query || '').trim().toLowerCase();
    if (!q) return { error: 'no name given' };
    const all = catalog().filter(t => !t.locked);
    const byId = all.find(t => t.id.toLowerCase() === q);
    if (byId) return { tool: byId };
    const byName = all.find(t => t.name.toLowerCase() === q);
    if (byName) return { tool: byName };
    const byDomain = all.find(t => t.domain.toLowerCase().split('.')[0] === q);
    if (byDomain) return { tool: byDomain };

    const partial = all.filter(t =>
      t.id.toLowerCase().includes(q) ||
      t.name.toLowerCase().includes(q) ||
      t.domain.toLowerCase().includes(q)
    );
    if (partial.length === 1) return { tool: partial[0] };
    if (partial.length > 1) return { ambiguous: partial };
    return { error: `no tool matches "${q}"` };
  }

  function openTool(tool) {
    /* `goto` resolves Soon tools on purpose — they are on the page and worth
       asking about — but opening one would land on a reserved domain that
       serves nothing, so it reports the state instead of proving it. */
    if (tool.soon) {
      addLine(`${tool.name} is not live yet — ${tool.domain} is reserved.`, 'err');
      addLine(`"whois ${tool.id}" for what it will be.`, 'sys');
      return;
    }
    /* Archived tools open normally — the domain is up and refusing would be a
       lie about a working site. The line above the tab is the whole warning. */
    if (tool.archived) {
      addLine(`${tool.name} is archived — still up, no longer what we'd reach for.`, 'sys');
    }
    addLine(`Opening ${tool.name} — ${tool.domain}`, 'sys');
    window.open(tool.href, '_blank', 'noopener');
  }

  function relDays(added) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(added || '');
    if (!m) return null;
    return Math.floor((Date.now() - Date.UTC(+m[1], +m[2] - 1, +m[3])) / 86400000);
  }

  /* ── Public commands (always available) ── */
  const publicCommands = {
    help() {
      addLine('Find things:', 'sys');
      addLine('  tools [cat]  — list tools, optionally one category', 'sys');
      addLine('  categories   — list categories with counts', 'sys');
      addLine('  new          — what shipped recently', 'sys');
      addLine('  search <q>   — filter the catalog', 'sys');
      addLine('  whois <tool> — details on one tool', 'sys');
      addLine('  stats        — numbers about this site', 'sys');
      addLine('', 'sys');
      addLine('Go places:', 'sys');
      addLine('  goto <tool>  — open a tool (id, name or prefix)', 'sys');
      addLine('  open <cat>   — scroll to a category', 'sys');
      addLine('  random       — open something at random', 'sys');
      addLine('', 'sys');
      addLine('Make it yours:', 'sys');
      addLine('  favs         — your saved tools', 'sys');
      addLine('  fav <tool>   — save or unsave one', 'sys');
      addLine('  pin <tool>   — hold one at the front of the shelf', 'sys');
      addLine('  theme [name] — set your theme (theme list to see them)', 'sys');
      addLine('  matrix       — toggle matrix rain (stays in terminal)', 'sys');
      addLine('  matrix background — toggle matrix & close terminal', 'sys');
      addLine('  nerv [level] — trigger NERV warning (blue/red/orange)', 'sys');
      addLine('  warp         — engage warp drive', 'sys');
      addLine('  reset-layout — restore default card order', 'sys');
      addLine('  export-layout— copy layout JSON to clipboard', 'sys');
      addLine('', 'sys');
      addLine('Housekeeping:', 'sys');
      addLine('  help         — show this message', 'sys');
      addLine('  clear        — clear terminal', 'sys');
      addLine('  banner       — reprint the login banner', 'sys');
      addLine('  whoami       — who are you?', 'sys');
      addLine('  fortune      — unsolicited advice', 'sys');
      addLine('  date         — current date', 'sys');
      addLine('  login <u> <p>— authenticate', 'sys');
      addLine('  exit         — close terminal', 'sys');
      addLine('', 'sys');
      addLine('Tab completes commands and tool names. ↑ / ↓ walk history.', 'sys');
      addLine('', 'sys');
      addLine('Cheat codes (type anywhere):', 'sys');
      addLine('  ↑↑↓↓←→←→BA  — Konami Code (warp drive)', 'sys');
      addLine('  IDDQD        — Doom god mode', 'sys');
      addLine('  ABACABB      — Mortal Kombat blood code', 'sys');
      addLine('  JUSTINBAILEY — Metroid suit mode', 'sys');
      addLine('  HESOYAM      — GTA San Andreas $$$', 'sys');
      addLine('  SEGA         — you know the sound', 'sys');
      if (authedUser) {
        addLine('', 'sys');
        addLine('Authenticated commands:', 'sys');
        addLine('  status       — auth status', 'sys');
        addLine('  unlock       — reveal secret section', 'sys');
        addLine('  ghost <id>   — hide/show a card by ID', 'sys');
        addLine('  ghost list   — show hidden cards', 'sys');
        addLine('  ghost reset  — restore all hidden cards', 'sys');
        addLine('  broadcast <m>— show toast on page', 'sys');
        addLine('  logout       — end session', 'sys');
      }
    },
    clear() {
      body.querySelectorAll('.term-line').forEach(l => l.remove());
    },
    /* `clear` is allowed to mean clear. This is how the login screen comes
       back without reloading the page. */
    banner() {
      printBanner();
    },
    motd() {
      printBanner();
    },
    warp() {
      addLine('Initiating warp sequence\u2026', 'sys');
      closeTerm();
      setTimeout(() => window.engageWarp(), 200);
    },
    tools(args) {
      const filter = (args || '').trim().toLowerCase();
      let list = liveTools();
      if (filter) {
        list = list.filter(t => t.group.toLowerCase().includes(filter));
        if (!list.length) {
          addLine(`No category matches "${filter}". Try "categories".`, 'err');
          return;
        }
      }
      let lastGroup = null;
      list.forEach(t => {
        if (t.group !== lastGroup) {
          addLine(`${lastGroup ? '\n' : ''}${t.group}`, 'sys');
          lastGroup = t.group;
        }
        addLine(`  ${t.id.padEnd(16)} ${t.name}`, 'sys');
      });
      addLine('', 'sys');
      addLine(`${list.length} ${list.length === 1 ? 'tool' : 'tools'}` +
              `${filter ? ' in ' + filter : ''}. "goto <id>" to open one.`, 'sys');
    },
    categories() {
      /* Counts every card in the group, external ones included, so this agrees
         with the category rail's chip counts. Excluding externals made Platforms
         vanish and the total read 10 where the rail shows 11. */
      const seen = new Map();
      catalog().filter(t => !t.locked && t.group).forEach(t =>
        seen.set(t.group, (seen.get(t.group) || 0) + 1));
      seen.forEach((n, group) => addLine(`  ${group.padEnd(16)} ${n}`, 'sys'));
      addLine('', 'sys');
      addLine('"open <category>" scrolls there \u00b7 "tools <category>" lists it', 'sys');
    },
    goto(args) {
      const r = resolveTool(args);
      if (r.tool) { openTool(r.tool); return; }
      if (r.ambiguous) {
        addLine(`"${args.trim()}" matches ${r.ambiguous.length} tools:`, 'err');
        r.ambiguous.forEach(t => addLine(`  ${t.id.padEnd(16)} ${t.name}`, 'sys'));
        return;
      }
      addLine(`${r.error}. Type "tools" for the list.`, 'err');
    },
    /* Scrolls the page rather than opening anything \u2014 the counterpart to goto
       for when you want to browse a section, not leave for a tool. */
    open(args) {
      const q = (args || '').trim().toLowerCase();
      if (!q) { addLine('Usage: open <category>   (see "categories")', 'err'); return; }
      const groups = Array.from(document.querySelectorAll('#tools > .card-group[id]'))
        .filter(g => !g.hasAttribute('hidden'));
      const match = groups.find(g => {
        const label = ((g.querySelector('.group-label') || {}).textContent || '').trim().toLowerCase();
        return label === q || label.includes(q) || g.id === 'group-' + q;
      });
      if (!match) { addLine(`No category matches "${q}". Try "categories".`, 'err'); return; }
      const label = ((match.querySelector('.group-label') || {}).textContent || '').trim();
      addLine(`Jumping to ${label}\u2026`, 'sys');
      closeTerm();
      /* catnav.js gives every group a `scroll-margin-top` covering the sticky
         header + rail, so scrollIntoView lands correctly without repeating that
         arithmetic here — one owner for the offset, not two that can drift. */
      setTimeout(() => {
        /* A collapsed group scrolled to is a heading with nothing under it,
           which reads as a broken jump. collapse.js owns the state; ask it
           rather than writing the attribute from here. */
        if (window._neoCollapse) window._neoCollapse.expand(match.id);
        match.scrollIntoView({ block: 'start', behavior: 'smooth' });
      }, 220);
    },
    /* Types the query into the hero search rather than reimplementing filtering,
       so the constellation, pill physics and card FLIP all still run. */
    search(args) {
      const q = (args || '').trim();
      if (!q) { addLine('Usage: search <query>', 'err'); return; }
      const field = document.getElementById('heroSearch');
      if (!field) { addLine('Search not available on this page.', 'err'); return; }
      closeTerm();
      setTimeout(() => {
        field.value = q;
        field.dispatchEvent(new Event('input', { bubbles: true }));
        field.focus();
        field.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 220);
    },
    /* Reads the rail's own data so "new" and the rail can never disagree. */
    new() {
      const recent = window._neoRecent && window._neoRecent.length
        ? window._neoRecent
        : liveTools()
            .filter(t => t.added)
            .sort((a, b) => b.added.localeCompare(a.added))
            .slice(0, 6);
      if (!recent.length) { addLine('No launch dates on the page.', 'err'); return; }
      addLine('Recently shipped:', 'sys');
      recent.forEach(t => {
        const d = relDays(t.added);
        const when = d === null ? t.added
          : d <= 0 ? 'today'
          : d === 1 ? 'yesterday'
          : d < 30 ? `${d}d ago`
          : `${Math.floor(d / 30)}mo ago`;
        addLine(`  ${t.id.padEnd(16)} ${when.padEnd(10)} ${t.name}`, 'sys');
      });
      addLine('', 'sys');
      addLine('"goto <id>" to open one.', 'sys');
    },
    /* Favorites live in js/favorites.js and localStorage. The terminal reads
       that module rather than the DOM, because the shelf on the page is built
       from the stored list and asking the page would be asking a copy. */
    favs() {
      const F = window._neoFavorites;
      if (!F) { addLine('Favorites are not available on this page.', 'err'); return; }
      const saved = F.list();
      if (!saved.length) {
        addLine('Nothing saved yet.', 'sys');
        addLine('"fav <tool>" to save one, or click the star on any card.', 'sys');
        return;
      }
      const byId = {};
      catalog().forEach(t => { byId[t.id] = t; });
      const pins = saved.filter(id => F.isPinned(id)).length;
      addLine(`${saved.length} saved${pins ? `, ${pins} pinned` : ''}:`, 'sys');
      saved.forEach(id => {
        const t = byId[id];
        const mark = F.isPinned(id) ? '📌' : '  ';
        addLine(`  ${mark} ${id.padEnd(16)} ${t ? t.name : '(gone)'}`, 'sys');
      });
      addLine('', 'sys');
      addLine('"fav <id>" to remove · "pin <id>" to hold the front', 'sys');
    },
    fav(args) {
      const F = window._neoFavorites;
      if (!F) { addLine('Favorites are not available on this page.', 'err'); return; }
      if (!(args || '').trim()) { addLine('Usage: fav <tool>   (see "favs")', 'err'); return; }
      const r = resolveTool(args);
      if (r.ambiguous) {
        addLine(`"${args.trim()}" matches ${r.ambiguous.length} tools:`, 'err');
        r.ambiguous.forEach(t => addLine(`  ${t.id.padEnd(16)} ${t.name}`, 'sys'));
        return;
      }
      if (!r.tool) { addLine(`${r.error}. Type "tools" for the list.`, 'err'); return; }
      /* null means the id names nothing the shelf can hold, so report that
         rather than claiming a removal. */
      const now = F.toggle(r.tool.id);
      if (now === null) { addLine(`${r.tool.name} is not in the catalog.`, 'err'); return; }
      addLine(now ? `Saved ${r.tool.name}.` : `Removed ${r.tool.name}.`, 'sys');
    },
    pin(args) {
      const F = window._neoFavorites;
      if (!F) { addLine('Favorites are not available on this page.', 'err'); return; }
      if (!(args || '').trim()) { addLine('Usage: pin <tool>   (see "favs")', 'err'); return; }
      const r = resolveTool(args);
      if (r.ambiguous) {
        addLine(`"${args.trim()}" matches ${r.ambiguous.length} tools:`, 'err');
        r.ambiguous.forEach(t => addLine(`  ${t.id.padEnd(16)} ${t.name}`, 'sys'));
        return;
      }
      if (!r.tool) { addLine(`${r.error}. Type "tools" for the list.`, 'err'); return; }
      const wasSaved = F.has(r.tool.id);
      const now = F.pin(r.tool.id);
      if (now === null) { addLine(`${r.tool.name} is not in the catalog.`, 'err'); return; }
      if (now && !wasSaved) addLine(`Saved and pinned ${r.tool.name}.`, 'sys');
      else addLine(now ? `Pinned ${r.tool.name}.` : `Unpinned ${r.tool.name}.`, 'sys');
    },
    random() {
      const list = liveTools();
      if (!list.length) { addLine('Nothing to pick from.', 'err'); return; }
      const pick = list[Math.floor(Math.random() * list.length)];
      addLine('Rolling\u2026', 'sys');
      addLine(`  ${pick.name} \u2014 ${pick.desc || pick.group}`, 'sys');
      openTool(pick);
    },
    whois(args) {
      const r = resolveTool(args);
      if (r.ambiguous) {
        addLine(`"${args.trim()}" matches ${r.ambiguous.length} tools:`, 'err');
        r.ambiguous.forEach(t => addLine(`  ${t.id.padEnd(16)} ${t.name}`, 'sys'));
        return;
      }
      if (!r.tool) { addLine(`${r.error}. Type "tools" for the list.`, 'err'); return; }
      const t = r.tool;
      const d = relDays(t.added);
      addLine(t.name, 'sys');
      if (t.desc) addLine(`  ${t.desc}`, 'sys');
      addLine(`  id        ${t.id}`, 'sys');
      addLine(`  category  ${t.group}`, 'sys');
      addLine(`  domain    ${t.domain}`, 'sys');
      if (t.added) addLine(`  shipped   ${t.added}${d !== null ? ` (${d}d ago)` : ''}`, 'sys');
      if (t.tags.length) addLine(`  tags      ${t.tags.join(', ')}`, 'sys');
      if (t.locked) addLine('  status    locked', 'sys');
      if (t.soon) addLine('  status    not shipped — domain reserved', 'sys');
      if (t.archived) addLine('  status    archived — still up, no longer recommended', 'sys');
      addLine('', 'sys');
      if (!t.soon) addLine(`  goto ${t.id}`, 'sys');
    },
    stats() {
      const all = catalog();
      const live = liveTools();
      const dated = live.map(t => t.added).filter(Boolean).sort();
      /* Same source as `categories` — counting groups from live tools only
         dropped Platforms (all external) and reported 10 against the rail's 11. */
      const groups = new Set(all.filter(t => !t.locked && t.group).map(t => t.group));
      const fresh = live.filter(t => { const d = relDays(t.added); return d !== null && d <= 30; });
      addLine('neorgon.com', 'sys');
      addLine(`  tools        ${live.length} live \u00b7 ${all.filter(t => t.locked).length} locked \u00b7 ` +
              `${all.filter(t => t.external).length} external \u00b7 ` +
              `${all.filter(t => t.archived).length} archived`, 'sys');
      addLine(`  categories   ${groups.size}`, 'sys');
      if (dated.length) {
        addLine(`  first ship   ${dated[0]}`, 'sys');
        addLine(`  last ship    ${dated[dated.length - 1]}`, 'sys');
      }
      addLine(`  new (30d)    ${fresh.length}`, 'sys');
      addLine(`  theme        ${(window.NeoHeader && window.NeoHeader.getTheme()) || 'default'}`, 'sys');
    },
    /* Visitor-scoped only: writes the neo_theme cookie through the header kit,
       which is the visitor's own preference. Changing the *fleet* default is a
       CDN operation and deliberately not exposed here \u2014 that belongs in an ops
       console, not a page anyone can open. */
    theme(args) {
      const arg = (args || '').trim().toLowerCase();
      const kit = window.NeoHeader;
      if (!kit || !kit.setTheme) { addLine('Header kit not loaded.', 'err'); return; }
      const ids = kit.themes || [];
      if (!arg || arg === 'list') {
        addLine(`Current: ${kit.getTheme ? kit.getTheme() : 'default'}`, 'sys');
        (kit.list || ids.map(id => ({ id: id, label: id }))).forEach(t => {
          addLine(`  ${t.id.padEnd(12)} ${t.label || ''}`, 'sys');
        });
        addLine('', 'sys');
        addLine('Usage: theme <name>   \u2014 applies to you, on every neorgon.com site', 'sys');
        return;
      }
      if (ids.indexOf(arg) === -1) {
        addLine(`Unknown theme: "${arg}". Type "theme list".`, 'err');
        return;
      }
      kit.setTheme(arg);
      addLine(`Theme set to ${arg}. Follows you across neorgon.com.`, 'sys');
    },
    fortune() {
      /* Deliberately about this workshop rather than generic fortunes \u2014 the
         terminal is the one place the site gets to have an opinion. */
      const lines = [
        'A tool you built for yourself is the only user research that never lies.',
        'The site with 43 tools started as one page with one button.',
        'Naming is the hard part. Everything else is typing.',
        'A dead link is a broken promise. Check your DNS.',
        'Ship it small. Ship it hidden. Ship it anyway.',
        'The best feature is the one you delete.',
        'Every hardcoded list becomes a lie eventually.',
        'You will rewrite this in six months and it will be better.',
        'Zero build steps, zero dependencies, zero 3am pages.',
        'If the terminal is the best part, the terminal is the product.'
      ];
      addLine(lines[Math.floor(Math.random() * lines.length)], 'sys');
    },
    whoami() {
      if (authedUser) {
        addLine(`Logged in as: ${authedUser}`, 'sys');
        addLine('Clearance level: admin', 'sys');
      } else {
        addLine('You are a visitor at neorgon.com', 'sys');
        addLine('Clearance level: explorer', 'sys');
      }
    },
    date() { addLine(new Date().toString(), 'sys'); },
    exit() { closeTerm(); },
    matrix(args) {
      if (window.toggleMatrix) {
        const isActive = window.toggleMatrix();
        const mode = isActive ? 'matrix' : 'stars';
        addLine(isActive ? 'Wake up, Neo...' : 'Welcome back to reality.', 'sys');
        if (window._neoBgSync) window._neoBgSync(mode);
        if (window._neoMusicSwitch) window._neoMusicSwitch(mode);
        if ((args || '').trim().toLowerCase() === 'background') {
          closeTerm();
        }
      } else {
        addLine('Matrix module not loaded.', 'err');
      }
    },
    nerv(args) {
      const level = (args || '').trim().toLowerCase() || 'blue';
      const valid = ['blue', 'red', 'orange'];
      if (!valid.includes(level)) {
        addLine(`Unknown level: "${level}". Use: blue, red, orange`, 'err');
        return;
      }
      if (window.nervWarning) {
        addLine(`NERV WARNING LEVEL: ${level.toUpperCase()}`, 'sys');
        closeTerm();
        setTimeout(() => window.nervWarning(level), 300);
      } else {
        addLine('Evangelion module not loaded.', 'err');
      }
    },
    'reset-layout'() {
      if (window.resetCardOrder) {
        window.resetCardOrder();
        addLine('Card order reset to default.', 'sys');
      } else {
        addLine('Layout system not loaded.', 'err');
      }
    },
    'export-layout'() {
      if (window.exportCardOrder) {
        const json = window.exportCardOrder();
        navigator.clipboard.writeText(json).then(
          () => addLine('Layout JSON copied to clipboard.', 'sys'),
          () => { addLine(json, 'sys'); addLine('(Copy manually — clipboard blocked)', 'sys'); }
        );
      } else {
        addLine('Layout system not loaded.', 'err');
      }
    },

    async login(args) {
      if (authedUser) {
        addLine(`Already logged in as ${authedUser}. Use "logout" first.`, 'err');
        return;
      }

      const parts = (args || '').trim().split(/\s+/);
      if (parts.length < 2 || !parts[0]) {
        addLine('Usage: login <username> <password>', 'err');
        return;
      }

      const [username, ...passArr] = parts;
      const password = passArr.join(' ');

      const check = checkClientRateLimit();
      if (check.blocked) {
        if (window._neoSound) window._neoSound.deny();
        addLine(`Too many attempts. Locked for ${check.remaining}s.`, 'err');
        return;
      }

      if (CONVEX_URL === '%%CONVEX_URL%%') {
        addLine('Auth backend not configured.', 'err');
        return;
      }

      addLine('Authenticating\u2026', 'sys');

      try {
        const client = await getConvex();
        const result = await client.action('auth:login', { username, password });

        if (result.ok) {
          authedUser = result.username;
          resetClientRateLimit();
          updatePrompt();
          addLine(`Welcome back, ${authedUser}.`, 'sys');
          addLine('Type "help" to see new commands.', 'sys');
        } else {
          recordClientFailure();
          if (window._neoSound) window._neoSound.deny();
          addLine(result.error || 'Invalid credentials.', 'err');
          if (result.locked) {
            addLine(`Server lockout: ${result.remaining}s remaining.`, 'err');
          }
        }
      } catch (err) {
        recordClientFailure();
        if (window._neoSound) window._neoSound.deny();
        addLine('Connection failed.', 'err');
      }
    },
  };

  /* ── Authenticated commands (require login) ── */
  const authCommands = {
    status() {
      addLine(`User: ${authedUser}`, 'sys');
      addLine(`Session: active`, 'sys');
      addLine(`Clearance: admin`, 'sys');
    },
    unlock() {
      addLine('Revealing hidden section\u2026', 'sys');
      const section = document.getElementById('secretSection');
      const btn = document.getElementById('secretToggle');
      if (section && !section.classList.contains('revealed')) {
        section.classList.add('revealed');
        btn.setAttribute('aria-expanded', 'true');
      }
      document.querySelectorAll('.ghost-card').forEach(c => { c.classList.add('unlocked'); c.setAttribute('aria-disabled', 'false'); });
      addLine('All sections unlocked.', 'sys');
    },
    broadcast(args) {
      const msg = (args || '').trim();
      if (!msg) { addLine('Usage: broadcast <message>', 'err'); return; }
      const toast = document.getElementById('arrivalToast');
      document.querySelector('.arrival-label').textContent = `${authedUser}`;
      document.getElementById('arrivalDest').textContent = msg;
      toast.classList.add('visible');
      setTimeout(() => toast.classList.remove('visible'), 4000);
      addLine('Broadcast sent.', 'sys');
    },
    ghost(args) {
      const arg = (args || '').trim().toLowerCase();
      if (!arg) {
        addLine('Usage: ghost <cardId> — toggle card visibility', 'err');
        addLine('       ghost list    — show hidden cards', 'err');
        addLine('       ghost reset   — restore all cards', 'err');
        return;
      }
      if (arg === 'list') {
        const hidden = JSON.parse(localStorage.getItem('neorgon-ghost') || '[]');
        if (!hidden.length) { addLine('No hidden cards.', 'sys'); return; }
        addLine('Hidden cards:', 'sys');
        hidden.forEach(id => addLine(`  ${id}`, 'sys'));
        return;
      }
      if (arg === 'reset') {
        localStorage.removeItem('neorgon-ghost');
        document.querySelectorAll('.sites-grid .site-card[data-card-id]').forEach(c => {
          c.style.display = '';
        });
        addLine('All cards restored.', 'sys');
        return;
      }
      const card = document.querySelector(`.sites-grid .site-card[data-card-id="${arg}"]`);
      if (!card) {
        addLine(`Unknown card: "${arg}". Check data-card-id values.`, 'err');
        return;
      }
      const hidden = JSON.parse(localStorage.getItem('neorgon-ghost') || '[]');
      const idx = hidden.indexOf(arg);
      if (idx >= 0) {
        hidden.splice(idx, 1);
        card.style.display = '';
        addLine(`Card "${arg}" restored.`, 'sys');
      } else {
        hidden.push(arg);
        card.style.display = 'none';
        addLine(`Card "${arg}" hidden.`, 'sys');
      }
      localStorage.setItem('neorgon-ghost', JSON.stringify(hidden));
    },
    logout() {
      addLine(`Goodbye, ${authedUser}.`, 'sys');
      authedUser = null;
      updatePrompt();
    },
  };

  /* ── Command execution ── */
  async function exec(raw) {
    const trimmed = raw.trim();
    if (!trimmed) return;
    history.push(trimmed);
    histIdx = history.length;

    const promptText = authedUser ? `${authedUser}@neorgon ❯ ` : '~ ❯ ';
    addLine(`${promptText}${trimmed}`, 'cmd');

    const [cmd, ...rest] = trimmed.split(/\s+/);
    const key = cmd.toLowerCase();
    const args = rest.join(' ');

    if (publicCommands[key]) {
      await publicCommands[key](args);
    } else if (authCommands[key]) {
      if (!authedUser) {
        addLine(`"${key}" requires authentication. Use "login <user> <pass>".`, 'err');
      } else {
        await authCommands[key](args);
      }
    } else {
      addLine(`command not found: ${cmd}`, 'err');
    }
  }

  /* ── Tab completion ──────────────────────────────────────────────────────
     `goto` over 43 tools is only pleasant if you do not have to remember the
     ids. Completes the command in the first word, and tool ids after any
     command that takes one. On multiple matches it fills the longest common
     prefix and prints the candidates, like a shell. */
  const TOOL_ARG_COMMANDS = ['goto', 'whois', 'ghost', 'fav', 'pin'];
  const CATEGORY_ARG_COMMANDS = ['open', 'tools'];

  function commonPrefix(list) {
    if (!list.length) return '';
    return list.reduce((acc, s) => {
      let i = 0;
      while (i < acc.length && i < s.length && acc[i] === s[i]) i++;
      return acc.slice(0, i);
    });
  }

  function completions(word, pool) {
    return pool.filter(c => c.indexOf(word) === 0);
  }

  function complete() {
    const value = input.value;
    /* A trailing space means "complete the next word", not the one just typed. */
    const words = value.split(/\s+/);
    const atNewWord = /\s$/.test(value);
    const wordIdx = atNewWord ? words.length - 1 : words.length - 1;
    const word = (atNewWord ? '' : words[wordIdx] || '').toLowerCase();

    let pool;
    if (wordIdx === 0) {
      pool = Object.keys(publicCommands).concat(authedUser ? Object.keys(authCommands) : []);
    } else {
      const cmd = words[0].toLowerCase();
      if (TOOL_ARG_COMMANDS.indexOf(cmd) !== -1) {
        pool = catalog().map(t => t.id);
      } else if (CATEGORY_ARG_COMMANDS.indexOf(cmd) !== -1) {
        pool = Array.from(new Set(liveTools().map(t => t.group.toLowerCase())));
      } else if (cmd === 'theme') {
        pool = (window.NeoHeader && window.NeoHeader.themes) || [];
      } else {
        return;
      }
    }

    const matches = completions(word, pool.sort());
    if (!matches.length) return;

    const head = words.slice(0, wordIdx);
    const filled = matches.length === 1 ? matches[0] : commonPrefix(matches);
    if (filled.length > word.length || matches.length === 1) {
      input.value = head.concat(filled).join(' ') + (matches.length === 1 ? ' ' : '');
    }
    if (matches.length > 1) {
      addLine(matches.join('   '), 'sys');
    }
  }

  /* ── Input handling ── */
  input.addEventListener('keydown', e => {
    if (e.key === 'Tab') {
      e.preventDefault();
      complete();
    } else if (e.key === 'Enter') {
      exec(input.value);
      input.value = '';
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (histIdx > 0) { histIdx--; input.value = history[histIdx]; }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (histIdx < history.length - 1) { histIdx++; input.value = history[histIdx]; }
      else { histIdx = history.length; input.value = ''; }
    }
  });

  body.addEventListener('click', () => input.focus());
})();
