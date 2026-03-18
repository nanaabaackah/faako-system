import { test, expect, Page } from '@playwright/test';
import { injectAxe, checkA11y } from 'axe-playwright';

const stubProducts = [
  { id: 1, name: 'Rainbow Balloon Set', specificCategory: 'Party Supplies', sourceCategoryCode: 'INVENTORY', price: 50, quantity: 4, description: 'Colorful balloons for any party.', image: '/imgs/placeholder.png' },
  { id: 2, name: 'Cotton Candy Kit', specificCategory: 'Party Supplies', sourceCategoryCode: 'INVENTORY', price: 120, quantity: 6, description: 'Everything you need for fluffy cotton candy.', image: '/imgs/placeholder.png' },
  { id: 3, name: 'Kids Headphones', specificCategory: "Kid's Toys", sourceCategoryCode: 'INVENTORY', price: 220, quantity: 3, description: 'Safe volume limit for kids.', image: '/imgs/placeholder.png' },
  { id: 101, name: 'Mini Bouncy Castle', specificCategory: 'Kid Bouncers', sourceCategoryCode: 'RENTAL', price: '700-900', rate: 'per day', quantity: 2, status: true, image: '/imgs/placeholder.png', page: '/Rentals/mini-bouncy-castle' },
  { id: 102, name: 'Cotton Candy Machine', specificCategory: 'Party Machines', sourceCategoryCode: 'RENTAL', price: 250, rate: 'per day', quantity: 3, status: true, image: '/imgs/placeholder.png', page: '/Rentals/cotton-candy-machine' },
  { id: 103, name: 'Trampoline', specificCategory: 'Kid Bouncers', sourceCategoryCode: 'RENTAL', price: 600, rate: 'per hour', quantity: 1, status: 'Limited', image: '/imgs/placeholder.png', page: '/Rentals/trampoline' },
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
const stubAdminUser = {
  id: 1,
  firstName: 'Admin',
  lastName: 'User',
  role: 'admin',
  email: 'admin@reebs.test',
};
const stubOrderStats = {
  windowDays: 30,
  orders: 0,
  revenue: 0,
  units: 0,
  bookings: 0,
  bookingRevenue: 0,
  operatingExpenses: 0,
  operatingExpensesWindow: 0,
  operatingExpensesTotal: 0,
  expenseWindowLabel: 'Last 30 days',
  maintenanceOpen: 0,
  maintenanceCost: 0,
  lockedInNextQuarter: 0,
  nextQuarterLabel: 'Next quarter',
  conflicts: [],
  topRentalBookings: [],
  topProducts: [],
  lowStockCount: 0,
  lowStockItems: [],
};
const stubAnalytics = {
  inventoryValue: 0,
  retailRevenue: 0,
  rentalRevenue: 0,
  categories: [],
  velocity: [],
};
const stubUserStats = {
  orders: 0,
  orderRevenue: 0,
  bookings: 0,
  bookingRevenue: 0,
  stockMovements: 0,
  details: { orders: [], bookings: [], stockMovements: [] },
};
const stubFinancials = {
  revenueByCategory: { retail: 0, rental: 0, other: 0 },
  cashflow: [],
  topProducts: [],
  topRentals: [],
  revenue: 0,
  startDate: null,
  endDate: null,
  windowLabel: 'All time',
};
const stubFinance = {
  summary: null,
  transactions: [],
  expenseWindowLabel: 'All time',
};
const stubTimesheets = {
  activeShift: null,
  history: [],
  totals: { weeklyHours: 0, monthlyHours: 0, weeklyShifts: 0, monthlyShifts: 0 },
};

// Accessibility helper; share across page groups
async function runA11y(page: Page) {
  await injectAxe(page);
  await checkA11y(page, undefined, {
    detailedReport: true,
    detailedReportOptions: { html: true },
  });
}

// Escape a string for safe use inside RegExp
const escapeRegex = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const mockData = async (page: Page) => {
  const fixtures: Record<string, unknown> = {
    analytics: stubAnalytics,
    bouncy_castles: stubBouncyTypes,
    bookings: [],
    createOrder: { id: 1, orderNumber: 'ORD-1' },
    customers: [],
    deliveries: [],
    documents: [],
    expenses: [],
    finance: stubFinance,
    financials: stubFinancials,
    generateInvoice: {},
    geocode: {},
    getInvoiceDetails: {},
    hr: [],
    indoor_games: [],
    inventory: stubProducts,
    login: stubAdminUser,
    maintenance: [],
    marketing: [],
    orderStats: stubOrderStats,
    orders: [],
    stock: { newStock: 0, lastUpdatedAt: '2024-01-01T00:00:00.000Z', lastUpdatedByName: 'Admin User' },
    stockActivity: [],
    timesheets: stubTimesheets,
    userStats: stubUserStats,
    users: [],
    vendors: [],
  };

  await page.route('**/.netlify/functions/**', (route) => {
    const url = new URL(route.request().url());
    const endpoint = url.pathname.split('/').pop() || '';
    const payload = fixtures[endpoint] ?? {};
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(payload) });
  });
  await page.route('**/v6.exchangerate-api.com/**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(stubRates) })
  );
  await page.addInitScript(() => {
    sessionStorage.setItem('popupShown', 'true');
  });
};

