// Run against `make serve`: node scripts/check-previews.cjs
const assert = require('node:assert/strict');
const { chromium, webkit } = require('playwright');
const base = process.argv[2] || 'http://localhost:8800';
const isWebkit = process.env.BROWSER === 'webkit';
let count = 0;
function check(value, message) { assert.ok(value, message); count++; }
async function prepare(page, enabled = false) {
  if (isWebkit && base.startsWith('http://')) {
    await page.route(base.replace(/\/$/, '') + '/', async route => {
      const response = await route.fetch();
      await route.fulfill({ response, body: (await response.text()).replace('upgrade-insecure-requests', '') });
    });
  }
  await page.addInitScript(enabled => localStorage.setItem('neorgon-prefs', JSON.stringify({ previews: enabled, sound: false, glow: false })), enabled);
  await page.route('**/data/posts.json', route => route.fulfill({ json: { posts: [] }, headers: { 'access-control-allow-origin': '*' } }));
}
(async () => {
  const browser = await (isWebkit ? webkit : chromium).launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    let gifRequests = 0;
    page.on('request', request => { if (/assets\/previews\/.*\.gif/.test(request.url())) gifRequests++; });
    await prepare(page);
    await page.goto(base);
    await page.locator('#heroSearch').fill('quiz');
    const quiz = page.locator('#tools .site-card[data-card-id="quiz"]');
    await quiz.waitFor({ state: 'visible' });
    await quiz.hover(); await page.waitForTimeout(1400);
    check(gifRequests === 0, 'disabled previews make no GIF requests');
    check(await quiz.locator('.card-preview-toggle').isHidden(), 'disabled preview control is not a tab stop');
    await page.locator('#settingsBtn').click();
    await page.locator('#togPreviews').click();
    await page.locator('#settingsBtn').click();
    check(await quiz.locator('.card-preview-toggle').isVisible(), 'settings exposes explicit controls');
    const urlBefore = page.url();
    await quiz.locator('.card-preview-toggle').focus();
    await page.keyboard.press('Enter');
    await quiz.locator('.card-preview canvas').waitFor();
    check(page.url() === urlBefore, 'Enter on preview does not navigate the card');
    check(await quiz.locator('.card-preview img').count() === 0, 'reduced motion paints no animated image');
    check(await quiz.locator('canvas').evaluate(c => c.width > 0 && c.getContext('2d').getImageData(0, 0, c.width, c.height).data.some(v => v !== 0)), 'still frame contains image pixels');
    check(await quiz.locator('.card-preview-close').evaluate(el => document.activeElement === el), 'explicit preview focuses close');
    const clone = await quiz.evaluate(card => { const echo = window._neoMakeEcho(card); return { previews: echo.querySelectorAll('.card-preview').length, pressed: echo.querySelector('.card-preview-toggle').getAttribute('aria-pressed') }; });
    check(clone.previews === 0 && clone.pressed === 'false', 'shelf cloning excludes transient preview state');
    await page.keyboard.press('Escape');
    check(await quiz.locator('.card-preview').count() === 0, 'Escape removes preview');
    check(await quiz.locator('.card-preview-toggle').evaluate(el => el === document.activeElement), 'Escape restores trigger focus');
    await page.keyboard.press(' ');
    await quiz.locator('canvas').waitFor();
    check(await quiz.locator('.card-preview').count() === 1, 'Space also opens preview');
    await page.keyboard.press('Tab');
    check(await quiz.locator('.card-preview').count() === 0, 'tabbing away closes preview');

    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await quiz.locator('.card-preview-toggle').click();
    await quiz.locator('.card-preview img').waitFor();
    check(await quiz.locator('.card-preview img').evaluate(i => i.complete && i.naturalWidth > 0), 'motion-enabled preview loads GIF');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await quiz.locator('.card-preview canvas').waitFor();
    check(await quiz.locator('.card-preview img').count() === 0, 'motion preference changes replace the animated image');
    await page.keyboard.press('Escape');

    await page.mouse.move(0, 0); await quiz.hover();
    await quiz.locator('.card-preview canvas').waitFor();
    check(await quiz.locator('.card-preview-toggle').getAttribute('aria-pressed') === 'true', 'hover still works with a static preview');
    await page.mouse.move(0, 0);
    check(await quiz.locator('.card-preview').count() === 0, 'pointer exit cancels hover preview');
    await quiz.hover(); await quiz.locator('.card-preview canvas').waitFor();
    await page.locator('#heroSearch').focus();
    check(await quiz.locator('.card-preview').count() === 0, 'moving keyboard focus away closes hover previews');
    await page.mouse.move(0, 0); await quiz.hover();
    await quiz.locator('.card-preview canvas').waitFor();
    await page.locator('#heroSearch').fill('quiz ');
    check(await quiz.locator('.card-preview').count() === 0, 'editing search releases previews before filtering');
    await quiz.locator('.fav-toggle').click();
    await page.locator('#heroSearch').fill('');
    const favorite = page.locator('#favShelf .site-card[data-echo-id="quiz"]');
    await favorite.locator('.card-preview-toggle').focus();
    await page.keyboard.press('Enter');
    await favorite.locator('canvas').waitFor();
    check(await favorite.locator('.card-preview').count() === 1, 'new favorite echoes support delegated preview controls');
    await page.keyboard.press('Escape');

    await page.route('**/assets/previews/primer.gif', route => route.abort());
    await page.locator('#heroSearch').fill('primer');
    const primer = page.locator('#tools [data-card-id="primer"]');
    await primer.locator('.card-preview-toggle').click();
    await primer.getByText('Preview unavailable. You can still open the tool.').waitFor();
    check(await primer.locator('.card-preview-close').isVisible(), 'failed asset leaves a usable close control');
    await page.keyboard.press('Escape');
    await page.locator('#settingsBtn').click(); await page.locator('#togPreviews').click();
    check(await primer.locator('.card-preview-toggle').isHidden(), 'turning previews off hides controls immediately');
    check(await page.locator('.card-preview').count() === 0, 'turning previews off removes active layers');
    check(errors.length === 0, `no page exceptions: ${errors.join(', ')}`);
    await page.close();

    const touch = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
    await prepare(touch, true);
    await touch.goto(base);
    await touch.locator('#heroSearch').fill('quiz');
    const touchCard = touch.locator('#tools [data-card-id="quiz"]');
    await touchCard.locator('.card-preview-toggle').tap();
    await touchCard.locator('canvas').waitFor();
    check(await touchCard.locator('.card-preview-toggle').evaluate(el => el.getBoundingClientRect().width >= 44), 'touch preview target is at least 44px');
    check(await touchCard.locator('canvas').isVisible(), 'touch can open a visible static preview');
    check(await touch.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'touch preview introduces no horizontal overflow');
    await touchCard.locator('.card-preview-close').tap();
    check(await touchCard.locator('.card-preview').count() === 0, 'touch close works');
    await touch.route('https://quiz.neorgon.com/**', route => route.fulfill({ contentType: 'text/html', body: '<title>Tool destination</title>' }));
    await touchCard.locator('.card-name').tap();
    await touch.waitForURL('https://quiz.neorgon.com/**');
    check(touch.url().startsWith('https://quiz.neorgon.com/'), 'ordinary card taps still navigate');
    await touch.close();
    console.log(`${count} preview checks passed (${isWebkit ? 'webkit' : 'chromium'}).`);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
