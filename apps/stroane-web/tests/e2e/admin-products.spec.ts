import { expect, test, type Page } from "@playwright/test";

const SESSION_KEY = "stroane_admin_session_v1";
const ADMIN_SESSION = {
  token: "test-admin-token",
  username: "admin",
  role: "ADMIN",
};

const supplier = {
  id: "supplier-1",
  name: "Kitchen Supply Co",
  slug: "kitchen-supply-co",
  status: "active",
  productCount: 1,
};

const product = {
  id: "product-1",
  slug: "alpha-grillers-digital-food-thermometer",
  name: "Alpha Grillers Digital Food Thermometer",
  sku: "ST-THERM-001",
  shortDescription: "Fast probe thermometer.",
  longDescription: "A digital food thermometer for kitchen temperature checks.",
  price: 145,
  compareAtPrice: null,
  currency: "GHS",
  categorySlug: "digital-probe-thermometers",
  category: { slug: "digital-probe-thermometers", name: "Digital Probe Thermometers" },
  tags: ["digital", "probe"],
  thumbnailImage: "/imgs/products/product-placeholder.webp",
  galleryImages: ["/imgs/products/product-placeholder.webp"],
  publishingStatus: "active",
  isPublished: true,
  isFeatured: false,
  stock: {
    inventoryItemId: "inventory-1",
    quantityOnHand: 8,
    reservedQuantity: 1,
    availableQuantity: 7,
    reorderThreshold: 3,
    lowStockThreshold: 3,
    stockStatus: "in_stock",
    isLowStock: false,
    isOutOfStock: false,
    updatedAt: "2026-05-30T10:00:00.000Z",
  },
  supplierLinks: [
    {
      id: "link-1",
      supplierId: supplier.id,
      supplierSku: "SUP-001",
      isPreferred: true,
      notes: "Private supplier note",
      supplier,
    },
  ],
  preferredSupplier: {
    id: "link-1",
    supplierId: supplier.id,
    supplierSku: "SUP-001",
    isPreferred: true,
    notes: "Private supplier note",
    supplier,
  },
  createdAt: "2026-05-29T10:00:00.000Z",
  updatedAt: "2026-05-30T10:00:00.000Z",
};

const json = (body: object, status = 200) => ({
  status,
  contentType: "application/json",
  body: JSON.stringify(body),
});

const useAdminSession = async (page: Page) => {
  await page.addInitScript(
    ({ key, value }) => window.sessionStorage.setItem(key, value),
    { key: SESSION_KEY, value: JSON.stringify(ADMIN_SESSION) }
  );
};

const mockAdminApi = async (
  page: Page,
  {
    products = [product],
    failProducts = false,
    productDelayMs = 0,
  }: { products?: typeof product[]; failProducts?: boolean; productDelayMs?: number } = {}
) => {
  const patches: Array<{ pathname: string; payload: unknown }> = [];

  await page.route("**/api/admin/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const { pathname } = url;

    if (request.method() === "GET" && pathname === "/api/admin/products") {
      if (productDelayMs) await new Promise((resolve) => setTimeout(resolve, productDelayMs));
      if (failProducts) {
        return route.fulfill(json({ error: "Unable to load products." }, 503));
      }
      return route.fulfill(
        json({
          ok: true,
          products,
          categories: [{ slug: "digital-probe-thermometers", name: "Digital Probe Thermometers" }],
        })
      );
    }

    if (request.method() === "GET" && pathname === "/api/admin/suppliers") {
      return route.fulfill(json({ ok: true, suppliers: [supplier] }));
    }

    if (request.method() === "GET" && pathname === `/api/admin/products/${product.id}`) {
      return route.fulfill(json({ ok: true, product }));
    }

    if (request.method() === "PATCH" && pathname.startsWith(`/api/admin/products/${product.id}`)) {
      patches.push({ pathname, payload: request.postDataJSON() });
      return route.fulfill(json({ ok: true, product }));
    }

    return route.fulfill(json({ error: "Unhandled mock admin route." }, 404));
  });

  return patches;
};

