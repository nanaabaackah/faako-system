// Run against a local build with GA configured. Never sends traffic to Google.
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const base = process.env.TTNGH_QA_URL || 'http://127.0.0.1:4189';
const id = process.env.TTNGH_QA_GA_ID || 'G-L1DK9DHYT8';
if (!['localhost', '127.0.0.1'].includes(new URL(base).hostname)) throw Error('Local QA only');
(async () => {
  const browser = await chromium.launch();
  try {
    for (const dnt of [false, true]) {
      const context = await browser.newContext();
      await context.addInitScript(value => Object.defineProperty(navigator, 'doNotTrack', { get: () => value ? '1' : '0' }), dnt);
      let tagRequests = 0;
      await context.route('**/*', route => {
        const url = new URL(route.request().url());
        if (url.origin === new URL(base).origin) return route.continue();
        if (url.hostname === 'www.googletagmanager.com') {
          assert.equal(url.searchParams.get('id'), id);
          tagRequests++;
          return route.fulfill({ contentType: 'text/javascript', body: '/* isolated tag stub */' });
        }
        return route.abort();
      });
      const page = await context.newPage();
      await page.goto(base + '/?email=private@example.org#private');
      assert.equal(await page.locator('[data-analytics-config]').getAttribute('data-measurement-id'), id);
      await page.evaluate(() => localStorage.setItem('ttngh-cookie-consent-v1', '{"analytics":true}'));
      await page.reload();
      await page.locator('[data-cookie-notice]').waitFor({ state: 'visible' });
      await page.getByRole('button', { name: 'Essential only', exact: true }).click();
      assert.equal(tagRequests, 0);
      await page.locator('[data-cookie-settings]').click();
      await page.getByRole('button', { name: 'Allow analytics', exact: true }).click();
      if (dnt) {
        assert.equal(await page.locator('script[src*="googletagmanager.com"]').count(), 0);
        assert.equal(tagRequests, 0);
      } else {
        await page.waitForFunction(() => window.dataLayer?.some(item => item[0] === 'event'));
        await page.waitForLoadState('networkidle');
        assert.equal(tagRequests, 1);
        const commands = await page.evaluate(() => window.dataLayer);
        const config = commands.find(item => item[0] === 'config');
        assert.equal(config[1], id);
        assert.equal(config[2].send_page_view, false);
        const event = commands.find(item => item[0] === 'event' && item[1] === 'page_view');
        assert.equal(event[2].send_to, id);
        assert.equal(event[2].page_location, base + '/');
        const consent = commands.find(item => item[0] === 'consent');
        assert.equal(consent[2].ad_storage, 'denied');
        await page.evaluate(() => document.dispatchEvent(new CustomEvent('ttngh:consent-changed', { detail: { analytics: true } })));
        assert.equal(await page.evaluate(() => window.dataLayer.filter(item => item[0] === 'event').length), 1);
        await page.locator('[data-cookie-settings]').click();
        await page.getByRole('button', { name: 'Essential only', exact: true }).click();
        assert.equal(await page.evaluate(id => window['ga-disable-' + id], id), true);
        await page.reload();
        assert.equal(await page.locator('script[src*="googletagmanager.com"]').count(), 0);
      }
      await context.close();
    }
    console.log('PASS: correct GA ID, opt-in only, one page view, sanitized URL, advertising denied, withdrawal, persisted refusal and Do Not Track. Google requests mocked.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
