import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '../../../reebs-portal/node_modules/playwright/index.mjs';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const auditDirectory = process.env.PORTFOLIO_AUDIT_OUTPUT_DIR
  ? resolve(process.cwd(), process.env.PORTFOLIO_AUDIT_OUTPUT_DIR)
  : scriptDirectory;
const screenshotsDirectory = resolve(auditDirectory, 'screenshots');
const axeSource = resolve(
  scriptDirectory,
  '../../../../node_modules/.pnpm/axe-core@4.11.1/node_modules/axe-core/axe.min.js',
);
const baseUrl = process.env.PORTFOLIO_AUDIT_URL || 'http://localhost:5173';
const chromeExecutable =
  process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ||
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

await mkdir(screenshotsDirectory, { recursive: true });

const report = {
  generatedAt: new Date().toISOString(),
  baseUrl,
  screenshots: [],
  routes: [],
  consoleErrors: [],
  pageErrors: [],
  failedRequests: [],
  accessibility: [],
  interactions: {},
};

const browser = await chromium.launch({
  headless: true,
  executablePath: chromeExecutable,
});

const attachDiagnostics = (page, surface) => {
  page.on('console', (message) => {
    if (message.type() === 'error') {
      report.consoleErrors.push({
        surface,
        url: page.url(),
        text: message.text(),
      });
    }
  });
  page.on('pageerror', (error) => {
    report.pageErrors.push({ surface, url: page.url(), text: error.message });
  });
  page.on('requestfailed', (request) => {
    report.failedRequests.push({
      surface,
      url: request.url(),
      method: request.method(),
      reason: request.failure()?.errorText || 'unknown',
    });
  });
};

const waitForStablePage = async (page) => {
  await page.waitForLoadState('domcontentloaded');
  await page.locator('main').first().waitFor({ state: 'visible' });
  await page.waitForTimeout(1500);
};

const capture = async (page, name, options = {}) => {
  const path = resolve(screenshotsDirectory, `${name}.png`);
  await page.screenshot({
    path,
    fullPage: options.fullPage ?? false,
    animations: 'disabled',
  });
  report.screenshots.push({
    name,
    file: `screenshots/${name}.png`,
    url: page.url(),
    viewport: page.viewportSize(),
  });
};

const acceptConsentIfVisible = async (page) => {
  const acceptButton = page.getByRole('button', { name: /accept analytics/i });
  if (await acceptButton.isVisible().catch(() => false)) {
    await acceptButton.click();
  }
};

const collectRouteHealth = async (page, route, surface) => {
  const response = await page.goto(`${baseUrl}${route}`, { waitUntil: 'domcontentloaded' });
  await waitForStablePage(page);

  const health = await page.evaluate(() => ({
    title: document.title,
    h1Count: document.querySelectorAll('h1').length,
    mainCount: document.querySelectorAll('main').length,
    documentWidth: document.documentElement.scrollWidth,
    viewportWidth: document.documentElement.clientWidth,
    bodyWidth: document.body.scrollWidth,
    brokenImages: [...document.images]
      .filter((image) => image.complete && image.naturalWidth === 0)
      .map((image) => image.currentSrc || image.src),
  }));

  report.routes.push({
    surface,
    route,
    status: response?.status() ?? null,
    ...health,
    horizontalOverflow:
      Math.max(health.documentWidth, health.bodyWidth) > health.viewportWidth + 1,
  });
};

const runAxe = async (page, route, surface) => {
  await page.addScriptTag({ path: axeSource });
  const result = await page.evaluate(async () => {
    const axeResult = await window.axe.run(document, {
      runOnly: {
        type: 'tag',
        values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'],
      },
    });

    return axeResult.violations.map((violation) => ({
      id: violation.id,
      impact: violation.impact,
      help: violation.help,
      helpUrl: violation.helpUrl,
      nodes: violation.nodes.map((node) => ({
        target: node.target,
        summary: node.failureSummary,
        html: node.html,
      })),
    }));
  });

  report.accessibility.push({ surface, route, violations: result });
};

const desktop = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  colorScheme: 'light',
  reducedMotion: 'reduce',
});
const desktopPage = await desktop.newPage();
attachDiagnostics(desktopPage, 'desktop');

await collectRouteHealth(desktopPage, '/', 'desktop');
await capture(desktopPage, '01-desktop-home-consent');
await runAxe(desktopPage, '/', 'desktop-consent');
await acceptConsentIfVisible(desktopPage);

const liveStat = desktopPage
  .locator('.home-stats__card')
  .filter({ hasText: 'Live Systems in Production' })
  .locator('.home-stats__value');
await liveStat.scrollIntoViewIfNeeded();
await desktopPage.waitForTimeout(2500);
report.interactions.trustStat = {
  displayedValue: (await liveStat.textContent())?.trim() || '',
};
await capture(desktopPage, '02-desktop-live-stats');

