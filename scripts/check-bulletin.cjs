// Browser regression checks for the native Antenne bulletin.
// Serve the hub first, then: node scripts/check-bulletin.cjs [http://localhost:8800]
// Uses the workspace's Playwright installation; no production dependency.
const assert = require('node:assert/strict');
const { chromium, webkit } = require('playwright');
const base = process.argv[2] || 'http://localhost:8800';
const isWebkit = process.env.BROWSER === 'webkit';
const engine = isWebkit ? webkit : chromium;
const browserOptions = {};
// WebKit upgrades localhost to TLS too. Strip only that directive from the
// document response in the HTTP harness; leave the production source intact.
async function prepareLocalWebkit(page) {
  if (!isWebkit || !base.startsWith('http://')) return;
  await page.route(base.replace(/\/$/, '') + '/', async route => {
    const response = await route.fetch();
    await route.fulfill({ response, body: (await response.text()).replace('upgrade-insecure-requests', '') });
  });
}
const story = (id, kind = 'feature', extra = {}) => ({ id, kind, date: '2026-09-20', title: 'A useful update', site: 'runcible-site', ...extra });
let checks = 0;
function check(value, message) { assert.ok(value, message); checks++; }

(async () => {
  const browser = await engine.launch({ headless: true });
  try {
    let feed = { posts: [story('c'), story('b', 'fix'), story('a', 'launch')] };
    const context = await browser.newContext({ ...browserOptions, viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.route('**/data/posts.json', route => route.fulfill({ json: feed, headers: { 'access-control-allow-origin': '*' } }));
    const ready = () => page.locator('.dispatch-pop, .dispatch-dock').first().waitFor();
    await prepareLocalWebkit(page);
    await page.goto(base);
    await ready();
    check(await page.locator('.dispatch-story').count() === 3, 'three latest stories');
    check(await page.locator('.dispatch-story__art .card-site-icon').count() === 3, 'catalog artwork reused');
    check(await page.locator('.dispatch-kind--fix svg').count() === 1, 'fix badge rendered');
    check(await page.locator('.dispatch-kind--launch svg').count() === 1, 'launch badge rendered');
    check(await page.locator('.dispatch-pop iframe').count() === 0, 'no embedded document');
    check(await page.locator('.dispatch-pop').evaluate(el => getComputedStyle(el).animationName) === 'none', 'reduced motion');
    await page.getByRole('button', { name: 'Dismiss fleet news' }).click();
    check(await page.locator('.dispatch-dock').evaluate(el => document.activeElement === el), 'dismiss restores focus');
    await page.reload(); await ready();
    check(await page.locator('.dispatch-pop').count() === 0, 'seen edition stays collapsed');
    await page.locator('.dispatch-dock').click();
    check(await page.locator('.dispatch-pop__close').evaluate(el => document.activeElement === el), 'reopen moves keyboard focus');
    await page.keyboard.press('Escape');
    check(await page.locator('.dispatch-pop').count() === 0, 'Escape dismisses');
    feed.posts.unshift(story('z', 'note'));
    await page.reload(); await ready();
    check(await page.locator('.dispatch-story__kind').first().textContent() === 'Note', 'same-day new story reopens');
    check(await page.locator('.dispatch-story').count() === 3, 'limit after new edition');

    const badTitle = '<img src=x onerror="window.injected=true">';
    feed = { posts: [null, {}, story('bad', 'unknown'), story('invalid-date', 'fix', { date: '2026-02-30' }), story('x', 'fix', { title: badTitle, site: null, links: [null, { url: 'javascript:alert(1)' }] }), story('x'), story('y', 'launch', { title: 'A'.repeat(250), site: null })] };
    await page.reload(); await ready();
    check(await page.locator('.dispatch-story').count() === 2, 'invalid rows and duplicate IDs ignored');
    check(await page.locator('.dispatch-story__title').last().textContent() === badTitle, 'feed markup is literal text');
    check(await page.locator('.dispatch-story__copy img').count() === 0, 'no feed HTML injected');
    check(await page.locator('.dispatch-story__fallback').count() === 2, 'unknown tools get satellite fallback');
    for (const width of [900, 1024, 1440]) {
      await page.setViewportSize({ width, height: 700 });
      check(await page.locator('.dispatch-pop').evaluate(el => el.scrollWidth <= el.clientWidth), `long title fits at ${width}`);
      check(await page.locator('.dispatch-pop').evaluate(el => el.getBoundingClientRect().bottom <= innerHeight), `panel fits at ${width}`);
    }
    await page.setViewportSize({ width: 1024, height: 400 });
    await page.locator('.dispatch-pop__footer').focus();
    check(await page.locator('.dispatch-pop__footer').evaluate(el => el.getBoundingClientRect().bottom <= innerHeight), 'footer reachable on short viewport');
    await page.setViewportSize({ width: 390, height: 844 });
    check(await page.locator('.dispatch-pop').isHidden(), 'desktop panel hides after resize');
    await context.close();

    for (const width of [320, 390, 768]) {
      const mobile = await browser.newPage({ ...browserOptions, viewport: { width, height: 844 }, reducedMotion: 'reduce' });
      let fetched = false;
      await mobile.route('**/data/posts.json', route => { fetched = true; return route.fulfill({ json: feed, headers: { 'access-control-allow-origin': '*' } }); });
      await prepareLocalWebkit(mobile);
      await mobile.goto(base); await mobile.locator('.dispatch-dock').waitFor();
      check(!fetched, `no bulletin request at ${width}`);
      check(await mobile.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `no page overflow at ${width}`);
      await mobile.locator('.dispatch-dock').click();
      await mobile.locator('.dispatch-story').first().waitFor();
      check(fetched, `mobile feed loads on demand at ${width}`);
      check(await mobile.locator('.dispatch-pop').isVisible(), `news accessible at ${width}`);
      check(await mobile.locator('.dispatch-pop').evaluate(el => el.scrollWidth <= el.clientWidth), `mobile bulletin fits at ${width}`);
      await mobile.locator('.dispatch-pop__close').focus();
      await mobile.keyboard.press('Escape');
      check(await mobile.locator('.dispatch-dock').evaluate(el => el === document.activeElement), `mobile Escape returns focus at ${width}`);
      await mobile.close();
    }

    const fallback = await browser.newPage({ ...browserOptions, viewport: { width: 1440, height: 1000 } });
    await fallback.route('**/data/posts.json', route => route.abort());
    await prepareLocalWebkit(fallback);
    await fallback.goto(base); await fallback.waitForTimeout(2800);
    check(await fallback.locator('.dispatch-pop, .dispatch-dock').count() === 0, 'unavailable feed fails quietly');
    await fallback.locator('#heroSearch').fill('parla');
    await fallback.waitForTimeout(400);
    check(await fallback.locator('#tools .site-card[data-card-id="parla"]').isVisible(), 'catalog search works without feed');
    await fallback.close();

    const recovery = await browser.newPage({ ...browserOptions, viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
    let failFeed = true;
    await recovery.route('**/data/posts.json', route => failFeed ? route.abort() : route.fulfill({ json: { posts: [story('recovered')] }, headers: { 'access-control-allow-origin': '*' } }));
    await prepareLocalWebkit(recovery);
    await recovery.goto(base);
    await recovery.locator('.dispatch-dock').click();
    await recovery.getByRole('button', { name: 'Try again' }).waitFor();
    check(await recovery.locator('.dispatch-pop__state').textContent().then(t => t.includes('unavailable')), 'mobile failure explains what happened');
    failFeed = false;
    await recovery.getByRole('button', { name: 'Try again' }).click();
    await recovery.locator('.dispatch-story').waitFor();
    check(await recovery.locator('.dispatch-pop__close').evaluate(el => el === document.activeElement), 'retry keeps a stable keyboard target');
    await recovery.locator('#heroSearch').click();
    check(await recovery.locator('.dispatch-pop').count() === 0, 'outside tap closes mobile news');
    check(await recovery.locator('#heroSearch').evaluate(el => el === document.activeElement), 'outside tap preserves its own focus');
    await recovery.close();

    const storage = await browser.newPage({ ...browserOptions, viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
    await storage.addInitScript(() => { Storage.prototype.setItem = () => { throw new Error('disabled'); }; Storage.prototype.getItem = () => { throw new Error('disabled'); }; });
    await storage.route('**/data/posts.json', route => route.fulfill({ json: { posts: [story('storage')] }, headers: { 'access-control-allow-origin': '*' } }));
    await prepareLocalWebkit(storage);
    await storage.goto(base); await storage.locator('.dispatch-pop').waitFor();
    await storage.locator('.dispatch-pop__close').click();
    check(await storage.locator('.dispatch-dock').isVisible(), 'dismiss works without storage');
    await storage.close();
    check(errors.length === 0, `no page exceptions: ${errors.join(', ')}`);
    console.log(`${checks} checks passed (${process.env.BROWSER || 'chromium'}).`);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
