import { expect, test } from "@playwright/test";

test.setTimeout(90_000);

const token = "a".repeat(64);

const baseVersion = {
  id: 8,
  proposalId: 5,
  versionNumber: 2,
  status: "PUBLISHED",
  title: "Website delivery",
  summary: "A website and maintenance proposal.",
  currency: "GHS",
  customer: { name: "Acme Studio", email: "client@example.com" },
  project: { title: "Website refresh" },
  validUntil: "2099-12-31",
  scope: "Design, build, and launch the approved website.",
  exclusions: ["Copywriting"],
  terms: ["Invoices are reviewed before issue."],
  items: [
    { id: 41, name: "Website Development", description: "Core build", deliverables: ["Responsive website"], quantity: 1, unitPrice: 5000, discount: 0, billingType: "ONE_TIME", billingFrequency: "NONE", required: true, clientSelectable: false, selectedByDefault: true },
    { id: 42, name: "CMS Setup", description: "Content management", deliverables: ["CMS configuration"], quantity: 1, unitPrice: 2000, discount: 0, billingType: "ONE_TIME", billingFrequency: "NONE", required: true, clientSelectable: false, selectedByDefault: true },
    { id: 43, name: "SEO", description: "Optional search setup", deliverables: ["Metadata setup"], quantity: 1, unitPrice: 1000, discount: 0, billingType: "ONE_TIME", billingFrequency: "NONE", required: false, clientSelectable: true, selectedByDefault: false },
    { id: 44, name: "Maintenance", description: "Ongoing support", deliverables: ["Monthly maintenance"], quantity: 1, unitPrice: 250, discount: 0, billingType: "RECURRING", billingFrequency: "MONTHLY", required: true, clientSelectable: false, selectedByDefault: true },
  ],
  totals: { oneTimeTotal: 7000, recurringMonthlyTotal: 250, recurringAnnualTotal: 0, depositAmount: 3500 },
  billingSchedule: [
    { id: 51, type: "DEPOSIT", label: "Deposit", amount: 3500, billingFrequency: "NONE" },
    { id: 52, type: "BALANCE", label: "Remaining balance", amount: 3500, billingFrequency: "NONE" },
    { id: 53, type: "RECURRING", label: "Monthly recurring charges", amount: 250, billingFrequency: "MONTHLY" },
  ],
};

const installProposalApi = async (page) => {
  const writes = [];
  let selections = [];
  await page.route("**/api/proposals/interactive/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.pathname.endsWith("/versions")) {
      await route.fulfill({ contentType: "application/json", body: JSON.stringify({ versions: [{ id: 8, versionNumber: 2, status: "PUBLISHED", title: baseVersion.title, publishedAt: "2026-10-16T10:00:00.000Z" }] }) });
      return;
    }
    if (url.pathname.endsWith("/selections") && request.method() === "PUT") {
      selections = request.postDataJSON().selections;
      writes.push({ kind: "selections", body: selections });
      const seoSelected = selections.some((entry) => entry.itemId === 43 && entry.selected);
      await route.fulfill({ contentType: "application/json", body: JSON.stringify({
        selections,
        estimatedTotals: { ...baseVersion.totals, oneTimeTotal: seoSelected ? 8000 : 7000, depositAmount: seoSelected ? 4000 : 3500 },
        billingSchedule: baseVersion.billingSchedule,
      }) });
      return;
    }
    if (url.pathname.endsWith("/messages") && request.method() === "POST") {
      writes.push({ kind: "message", body: request.postDataJSON() });
      await route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ request: { id: 70, status: "OPEN" } }) });
      return;
    }
    if (url.pathname.endsWith("/accept") && request.method() === "POST") {
      writes.push({ kind: "accept", body: request.postDataJSON() });
      await route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({
        accepted: true,
        duplicate: false,
        acceptance: { id: 61, status: "ACCEPTED", proposalVersionId: 8, acceptedAt: "2026-10-16T12:00:00.000Z" },
        billingSchedule: baseVersion.billingSchedule,
        invoiceReady: false,
      }) });
      return;
    }
    await route.fulfill({ contentType: "application/json", body: JSON.stringify({
      version: baseVersion,
      selections,
      estimatedTotals: baseVersion.totals,
      billingSchedule: baseVersion.billingSchedule,
      acceptance: null,
    }) });
  });
  return writes;
};

test("client configures, requests revision, and accepts only after backend confirmation", async ({ page }) => {
  const writes = await installProposalApi(page);
  await page.goto(`/proposal/interactive/${token}`, { waitUntil: "domcontentloaded" });

  await expect(page.getByRole("heading", { name: "Website delivery" })).toBeVisible();
  await expect(page.getByText(/7,000\.00/).first()).toBeVisible();
  await page.getByText("SEO", { exact: true }).click();
  await page.getByLabel("Include this option").check();
  await page.getByRole("button", { name: "Save my configuration" }).click();
  await expect(page.getByText(/8,000\.00/).first()).toBeVisible();

  await page.getByRole("button", { name: "Request a revision" }).click();
  await page.getByPlaceholder("Write your message here.").fill("Please confirm the launch date.");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.getByText("Your message has been sent to the proposal team.")).toBeVisible();

  await page.getByLabel(/I agree to the commercial terms/).check();
  await page.getByRole("button", { name: "Accept proposal" }).click();
  await expect(page.getByText("Proposal accepted", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Configuration accepted" })).toBeDisabled();
  expect(writes.some((entry) => entry.kind === "accept" && entry.body.expectedVersionNumber === 2)).toBe(true);
});

test("interactive proposal remains within a mobile viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await installProposalApi(page);
  await page.goto(`/proposal/interactive/${token}`, { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Website delivery" })).toBeVisible();
  const widths = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    document: document.documentElement.scrollWidth,
  }));
  expect(widths.document).toBeLessThanOrEqual(widths.viewport);
});