const dismissCookies = async (page: Page) => {
  const accept = page.getByRole('button', { name: /accept cookies|save & continue/i });
  if (await accept.isVisible().catch(() => false)) {
    await accept.click();
  }
};

const noFatalConsoleErrors = async (page: Page) => {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  await page.reload();
  expect(errors.join('\n')).not.toMatch(/TypeError|ReferenceError/);
};

const seedAuth = async (page: Page, user = stubAdminUser) => {
  await page.addInitScript((authUser) => {
    localStorage.setItem('reebs_auth_user', JSON.stringify(authUser));
  }, user);
};

test.describe('REEBS Party Themes Pages', () => {
  test.beforeEach(async ({ page }) => {
    await mockData(page);
  });

  // -----------------------------
  // HOME PAGE TESTS
  // -----------------------------
  test.describe('Home Page', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/', { waitUntil: 'networkidle' });
      await dismissCookies(page);
    });

    test('renders hero heading and buttons', async ({ page }) => {
      await expect(page.getByRole('heading', { name: /reebs/i })).toBeVisible();
      await expect(page.getByText(/view rentals/i)).toBeVisible();
      await expect(page.getByText(/explore our shop/i)).toBeVisible();
      await expect(page.getByText(/talk to us/i)).toBeVisible();
    });

    test('renders Why Choose Us and Services', async ({ page }) => {
      await expect(page.getByText(/why choose us/i)).toBeVisible();
      await expect(page.getByRole('heading', { name: /simple, less hustle/i })).toBeVisible();
      await expect(page.getByRole('heading', { name: /our services/i })).toBeVisible();
    });

    test('renders flow steps and popular picks', async ({ page }) => {
      await expect(page.getByRole('heading', { name: /from idea to confetti/i })).toBeVisible();
      await expect(page.locator('.about-step-list li').first()).toBeVisible();
      await expect(page.getByRole('heading', { name: /popular picks right now/i })).toBeVisible();
      await expect(page.locator('.suggested-card').first()).toBeVisible();
    });

    test('skip link exists in DOM', async ({ page }) => {
      const skipLink = page.getByRole('link', { name: /skip to main content/i });
      await expect(skipLink).toBeVisible();
    });

    test('no fatal console errors', async ({ page }) => {
      await noFatalConsoleErrors(page);
    });

    test('passes accessibility scan', async ({ page }) => {
  // Wait for the main content to load before scanning
      await page.waitForSelector('main', { state: 'visible' });

      // Extend just this test’s timeout (e.g., 60s)
      test.setTimeout(60000);

      await runA11y(page);
    });
  });

  // -----------------------------
  // ABOUT PAGE TESTS
  // -----------------------------
  test.describe('About Page', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/about'); // ✅ relative
      await dismissCookies(page);
    });

    test('renders hero heading and intro text', async ({ page }) => {
      await expect(page.getByRole('heading', { name: /sleek setups\. joyful memories\./i })).toBeVisible();
      await expect(page.getByText(/design-forward celebrations/i)).toBeVisible();
    });

    test('renders Meet the Owner section with image', async ({ page }) => {
      await expect(page.getByRole('heading', { name: /meet the owner/i })).toBeVisible();

      // More specific: match the portrait alt text
      await expect(
        page.getByRole('img', {
          name: /portrait of sabina ackah, founder of reebs party themes/i,
        })
      ).toBeVisible();
    });

    test('renders Our Story section', async ({ page }) => {
      await expect(page.getByRole('heading', { name: /our mission & promise/i })).toBeVisible();
      await expect(page.getByText(/memorable without the mayhem/i)).toBeVisible();
    });

    test('renders values section', async ({ page }) => {
      await expect(page.getByRole('heading', { name: /values you can feel on party day/i })).toBeVisible();
      await expect(page.locator('.about-values-grid li').first()).toBeVisible();
    });

    test('no fatal console errors', async ({ page }) => {
      await noFatalConsoleErrors(page);
    });

    test('passes accessibility scan', async ({ page }) => {
      // Wait for the main content to load before scanning
      await page.waitForSelector('main', { state: 'visible' });

      // Extend just this test’s timeout (e.g., 60s)
      test.setTimeout(60000);

      await runA11y(page);
    });
  });

  // -----------------------------
  // SHOP PAGE TESTS
  // -----------------------------
  test.describe('Shop Page', () => {
    test.beforeEach(async ({ page }) => {
      await seedAuth(page);
      await page.goto('/shop'); // ✅ relative
      await dismissCookies(page);
    });

    test('renders Shop heading and intro text', async ({ page }) => {
      await expect(page.getByRole('heading', { name: /shop/i })).toBeVisible();
      await expect(page.getByText(/party supplies/i)).toBeVisible();
    });

    test('renders search bar and category filter', async ({ page }) => {
      await expect(page.getByLabel(/search products/i)).toBeVisible();
      await expect(page.locator('.filter-chips .filter-chip').first()).toBeVisible();
    });


    test('renders product cards if inventory is available', async ({ page }) => {
      const products = page.locator('.shop-card');
      await expect(products.first()).toBeVisible();
    });

    test('filters products and updates cart state after add', async ({ page }) => {
      const products = page.locator('.shop-card');
      await expect(products.first()).toBeVisible();

      const firstName = (await products.first().locator('h3').innerText()).trim();
      const searchTerm = firstName.split(' ')[0] || firstName;

      await page.getByLabel(/search products/i).fill(searchTerm);
      await page.waitForTimeout(300);

      await expect(products.first()).toContainText(new RegExp(escapeRegex(searchTerm), 'i'));

      await products.first().getByRole('button', { name: /add to cart/i }).click();
      await expect(products.first().locator('.main-quantity-controls')).toBeVisible();
      await expect(products.first()).toContainText(firstName);
    });

    test('applies a category filter chip when available', async ({ page }) => {
      const chips = page.locator('.filter-chips button');
      if ((await chips.count()) < 2) return; // only "All" exists

      const targetChip = chips.nth(1);
      const label = (await targetChip.innerText()).trim();
      await targetChip.click();

      await expect(page.locator('.shop-card .shop-pill').first()).toHaveText(new RegExp(escapeRegex(label), 'i'));
    });

    test('no fatal console errors', async ({ page }) => {
      await noFatalConsoleErrors(page);
    });

    test('passes accessibility scan', async ({ page }) => {
      // Wait for the main content to load before scanning
      await page.waitForSelector('main', { state: 'visible' });

      // Extend just this test’s timeout (e.g., 60s)
      test.setTimeout(60000);

      await runA11y(page);
    });
  });

  // -----------------------------
  // RENTALS PAGE TESTS
  // -----------------------------
  test.describe('Rentals Page', () => {
    test.beforeEach(async ({ page }) => {
      await seedAuth(page);
      await page.goto('/rentals'); // ✅ relative
      await dismissCookies(page);
    });

    test('renders Rentals heading and intro text', async ({ page }) => {
      await expect(page.getByRole('heading', { name: /party rentals styled the reebs way/i })).toBeVisible();
      await expect(page.getByText(/bounce houses, decor, concessions/i)).toBeVisible();
    });

    test('renders side menu categories', async ({ page }) => {
      const sideMenu = page.locator('.side-menu');
      await expect(sideMenu).toBeVisible();
      await expect(sideMenu.locator('li').first()).toBeVisible();
    });

    test('renders rental cards for a category', async ({ page }) => {
      const rentalCard = page.locator('.rent-card').first();
      await expect(rentalCard).toBeVisible();
    });

    test('searches rentals and opens detail page', async ({ page }) => {
      const firstCard = page.locator('.rent-card').first();
      await expect(firstCard).toBeVisible();

      const rentalName = (await firstCard.locator('h3').innerText()).trim();
      const term = rentalName.split(' ')[0] || rentalName;

      await page.getByLabel(/search rental items/i).fill(term);
      await page.waitForTimeout(200);

      await expect(page.locator('.rent-card').first()).toContainText(new RegExp(escapeRegex(term), 'i'));

      await firstCard.click();
      await expect(page).toHaveURL(/\/Rentals\//i);
      await expect(page.getByRole('heading', { level: 1 })).toContainText(new RegExp(escapeRegex(rentalName.split(' ')[0]), 'i'));
    });

    test('no fatal console errors', async ({ page }) => {
      await noFatalConsoleErrors(page);
    });

    test('passes accessibility scan', async ({ page }) => {
      // Wait for the main content to load before scanning
      await page.waitForSelector('main', { state: 'visible' });

      // Extend just this test’s timeout (e.g., 60s)
      test.setTimeout(60000);

      await runA11y(page);
    });
  });

  // -----------------------------
  // BOOK PAGE TESTS
  // -----------------------------
  test.describe('Book Page', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/book');
      await dismissCookies(page);
    });

    test('renders booking hero and form fields', async ({ page }) => {
      await expect(page.getByRole('heading', { name: /reserve your rentals/i })).toBeVisible();
      await expect(page.getByRole('link', { name: /start booking/i })).toBeVisible();
      await expect(page.getByLabel('Name')).toBeRequired();
      await expect(page.getByLabel('Email')).toBeRequired();
      await expect(page.getByLabel(/phone \/ whatsapp/i)).toBeRequired();
      await expect(page.getByLabel(/event date/i)).toBeRequired();
      await expect(page.getByLabel(/location \/ venue/i)).toBeRequired();
      await expect(page.getByLabel(/rental picks & notes/i)).toBeRequired();
    });

    test('adds a rental to the selection list', async ({ page }) => {
      const rentalCard = page.locator('.booking-rental-card').first();
      await expect(rentalCard).toBeVisible();

      const toggle = rentalCard.getByRole('button', { name: /add to booking/i });
      await toggle.click();

      await expect(toggle).toHaveText(/remove/i);
      await expect(page.locator('.booking-selected-chips')).toBeVisible();
    });
  });

  // -----------------------------
  // CONTACT PAGE TESTS
  // -----------------------------
  test.describe('Contact Page', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/contact');
      await dismissCookies(page);
    });

    test('renders hero content and quick contact actions', async ({ page }) => {
      await expect(page.getByRole('heading', { name: /contact reebs/i })).toBeVisible();
      await expect(page.getByRole('link', { name: /call us/i })).toHaveAttribute('href', /tel:\+?233/);
      await expect(page.getByRole('link', { name: /whatsapp/i })).toBeVisible();
      await expect(page.getByRole('link', { name: /plan my setup/i })).toBeVisible();
    });

    test('shows contact cards and social links', async ({ page }) => {
      await expect(page.getByRole('heading', { name: /talk to a human/i })).toBeVisible();
      await expect(page.getByRole('heading', { name: /send a brief/i })).toBeVisible();
      await expect(page.getByRole('link', { name: /instagram/i })).toBeVisible();
      await expect(page.getByRole('link', { name: /tiktok/i })).toBeVisible();
    });

    test('contact form requires key fields', async ({ page }) => {
      await expect(page.getByLabel('Name')).toBeEditable();
      await expect(page.getByLabel('Name')).toBeRequired();
      await expect(page.getByLabel('Email')).toBeRequired();
      await expect(page.getByLabel('Phone number')).toBeRequired();
      await expect(page.getByLabel('What do you need?')).toBeRequired();
      await expect(page.getByLabel('Event date')).toBeRequired();
      await expect(page.getByLabel('Tell us more')).toBeRequired();
    });

    test('passes accessibility scan', async ({ page }) => {
      await page.waitForSelector('main', { state: 'visible' });
      test.setTimeout(60000);
      await runA11y(page);
    });
  });

  // -----------------------------
  // CART PAGE TESTS
  // -----------------------------
  test.describe('Cart Page', () => {
    test('shows empty cart state', async ({ page }) => {
      await page.goto('/cart');
      await expect(page.getByRole('heading', { name: /your cart/i })).toBeVisible();
      await expect(page.getByText(/cart feels a little lonely/i)).toBeVisible();
      await expect(page.getByRole('link', { name: /browse shop/i })).toBeVisible();
    });

    test('renders line items from storage', async ({ page }) => {
      const seededCart = [
        {
          id: 1,
          name: 'Rainbow Balloon Set',
          price: 50,
          quantity: 4,
          cartQuantity: 2,
          specificCategory: 'Party Supplies',
          image: '/imgs/placeholder.png',
        },
      ];

      await page.addInitScript((cart) => {
        localStorage.setItem('cart', JSON.stringify(cart));
        localStorage.setItem('currency', 'GHS');
      }, seededCart);

      await page.goto('/cart');
      await expect(page.getByText(/rainbow balloon set/i)).toBeVisible();
      await expect(page.getByLabel(/rainbow balloon set quantity/i)).toHaveValue('2');
      await expect(page.getByRole('button', { name: /remove rainbow balloon set/i })).toBeVisible();
    });
  });

  // -----------------------------
  // LOGIN PAGE TESTS
  // -----------------------------
  test.describe('Login Page', () => {
    test('renders login form fields and toggle', async ({ page }) => {
      await page.goto('/login');
      await expect(page.getByRole('heading', { name: /sign in/i })).toBeVisible();

      const passwordInput = page.getByLabel(/password/i);
      await expect(page.getByLabel(/email/i)).toBeRequired();
      await expect(passwordInput).toHaveAttribute('type', 'password');

      const toggle = page.getByRole('button', { name: /show password/i });
      await toggle.click();
      await expect(passwordInput).toHaveAttribute('type', 'text');
      await expect(page.getByRole('button', { name: /hide password/i })).toBeVisible();
    });
  });

  // -----------------------------
  // ADMIN ROUTES
  // -----------------------------
  test.describe('Admin access control', () => {
    test('redirects to login when unauthenticated', async ({ page }) => {
      await page.goto('/admin');
      await expect(page).toHaveURL(/\/login/i);
      await expect(page.getByRole('heading', { name: /sign in/i })).toBeVisible();
    });
  });

  test.describe('Admin routes (authenticated)', () => {
    const adminRoutes = [
      { path: '/admin', heading: /welcome,/i },
      { path: '/admin/inventory', heading: /stock admin/i },
      { path: '/admin/orders', heading: /order ledger/i },
      { path: '/admin/orders/new', heading: /create order/i },
      { path: '/admin/crm', heading: /user directory/i },
      { path: '/admin/users', heading: /user directory/i },
      { path: '/admin/employees', heading: /user directory/i },
      { path: '/admin/bookings', heading: /rental bookings/i },
      { path: '/admin/schedule', heading: /scheduler/i },
      { path: '/admin/accounting', heading: /accounting/i },
      { path: '/admin/expenses', heading: /expense tracker/i },
      { path: '/admin/hr', heading: /human resources/i },
      { path: '/admin/documents', heading: /documents/i },
      { path: '/admin/timesheets', heading: /timesheets/i },
      { path: '/admin/vendors', heading: /vendor command center/i },
      { path: '/admin/maintenance', heading: /maintenance tracker/i },
      { path: '/admin/delivery', heading: /delivery command/i },
      { path: '/admin/roles', heading: /staff & permissions/i },
      { path: '/admin/settings', heading: /settings/i },
      { path: '/admin/customers', heading: /customer crm/i },
      { path: '/admin/invoicing', heading: /invoicing/i },
      { path: '/admin/marketing', heading: /marketing & promotions/i },
    ];

    test.beforeEach(async ({ page }) => {
      await seedAuth(page);
    });

    for (const { path, heading } of adminRoutes) {
      test(`renders admin route: ${path}`, async ({ page }) => {
        await page.goto(path);
        await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
      });
    }
  });

  // -----------------------------
  // FAQ & POLICY PAGES
  // -----------------------------
  test.describe('FAQ and policies', () => {
    test('FAQ renders hero and first section', async ({ page }) => {
      await page.goto('/faq');
      await dismissCookies(page);
      await expect(page.getByRole('heading', { name: /reebs faq/i })).toBeVisible();
      await expect(page.getByRole('heading', { name: /planning & booking/i })).toBeVisible();
      await expect(page.getByText(/reserve rentals online/i)).toBeVisible();
    });

    const policyPages = [
      { path: '/delivery-policy', heading: /delivery policy/i },
      { path: '/privacy-policy', heading: /privacy policy/i },
      { path: '/terms-of-service', heading: /terms of service/i },
      { path: '/refund-policy', heading: /refund policy/i },
    ];

    for (const { path, heading } of policyPages) {
      test(`Policy page smoke: ${path}`, async ({ page }) => {
        await page.goto(path);
        await dismissCookies(page);
        await expect(page.getByRole('heading', { name: heading })).toBeVisible();
        await expect(page.getByRole('main')).toBeVisible();
      });
    }
  });

  // -----------------------------
  // GALLERY PAGE
  // -----------------------------
  test.describe('Gallery Page', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/gallery');
      await dismissCookies(page);
    });

    test('renders hero and gallery grid', async ({ page }) => {
      await expect(page.getByRole('heading', { name: /gallery/i })).toBeVisible();
      await expect(page.locator('.gallery-card').first()).toBeVisible();
    });

    test('opens lightbox from gallery card', async ({ page }) => {
      const firstCardButton = page.locator('.gallery-img-btn').first();
      await expect(firstCardButton).toBeVisible();
      await firstCardButton.click();

      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();
      await dialog.press('Escape');
    });
  });
});
