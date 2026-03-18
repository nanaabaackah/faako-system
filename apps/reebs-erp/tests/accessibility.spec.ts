import { test } from '@playwright/test';
import { injectAxe, checkA11y } from 'axe-playwright';

const stubProducts = [
  { id: 1, name: 'Rainbow Balloon Set', specificCategory: 'Party Supplies', sourceCategoryCode: 'INVENTORY', price: 50, quantity: 4, description: 'Colorful balloons for any party.', image: '/imgs/placeholder.png' },
  { id: 2, name: 'Cotton Candy Kit', specificCategory: 'Party Supplies', sourceCategoryCode: 'INVENTORY', price: 120, quantity: 6, description: 'Everything you need for fluffy cotton candy.', image: '/imgs/placeholder.png' },
  { id: 101, name: 'Mini Bouncy Castle', specificCategory: 'Kid Bouncers', sourceCategoryCode: 'RENTAL', price: '700-900', rate: 'per day', quantity: 2, status: true, image: '/imgs/placeholder.png', page: '/Rentals/mini-bouncy-castle' },
  { id: 102, name: 'Cotton Candy Machine', specificCategory: 'Party Machines', sourceCategoryCode: 'RENTAL', price: 250, rate: 'per day', quantity: 3, status: true, image: '/imgs/placeholder.png', page: '/Rentals/cotton-candy-machine' },
];
const stubBouncyTypes = [
  { name: 'Pastel Bounce House', priceRange: 'GHS 800-1000', image: '/imgs/placeholder.png' },
  { name: 'Safari Bounce House', priceRange: 'GHS 900-1200', image: '/imgs/placeholder.png' },
];
const stubRates = {
  result: 'success',
  conversion_rates: {
    GHS: 1,
    USD: 0.08,
    CAD: 0.1,
    GBP: 0.06,
    EUR: 0.07,
    NGN: 120,
  },
};

const mockData = async (page) => {
  await page.route('**/.netlify/functions/inventory', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(stubProducts) })
  );
  await page.route('**/.netlify/functions/bouncy_castles', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(stubBouncyTypes) })
  );
  await page.route('**/v6.exchangerate-api.com/**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(stubRates) })
  );
  await page.addInitScript(() => {
    sessionStorage.setItem('popupShown', 'true');
  });
};

const dismissCookies = async (page) => {
  const accept = page.getByRole('button', { name: /accept cookies|save & continue/i });
  if (await accept.isVisible().catch(() => false)) {
    await accept.click();
  }
};

const runA11y = async (page) => {
  await injectAxe(page);
  await checkA11y(page, undefined, {
    detailedReport: true,
    detailedReportOptions: { html: true },
  });
};

const pagesToScan = [
  '/',
  '/About',
  '/Shop',
  '/Rentals',
  '/Contact',
  '/faq',
  '/Gallery',
  '/book',
  '/cart',
  '/delivery-policy',
  '/privacy-policy',
  '/terms-of-service',
  '/refund-policy',
];

test.describe('Accessibility checks', () => {
  test.beforeEach(async ({ page }) => {
    await mockData(page);
  });

  for (const path of pagesToScan) {
    test(`should have no a11y violations: ${path}`, async ({ page }) => {
      test.setTimeout(60000);
      await page.goto(path);
      await dismissCookies(page);
      await page.waitForSelector('main, #policy-main', { state: 'visible' });
      await runA11y(page);
    });
  }
});