test("public catalogue retains the local fallback when the API is unavailable", async ({ page }) => {
  await page.route("**/api/catalogue/**", (route) => route.abort());
  await page.goto("/catalogue");
  await expect(page.getByText("Catalogue fallback active")).toBeVisible();
  await expect(page.locator(".erp-shell-frame")).toHaveCount(0);
  await expect(page.locator('a[aria-label="Sign in"]').first()).toHaveAttribute(
    "href",
    "https://portal.stroanesolutions.com/login"
  );
});

test("admin products redirect to the internal sign-in when no staff session exists", async ({
  page,
}) => {
  await page.goto("/admin/products");
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("heading", { name: "Stroane operations" })).toBeVisible();
});

test("legacy admin sign-in redirects to the portal login route", async ({ page }) => {
  await page.goto("/admin/signin");
  await expect(page).toHaveURL(/\/login$/);
});

test("portal login and logout retain the portal-scoped staff session flow", async ({ page }) => {
  await page.route("**/api/auth/login", (route) =>
    route.fulfill(json({ ok: true, ...ADMIN_SESSION }))
  );

  await page.goto("/login");
  await page.getByLabel("Username").fill("admin");
  await page.getByLabel("Password").fill("not-a-real-password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole("heading", { name: "Operations overview" })).toBeVisible();

  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login$/);
  expect(await page.evaluate(() => window.sessionStorage.getItem("stroane_admin_session_v1"))).toBeNull();
});

test("admin products show a safe API failure state", async ({ page }) => {
  await useAdminSession(page);
  await mockAdminApi(page, { failProducts: true });
  await page.goto("/admin/products");
  await expect(page.getByText("Product operations unavailable")).toBeVisible();
  await expect(page.getByText("Unable to load products.").first()).toBeVisible();
});

test("admin products show loading and empty states", async ({ page }) => {
  await useAdminSession(page);
  await mockAdminApi(page, { products: [], productDelayMs: 400 });
  await page.goto("/admin/products");
  await expect(page.getByText("Loading products...")).toBeVisible();
  await expect(page.getByText("No catalogue products found")).toBeVisible();
});

test("authenticated admins can edit product copy, media, publishing, and supplier data", async ({
  page,
}) => {
  await useAdminSession(page);
  const patches = await mockAdminApi(page);
  await page.goto("/admin/products");
  await expect(page.getByRole("heading", { name: "Product operations" })).toBeVisible();
  await expect(page.getByText(product.name).first()).toBeVisible();

  await page.getByRole("button", { name: "Edit" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByLabel("Name").fill("Alpha Grillers Thermometer Updated");
  await page.getByLabel("Thumbnail image path").fill("/imgs/products/aprons/updated.webp");
  await page
    .getByLabel("Gallery image paths")
    .fill("/imgs/products/aprons/updated.webp\n/imgs/products/aprons/detail.webp");
  await page.getByLabel("Publishing state", { exact: true }).selectOption("draft");
  await page.getByText("Feature this product in catalogue highlights").click();
  await page.getByRole("button", { name: "Save product" }).click();

  await expect(page.getByText("Alpha Grillers Digital Food Thermometer was updated.")).toBeVisible();
  expect(patches.map(({ pathname }) => pathname)).toEqual([
    `/api/admin/products/${product.id}`,
    `/api/admin/products/${product.id}/media`,
    `/api/admin/products/${product.id}/publishing`,
    `/api/admin/products/${product.id}/suppliers`,
  ]);
});

test("admin product cards remain usable at a mobile viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await useAdminSession(page);
  await mockAdminApi(page);
  await page.goto("/admin/products");
  await expect(page.locator(".ui-erp-table--cards")).toBeVisible();
  await expect(page.getByText(product.name).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Edit" })).toBeVisible();
});
