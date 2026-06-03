const compactPages = (pages = []) =>
  pages
    .filter((page) => page && page.path)
    .map((page) => ({
      label: page.label || page.path,
      path: page.path,
    }));

const resolveEnvValue = (env = {}, keys = []) => {
  for (const key of keys) {
    const value = env?.[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return "";
};

const normalizeBaseUrl = (value) => {
  if (!value) return "";
  try {
    return new URL(value).origin;
  } catch (_error) {
    return "";
  }
};

export const MONOREPO_APP_REGISTRY = [
  {
    key: "reebs-portal",
    packageName: "@faako/reebs-portal",
    path: "apps/reebs-portal",
    title: "portal.reebspartythemes.com",
    purpose: "Live/private beta ERP portal for authenticated REEBS users.",
    category: "erp",
    productionSensitive: true,
    monitoringEnabled: true,
    defaultBaseUrl: "https://portal.reebspartythemes.com",
    envBaseUrlKeys: ["REEBS_PORTAL_BASE_URL", "REEBS_PORTAL_URL"],
    monitoringPages: [
      { label: "Admin dashboard", path: "/admin" },
      { label: "CRM", path: "/admin/crm" },
      { label: "Customers", path: "/admin/customers" },
      { label: "Orders", path: "/admin/orders" },
      { label: "Order builder", path: "/admin/orders/new" },
      { label: "Bookings", path: "/admin/bookings" },
      { label: "Scheduler", path: "/admin/schedule" },
      { label: "Accounting", path: "/admin/accounting" },
      { label: "Invoicing", path: "/admin/invoicing" },
      { label: "Directory", path: "/admin/directory" },
      { label: "Users", path: "/admin/users" },
      { label: "Employees", path: "/admin/employees" },
      { label: "Expenses", path: "/admin/expenses" },
      { label: "HR", path: "/admin/hr" },
      { label: "Vendors", path: "/admin/vendors" },
      { label: "Maintenance", path: "/admin/maintenance" },
      { label: "Delivery", path: "/admin/delivery" },
      { label: "Documents", path: "/admin/documents" },
      { label: "Timesheets", path: "/admin/timesheets" },
      { label: "Roles", path: "/admin/roles" },
      { label: "Marketing", path: "/admin/marketing" },
      { label: "Settings", path: "/admin/settings" },
      { label: "Website template", path: "/admin/website-template" },
    ],
  },
  {
    key: "dev-erp",
    packageName: "@faako/dev-erp",
    path: "apps/dev-erp",
    title: "Dev ERP",
    purpose: "Fully live operational ERP with real production data.",
    category: "erp",
    productionSensitive: true,
    monitoringEnabled: true,
    defaultBaseUrl: "https://dev.nanaabaackah.com",
    envBaseUrlKeys: ["DEV_ERP_BASE_URL", "APP_BASE_URL", "VITE_BACKEND_BASE_URL"],
    monitoringPages: [
      { label: "Dashboard", path: "/" },
      { label: "Health", path: "/health" },
      { label: "Login", path: "/login" },
    ],
  },
  {
    key: "stroane-web",
    packageName: "@faako/stroane-web",
    path: "apps/stroane-web",
    title: "stroanesolutions.com",
    purpose: "First paying client website and storefront project.",
    category: "client",
    productionSensitive: true,
    monitoringEnabled: true,
    defaultBaseUrl: "https://stroanesolutions.com",
    envBaseUrlKeys: ["STROANE_WEB_BASE_URL", "STROANE_BASE_URL"],
    monitoringPages: [
      { label: "Home", path: "/" },
      { label: "About", path: "/about" },
      { label: "Services", path: "/services" },
      { label: "Catalogue", path: "/catalogue" },
      { label: "Resources", path: "/resources" },
      { label: "Shop", path: "/shop" },
      { label: "Contact", path: "/contact" },
      { label: "Products", path: "/products" },
      { label: "Checkout", path: "/checkout" },
      { label: "Checkout return", path: "/checkout/return" },
      { label: "Account", path: "/account" },
      { label: "Orders", path: "/orders" },
      { label: "Quotes", path: "/quotes" },
      { label: "Sign in", path: "/signin" },
      { label: "Sign up", path: "/signup" },
      { label: "Terms", path: "/terms" },
      { label: "Privacy", path: "/privacy" },
      { label: "Cookies", path: "/cookies" },
      { label: "Sitemap", path: "/sitemap" },
      { label: "Search", path: "/search" },
    ],
    additionalMonitoringSites: [
      {
        id: "stroane-portal",
        title: "portal.stroanesolutions.com",
        purpose: "Stroane authenticated admin portal surface.",
        category: "portal",
        defaultBaseUrl: "https://portal.stroanesolutions.com",
        envBaseUrlKeys: ["STROANE_PORTAL_BASE_URL", "STROANE_PORTAL_URL"],
        monitoringPages: [
          { label: "Admin dashboard", path: "/admin" },
          { label: "Inventory", path: "/admin/inventory" },
          { label: "Suppliers", path: "/admin/suppliers" },
          { label: "Products", path: "/admin/products" },
          { label: "Operations", path: "/admin/operations" },
          { label: "Orders", path: "/admin/orders" },
          { label: "Reports", path: "/admin/reports" },
          { label: "Settings", path: "/admin/settings" },
          { label: "Login", path: "/login" },
        ],
      },
      {
        id: "stroane-api",
        title: "Stroane API",
        purpose: "Optional Stroane backend/API health and catalogue endpoints.",
        category: "api",
        envBaseUrlKeys: [
          "STROANE_API_BASE_URL",
          "STROANE_BACKEND_BASE_URL",
          "VITE_BACKEND_BASE_URL",
        ],
        monitoringPages: [
          { label: "Health", path: "/health" },
          { label: "Catalogue products", path: "/api/catalogue/products" },
          { label: "Catalogue categories", path: "/api/catalogue/categories" },
          { label: "Products API", path: "/api/products" },
          { label: "Categories API", path: "/api/categories" },
        ],
      },
    ],
  },
  {
    key: "faako-website",
    monitoringId: "faako",
    packageName: "@faako/faako-website",
    path: "apps/faako-website",
    title: "faako.nanaabaackah.com",
    purpose: "Public Faako marketing and signup website.",
    category: "marketing",
    productionSensitive: true,
    monitoringEnabled: true,
    defaultBaseUrl: "https://faako.nanaabaackah.com",
    envBaseUrlKeys: ["FAAKO_WEBSITE_BASE_URL", "FAAKO_BASE_URL"],
    monitoringPages: [
      { label: "Home", path: "/" },
      { label: "Solutions", path: "/solutions" },
      { label: "Case studies", path: "/case-studies" },
      { label: "About", path: "/about" },
      { label: "Pricing", path: "/pricing" },
      { label: "Configure", path: "/configure" },
      { label: "Dashboard", path: "/dashboard" },
      { label: "Signup", path: "/signup" },
      { label: "Login", path: "/login" },
      { label: "Forgot password", path: "/forgot-password" },
      { label: "Contact", path: "/contact" },
      { label: "Privacy", path: "/privacy" },
      { label: "Terms", path: "/terms" },
    ],
  },
  {
    key: "faako-api",
    packageName: "@faako/faako-api",
    path: "apps/faako-api",
    title: "Faako API",
    purpose: "Shared API/function surface for Faako platform apps.",
    category: "api",
    productionSensitive: true,
    monitoringEnabled: true,
    defaultBaseUrl: "https://faako.nanaabaackah.com",
    envBaseUrlKeys: ["FAAKO_API_BASE_URL", "FAAKO_API_URL"],
    monitoringPages: [{ label: "Health", path: "/api/health" }],
  },
  {
    key: "reebs-website",
    monitoringId: "reebs",
    packageName: "@faako/reebs-website",
    path: "apps/reebs-website",
    title: "reebspartythemes.com",
    purpose: "Public REEBS storefront and booking website.",
    category: "commerce",
    productionSensitive: true,
    monitoringEnabled: true,
    defaultBaseUrl: "https://reebspartythemes.com",
    envBaseUrlKeys: ["REEBS_WEBSITE_BASE_URL", "REEBS_WEBSITE_URL"],
    monitoringPages: [
      { label: "Home", path: "/" },
      { label: "About", path: "/about" },
      { label: "Shop", path: "/shop" },
      { label: "Rentals", path: "/rentals" },
      { label: "Cart", path: "/cart" },
      { label: "Checkout", path: "/checkout" },
      { label: "Gallery", path: "/gallery" },
      { label: "FAQ", path: "/faq" },
      { label: "Contact", path: "/contact" },
      { label: "Book", path: "/book" },
      { label: "Customer login", path: "/customer-login" },
      { label: "Login", path: "/login" },
      { label: "Reset password", path: "/reset-password" },
      { label: "Delivery policy", path: "/delivery-policy" },
      { label: "Privacy policy", path: "/privacy-policy" },
      { label: "Refund policy", path: "/refund-policy" },
      { label: "Terms of service", path: "/terms-of-service" },
    ],
  },
  {
    key: "bynana-portfolio",
    monitoringId: "nana",
    packageName: "@faako/bynana-portfolio",
    path: "apps/bynana-portfolio",
    title: "nanaabaackah.com",
    purpose: "Public portfolio and content website.",
    category: "portfolio",
    productionSensitive: false,
    monitoringEnabled: true,
    defaultBaseUrl: "https://nanaabaackah.com",
    envBaseUrlKeys: ["BYNANA_PORTFOLIO_BASE_URL", "NANA_PORTFOLIO_BASE_URL"],
    monitoringPages: [
      { label: "Home", path: "/" },
      { label: "About", path: "/about" },
      { label: "Resume", path: "/resume" },
      { label: "Projects", path: "/projects" },
      { label: "Blog", path: "/blog" },
      { label: "Contact", path: "/contact" },
    ],
  },
  {
    key: "faako-erp",
    packageName: "@faako/faako-erp",
    path: "apps/faako-erp",
    title: "Faako ERP demo",
    purpose: "Public ERP demo surface.",
    category: "demo",
    productionSensitive: false,
    monitoringEnabled: true,
    defaultBaseUrl: "https://faako-erp.nanaabaackah.com",
    envBaseUrlKeys: ["FAAKO_ERP_BASE_URL", "VITE_ERP_DEMO_URL"],
    monitoringPages: [
      { label: "Home", path: "/" },
      { label: "Dashboard", path: "/dashboard" },
    ],
  },
  {
    key: "system-starter",
    packageName: "@faako/system-starter",
    path: "apps/system-starter",
    title: "System starter",
    purpose: "Internal starter app for new platform systems.",
    category: "internal",
    productionSensitive: false,
    monitoringEnabled: true,
    monitoringOptional: true,
    envBaseUrlKeys: ["SYSTEM_STARTER_BASE_URL"],
    monitoringPages: [{ label: "Home", path: "/" }],
  },
  {
    key: "ui-workbench",
    packageName: "@faako/ui-workbench",
    path: "apps/ui-workbench",
    title: "UI workbench",
    purpose: "Internal shared UI verification workbench.",
    category: "internal",
    productionSensitive: false,
    monitoringEnabled: true,
    monitoringOptional: true,
    envBaseUrlKeys: ["UI_WORKBENCH_BASE_URL"],
    monitoringPages: [{ label: "Home", path: "/" }],
  },
];

export const getMonorepoApps = () => MONOREPO_APP_REGISTRY.map((app) => ({ ...app }));

export const getMonorepoAppByKey = (key) =>
  MONOREPO_APP_REGISTRY.find((app) => app.key === key) || null;

export const getMonorepoMonitoringSites = (env = {}) =>
  MONOREPO_APP_REGISTRY
    .filter((app) => app.monitoringEnabled)
    .flatMap((app) => {
      const envBaseUrl = resolveEnvValue(env, app.envBaseUrlKeys);
      const baseUrl = normalizeBaseUrl(envBaseUrl || app.defaultBaseUrl);
      const sites = [
        {
          id: app.monitoringId || app.key,
          appKey: app.key,
          packageName: app.packageName,
          path: app.path,
          title: app.title,
          category: app.category,
          baseUrl,
          configured: Boolean(baseUrl),
          monitoringOptional: Boolean(app.monitoringOptional),
          productionSensitive: Boolean(app.productionSensitive),
          pages: compactPages(app.monitoringPages),
        },
      ];

      for (const additionalSite of app.additionalMonitoringSites || []) {
        const additionalEnvBaseUrl = resolveEnvValue(env, additionalSite.envBaseUrlKeys);
        const additionalBaseUrl = normalizeBaseUrl(
          additionalEnvBaseUrl || additionalSite.defaultBaseUrl
        );
        const pages = compactPages(additionalSite.monitoringPages);
        const showWhenUnconfigured = additionalSite.showWhenUnconfigured !== false;

        if (!additionalBaseUrl && !showWhenUnconfigured) continue;

        sites.push({
          id: additionalSite.id || `${app.key}-api`,
          appKey: app.key,
          packageName: app.packageName,
          path: app.path,
          title: additionalSite.title || app.title,
          category: additionalSite.category || app.category,
          baseUrl: additionalBaseUrl,
          configured: Boolean(additionalBaseUrl),
          monitoringOptional: Boolean(additionalSite.monitoringOptional),
          productionSensitive: Boolean(app.productionSensitive),
          pages,
        });
      }

      return sites;
    })
    .filter((site) => site.pages.length);
