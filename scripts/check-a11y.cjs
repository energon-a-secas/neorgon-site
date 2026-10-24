// Browser regression checks for keyboard, motion and phone behaviour on the hub.
// Serve the hub first, then: node scripts/check-a11y.cjs [http://localhost:8800]
// Uses the workspace's Playwright installation; no production dependency.
//
// What it guards, each one a defect that shipped and went unnoticed:
//   - a full Tab walk and Shift+Tab walk leave the page (the hidden terminal
//     input used to hold focus forever), with no focus stop that cannot be seen
//   - closed layers (terminal, settings, multi-tool popups, the secret section)
//     are not in the tab order, and settings returns focus on Escape
//   - nothing runs forever under reduced motion, and at rest the fold keeps to
//     a short list of known animations
//   - on a phone: no fixed control over the content, a 16px search input, and a
//     tap on a card tag does not throw the visitor back to the hero
//   - the Convex receiver does not connect during the first seconds of a visit
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const base = process.argv[2] || 'http://localhost:8800';
let checks = 0;
function check(value, message) { assert.ok(value, message); checks++; }

// Every stop the walk lands on, and whether a sighted keyboard user could see it.
function walkScript(steps, reverse) {
  return async page => {
    await page.evaluate(() => { document.activeElement && document.activeElement.blur(); window.scrollTo(0, 0); });
    const seen = [];
    let left = false;
    for (let i = 0; i < steps; i++) {
      await page.keyboard.press(reverse ? 'Shift+Tab' : 'Tab');
      const stop = await page.evaluate(() => {
        const el = document.activeElement;
        if (!el || el === document.body || el === document.documentElement) return { out: true };
        let o = 1, v = true;
        for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
          const cs = getComputedStyle(n);
          o *= parseFloat(cs.opacity);
          if (cs.visibility === 'hidden' || cs.display === 'none') v = false;
        }
        const r = el.getBoundingClientRect();
        return { id: el.id || el.className || el.tagName, opacity: o, visible: v && r.width > 0 && r.height > 0 };
      });
      if (stop.out) { left = true; break; }
      seen.push(stop);
    }
    return { seen, left };
  };
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    // ── Desktop keyboard ────────────────────────────────────────────────
    const desk = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await desk.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    const esm = [];
    page.on('request', r => { if (r.url().includes('esm.sh')) esm.push(r.url()); });
    await page.goto(base);
    await page.waitForTimeout(1500);
    // Read each stop's settled state: a control that fades in on focus is
    // visible a moment later, and that is not what this walk is hunting.
    const settle = await page.addStyleTag({ content: '*, *::before, *::after { transition: none !important; }' });

    for (const reverse of [false, true]) {
      const { seen, left } = await walkScript(600, reverse)(page);
      const invisible = seen.filter(s => s.opacity < 0.05 || !s.visible);
      check(left, `${reverse ? 'Shift+Tab' : 'Tab'} walk leaves the page (${seen.length} stops)`);
      check(invisible.length === 0, `no invisible focus stops on the ${reverse ? 'Shift+Tab' : 'Tab'} walk: ${JSON.stringify(invisible.slice(0, 5))}`);
      check(!seen.some(s => s.id === 'termInput'), 'the closed terminal input is not a Tab stop');
    }
    await settle.evaluate(el => el.remove());

    // Settings: a disclosure that closes on Escape and hands focus back.
    await page.locator('#settingsBtn').focus();
    await page.keyboard.press('Enter');
    check(await page.locator('#settingsBtn').getAttribute('aria-expanded') === 'true', 'settings button reports open');
    await page.keyboard.press('Tab');
    check(await page.evaluate(() => !!document.activeElement.closest('#settingsPanel')), 'Tab from the open settings button lands in the panel');
    check(await page.evaluate(() => [...document.querySelectorAll('.dispatch-pop, .dispatch-dock')].every(el => getComputedStyle(el).visibility === 'hidden')), 'the Antenne layer steps aside while settings is open');
    await page.keyboard.press('Escape');
    check(await page.locator('#settingsPanel').evaluate(el => !el.classList.contains('open')), 'Escape closes settings');
    check(await page.evaluate(() => document.activeElement.id) === 'settingsBtn', 'Escape returns focus to the settings button');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(100);
    check(await page.locator('#termOverlay').evaluate(el => !el.classList.contains('open')), 'the Escape that closed settings does not count toward opening the terminal');
    await page.waitForTimeout(600);
    // Opened with "," (focus does not move), Escape still closes it.
    await page.evaluate(() => document.activeElement.blur());
    await page.keyboard.press(',');
    await page.keyboard.press('Escape');
    check(await page.locator('#settingsPanel').evaluate(el => !el.classList.contains('open')), 'Escape closes settings opened with ","');
    await page.waitForTimeout(600);

    // Terminal: double Escape opens it, Escape closes it and focus comes back.
    // (Started from a card: Escape on the search field blurs it by design.)
    const card = page.locator('#tools a.site-card[data-card-id]').first();
    await card.focus();
    await page.keyboard.press('Escape'); await page.keyboard.press('Escape');
    await page.waitForTimeout(150);
    check(await page.evaluate(() => document.activeElement.id) === 'termInput', 'terminal takes focus when opened');
    await page.keyboard.press('Escape');
    check(await card.evaluate(el => document.activeElement === el), 'closing the terminal returns focus to where it was');
    // Shift+Tab out of an open terminal closes it and returns to the opener.
    await page.waitForTimeout(600);
    await page.keyboard.press('Escape'); await page.keyboard.press('Escape');
    await page.waitForTimeout(150);
    await page.keyboard.press('Shift+Tab');
    check(await page.locator('#termOverlay').evaluate(el => !el.classList.contains('open')), 'Shift+Tab out of the terminal closes it');
    check(await card.evaluate(el => document.activeElement === el), 'Shift+Tab out of the terminal returns focus to the opener');

    // A multi-tool card says it opens a popup, and the popup's links are not
    // Tab stops until it does.
    const multi = page.locator('.site-card.multi-tool[data-card-id]').first();
    check(await multi.getAttribute('aria-haspopup') === null, 'multi-tool card is a disclosure, not a menu button');
    check(await multi.evaluate(el => !!document.getElementById(el.getAttribute('aria-controls'))), 'multi-tool card points at its popup');
    check(await multi.locator('.subtool-item').first().evaluate(el => getComputedStyle(el).visibility === 'hidden'), 'closed popup links are out of the tab order');

    // At rest: only known animations may run forever (the music rings run only
    // while music plays, so they are not here).
    const running = await page.evaluate(() => document.getAnimations()
      .filter(a => a.playState === 'running' && a.effect && a.effect.getComputedTiming().iterations === Infinity)
      .map(a => a.animationName || 'unnamed'));
    check(running.length === 0, `no infinite CSS animation at rest: ${running.join(', ')}`);
    check(errors.length === 0, `no page errors: ${errors.join(' | ')}`);
    check(esm.length === 0, `the Convex receiver waits: ${esm.length} esm.sh requests in the first seconds`);
    await desk.close();

    // ── Reduced motion ──────────────────────────────────────────────────
    const calm = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
    const still = await calm.newPage();
    await still.addInitScript(() => {
      window.__raf = 0;
      const raf = window.requestAnimationFrame.bind(window);
      window.requestAnimationFrame = cb => { window.__raf++; return raf(cb); };
    });
    await still.goto(base);
    await still.waitForTimeout(1500);
    const before = await still.evaluate(() => window.__raf);
    await still.waitForTimeout(1000);
    const after = await still.evaluate(() => window.__raf);
    check(after - before < 5, `no animation loop under reduced motion (${after - before} frames requested in 1s)`);
    check(await still.evaluate(() => document.getAnimations().filter(a => a.playState === 'running').length) === 0, 'no running CSS animation under reduced motion');
    check(await still.locator('#starfield').evaluate(el => getComputedStyle(el).display !== 'none'), 'the starfield stays as a still frame');
    await calm.close();

    // ── Phone ───────────────────────────────────────────────────────────
    const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
    const tp = await phone.newPage();
    await tp.goto(base);
    await tp.waitForTimeout(1500);
    check(await tp.locator('#heroSearch').evaluate(el => parseFloat(getComputedStyle(el).fontSize)) >= 16, 'search input is 16px on a phone');
    check(await tp.locator('#termInput').evaluate(el => parseFloat(getComputedStyle(el).fontSize)) >= 16, 'terminal input is 16px on a touch screen');
    check(await tp.locator('#settingsBtn').isVisible(), 'settings stays in the header on a phone');
    const floating = await tp.evaluate(() => ['#musicToggle', '#settingsBtn'].filter(sel => {
      const el = document.querySelector(sel);
      return el && getComputedStyle(el).position === 'fixed';
    }));
    check(floating.length === 0, `no floating controls over the content: ${floating.join(', ')}`);

    // A tap on a tag deep in the catalog keeps the visitor where they were.
    const tag = tp.locator('#tools .site-card[data-card-id] .card-tag').nth(20);
    await tag.scrollIntoViewIfNeeded();
    await tp.evaluate(() => document.addEventListener('click', e => { if (e.target.closest('.site-card')) e.preventDefault(); }, true));
    const y0 = await tp.evaluate(() => scrollY);
    await tag.tap();
    await tp.waitForTimeout(300);
    check(Math.abs(await tp.evaluate(() => scrollY) - y0) < 4, 'a tap on a tag does not scroll to the hero');
    check(await tp.evaluate(() => document.activeElement.id) !== 'heroSearch', 'a tap on a tag does not focus search');
    await phone.close();

    console.log(`a11y: ${checks} checks passed`);
  } finally {
    await browser.close();
  }
})().catch(e => { console.error(e.message); process.exit(1); });