test("admin selects a form client, configures tiers, and generates editable proposal copy", async ({ page }) => {
  const adminUser = { id: 1, userId: 1, organizationId: 1, fullName: "Admin User", email: "admin@example.com", roleName: "Admin", role: { name: "Admin", permissions: null } };
  const website = { kind: "SERVICE", name: "Website Development", category: "Web & Digital", systemKey: "website-development", tiers: [{ name: "Website + Leads", priceModel: "FIXED", faakoSetupFee: 2500, providerCurrency: "GHS", displayPrice: "GHS 2,500 setup", billingFrequency: "NONE", sourceUrl: "https://example.com/pricing", lastVerifiedAt: "2026-10-16", includedFeatures: ["CMS setup"], isDefault: true }] };
  const paystack = { kind: "INTEGRATION", name: "Paystack", category: "Payments", systemKey: "paystack", tiers: [{ name: "Custom quote", priceModel: "CUSTOM_QUOTE", faakoSetupFee: 750, displayPrice: "Provider transaction fees", billingFrequency: "NONE", sourceUrl: "https://paystack.com/gh/pricing", lastVerifiedAt: "2026-10-16", isDefault: true }] };
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (!url.pathname.startsWith("/api/")) return route.continue();
    const fulfill = (body, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
    if (url.pathname === "/api/auth/session") return fulfill({ user: adminUser, csrfToken: "csrf-token" });
    if (url.pathname === "/api/proposals/catalogue") return fulfill({ items: [], suggestions: [website, paystack] });
    if (url.pathname === "/api/proposals/packages") return fulfill({ packages: [] });
    if (url.pathname === "/api/projects") return fulfill({ projects: [] });
    if (url.pathname === "/api/access/users") return fulfill({ users: [adminUser] });
    if (url.pathname === "/api/proposals/client-options") return fulfill({ options: [{ reference: "form-1", companyName: "Acme Studio", contactName: "Ama", email: "ama@acme.test", phone: "+233200000000", formType: "client-setup", projectContext: { projectDetails: "A lead-generating website." } }] });
    if (url.pathname === "/api/proposals/pricing-preview") return fulfill({ commercial: { ...request.postDataJSON().commercial, totals: { oneTimeTotal: 3250, recurringMonthlyTotal: 0, recurringAnnualTotal: 0, discount: 0, taxAmount: 0, depositAmount: 1625, clientDirectTotal: 0 } } });
    if (url.pathname === "/api/proposals/ai/generate") {
      const body = request.postDataJSON();
      if (body.task === "REFINE_SUMMARY") return fulfill({ content: { summary: "Acme Studio needs a focused website that captures and qualifies new leads." }, model: "test", generatedAt: "2026-10-16T12:00:00.000Z", sourceFingerprint: body.sourceFingerprint, usage: { dailyLimit: 10, used: 1, remaining: 9 } });
      return fulfill({ content: { scope: "Design and deliver the selected website and integration configuration.", deliverables: body.context.items.map((item) => ({ itemKey: item.key, details: [`Configured ${item.name}`] })), estimatedDelivery: "Timeline confirmed after discovery.", exclusions: ["Third-party provider fees"], deliveryTerms: ["Client supplies approved content"] }, model: "test", generatedAt: "2026-10-16T12:00:00.000Z", sourceFingerprint: body.sourceFingerprint, usage: { dailyLimit: 10, used: 2, remaining: 8 } });
    }
    return fulfill({ notifications: [], unreadCount: 0 });
  });

  await page.goto("/proposals/new", { waitUntil: "domcontentloaded" });
  await page.getByRole("combobox", { name: "Client" }).fill("Acme");
  await page.getByRole("option", { name: /Acme Studio/ }).click();
  await expect(page.getByLabel("Customer email")).toHaveValue("ama@acme.test");
  await page.getByPlaceholder("Write at least one sentence about the project.").fill("Acme needs a website that can generate more qualified leads.");
  await page.getByRole("button", { name: "Refine with AI" }).click();
  await page.getByRole("button", { name: "Use refined summary" }).click();

  await page.getByRole("button", { name: /2 Services/ }).click();
  const websiteCard = page.locator(".structured-selector-option").filter({ hasText: "Website Development" });
  await websiteCard.getByRole("button", { name: "Add" }).click();
  await expect(page.locator(".structured-selected-item").filter({ hasText: "CMS Setup" })).toContainText("Included");
  await websiteCard.getByRole("button", { name: "Configure" }).click();
  await expect(page.getByLabel("Deliverables (one per line)")).toHaveValue(/UI\/UX design included/);
  await page.getByRole("button", { name: "Close" }).click();

  await page.getByRole("button", { name: /3 Integrations/ }).click();
  const paystackCard = page.locator(".structured-selector-option").filter({ hasText: "Paystack" });
  await paystackCard.getByRole("button", { name: "Add" }).click();
  await expect(paystackCard).toHaveClass(/is-selected/);
  await expect(page.locator(".structured-selected-item").filter({ hasText: "Paystack" })).toContainText("Custom quote");

  await page.getByRole("button", { name: /5 Scope & Delivery/ }).click();
  await expect(page.getByLabel("Scope")).toHaveValue(/Design and deliver/);
  await page.getByLabel("Scope").fill("Edited scope approved by the administrator.");
  await expect(page.getByText("8 of 10 requests remaining today.")).toBeVisible();
});
