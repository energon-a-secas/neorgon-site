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

  /* ── Terminal open/close ── */
  function isOpen() { return overlay.classList.contains('open'); }

  function openTerm() {
    overlay.classList.add('open');
    if (window._neoSound) window._neoSound.termOpen();
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
  }

  function updatePrompt() {
    const prompt = body.querySelector('.term-prompt');
    prompt.textContent = authedUser ? `${authedUser}@neorgon ❯ ` : '~ ❯ ';
  }

  /* ── Public commands (always available) ── */
  const publicCommands = {
    help() {
      addLine('Commands:', 'sys');
      addLine('  help         — show this message', 'sys');
      addLine('  clear        — clear terminal', 'sys');
      addLine('  warp         — engage warp drive', 'sys');
      addLine('  tools        — list all tools', 'sys');
      addLine('  goto <site>  — open a tool site', 'sys');
      addLine('  whoami       — who are you?', 'sys');
      addLine('  date         — current date', 'sys');
      addLine('  login <u> <p>— authenticate', 'sys');
      addLine('  reset-layout — restore default card order', 'sys');
      addLine('  export-layout— copy layout JSON to clipboard', 'sys');
      addLine('  matrix       — toggle matrix rain (stays in terminal)', 'sys');
      addLine('  matrix background — toggle matrix & close terminal', 'sys');
      addLine('  exit         — close terminal', 'sys');
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
    warp() {
      addLine('Initiating warp sequence\u2026', 'sys');
      closeTerm();
      setTimeout(() => window.engageWarp(), 200);
    },
    tools() {
      const tools = [
        ['ehq.cl', 'Energon HQ'],
        ['infradrills', 'Infra Drills'],
        ['skillmap', 'Skill Map'],
        ['clientsays', 'Client Says'],
        ['decisionwheel', 'Decision Wheel'],
        ['references', 'Reference Matrix'],
        ['jsonstudio', 'JSON Studio'],
        ['slides', 'Presentation Sage'],
        ['pathfinder', 'Pathfinder'],
        ['emojis', 'Emoji Archive'],
        ['memes', 'Meme Vault'],
        ['interviews', 'Vibe Check'],
        ['ogstudio', 'OG Studio'],
        ['charactersheet', 'Character Sheet'],
      ];
      tools.forEach(([key, name]) => addLine(`  ${key.padEnd(16)} ${name}`, 'sys'));
    },
    goto(args) {
      const sites = {
        'ehq': 'https://ehq.cl/', 'ehq.cl': 'https://ehq.cl/',
        'infradrills': 'https://infradrills.neorgon.com/',
        'skillmap': 'https://skillmap.neorgon.com/',
        'clientsays': 'https://clientsays.neorgon.com/',
        'decisionwheel': 'https://decisionwheel.neorgon.com/',
        'references': 'https://references.neorgon.com/',
        'jsonstudio': 'https://jsonstudio.neorgon.com/',
        'slides': 'https://slides.neorgon.com/',
        'pathfinder': 'https://pathfinder.neorgon.com/',
        'emojis': 'https://emojis.neorgon.com/',
        'memes': 'https://memes.neorgon.com/',
        'interviews': 'https://interviews.neorgon.com/',
        'ogstudio': 'https://ogstudio.neorgon.com/',
        'charactersheet': 'https://charactersheet.neorgon.com/',
      };
      const key = (args || '').trim().toLowerCase();
      if (sites[key]) { addLine(`Opening ${key}\u2026`, 'sys'); window.open(sites[key], '_blank'); }
      else { addLine(`Unknown site: "${key}". Type "tools" for the list.`, 'err'); }
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
        const result = await client.mutation('auth:login', { username, password });

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

  /* ── Input handling ── */
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
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