await desktopPage.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded' });
await waitForStablePage(desktopPage);
await desktopPage.keyboard.press('Tab');
const firstFocus = await desktopPage.evaluate(() => {
  const element = document.activeElement;
  const style = window.getComputedStyle(element);
  return {
    tag: element?.tagName || '',
    text: element?.textContent?.trim() || '',
    href: element?.getAttribute?.('href') || '',
    outlineStyle: style.outlineStyle,
    outlineWidth: style.outlineWidth,
  };
});
report.interactions.keyboardFirstFocus = firstFocus;
await capture(desktopPage, '03-desktop-keyboard-focus');

const themeButton = desktopPage.locator('.site-nav__theme');
const themeBefore = await desktopPage.locator('html').getAttribute('data-theme');
await themeButton.click();
await desktopPage.waitForTimeout(150);
const themeAfter = await desktopPage.locator('html').getAttribute('data-theme');
report.interactions.themeToggle = { before: themeBefore, after: themeAfter };

for (const route of ['/about', '/projects', '/projects/development-tracker', '/blog', '/contact']) {
  await collectRouteHealth(desktopPage, route, 'desktop');
  await acceptConsentIfVisible(desktopPage);
  await runAxe(desktopPage, route, 'desktop');
}

await desktopPage.goto(`${baseUrl}/projects`, { waitUntil: 'domcontentloaded' });
await waitForStablePage(desktopPage);
await capture(desktopPage, '04-desktop-projects');

await desktopPage.goto(`${baseUrl}/projects/development-tracker`, {
  waitUntil: 'domcontentloaded',
});
await waitForStablePage(desktopPage);
await capture(desktopPage, '05-desktop-project-detail');

await desktopPage.goto(`${baseUrl}/contact`, { waitUntil: 'domcontentloaded' });
await waitForStablePage(desktopPage);
await desktopPage.getByRole('button', { name: /send message/i }).click();
await desktopPage.waitForTimeout(200);
report.interactions.contactValidation = {
  invalidFieldCount: await desktopPage.locator('[aria-invalid="true"]').count(),
  focusedField: await desktopPage.evaluate(() => document.activeElement?.getAttribute('name') || ''),
  errorMessages: await desktopPage.locator('.contact-form__field-error').allTextContents(),
};
await capture(desktopPage, '06-desktop-contact-validation');

const mobile = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 1,
  isMobile: true,
  hasTouch: true,
  colorScheme: 'light',
  reducedMotion: 'reduce',
});
const mobilePage = await mobile.newPage();
attachDiagnostics(mobilePage, 'mobile');

for (const route of ['/', '/projects', '/contact']) {
  await collectRouteHealth(mobilePage, route, 'mobile');
  await acceptConsentIfVisible(mobilePage);
  await runAxe(mobilePage, route, 'mobile');
}

await mobilePage.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded' });
await waitForStablePage(mobilePage);
await acceptConsentIfVisible(mobilePage);
await capture(mobilePage, '07-mobile-home');

await mobilePage.goto(`${baseUrl}/projects`, { waitUntil: 'domcontentloaded' });
await waitForStablePage(mobilePage);
await capture(mobilePage, '08-mobile-projects');

await mobilePage.goto(`${baseUrl}/contact`, { waitUntil: 'domcontentloaded' });
await waitForStablePage(mobilePage);
await mobilePage.getByRole('button', { name: /send message/i }).click();
await mobilePage.waitForTimeout(200);
report.interactions.mobileSideControls = await mobilePage.evaluate(() => {
  const selectors = [
    '.site-side-rails__social',
    '.site-side-rails__resume-tab',
  ];

  return selectors.map((selector) => {
    const element = document.querySelector(selector);
    const bounds = element?.getBoundingClientRect();
    return {
      selector,
      top: bounds?.top ?? null,
      bottom: bounds?.bottom ?? null,
      inViewport: Boolean(
        bounds &&
        bounds.top >= 0 &&
        bounds.bottom <= window.innerHeight,
      ),
    };
  });
});
await capture(mobilePage, '09-mobile-contact-validation');

await desktop.close();
await mobile.close();
await browser.close();

const reportPath = resolve(auditDirectory, 'browser-audit.json');
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);

const violationCount = report.accessibility.reduce(
  (total, entry) => total + entry.violations.length,
  0,
);
console.log(
  JSON.stringify(
    {
      report: reportPath,
      screenshots: report.screenshots.length,
      routes: report.routes.length,
      axeViolations: violationCount,
      consoleErrors: report.consoleErrors.length,
      pageErrors: report.pageErrors.length,
      failedRequests: report.failedRequests.length,
      interactions: report.interactions,
    },
    null,
    2,
  ),
);
