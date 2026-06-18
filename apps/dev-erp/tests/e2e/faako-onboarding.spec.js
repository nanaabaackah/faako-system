import { expect, test } from "@playwright/test";

test.setTimeout(60_000);

const adminUser = {
  id: 1,
  userId: 1,
  fullName: "Admin User",
  email: "admin@example.com",
  roleName: "Admin",
  role: {
    name: "Admin",
    permissions: null,
  },
};

const statusOptions = [
  { value: "NEW", label: "New" },
  { value: "REVIEWED", label: "Reviewed" },
  { value: "CONTACTED", label: "Contacted" },
  { value: "PROPOSAL_SENT", label: "Proposal Sent" },
  { value: "APPROVED", label: "Approved" },
  { value: "SETUP_IN_PROGRESS", label: "Setup In Progress" },
  { value: "CONVERTED", label: "Converted" },
  { value: "CLOSED", label: "Closed" },
];

const makeSubmission = ({ status = { value: "NEW", label: "New" }, internalNotes = "" } = {}) => ({
  id: "request-1",
  companyName: "Aba Creative Studio",
  email: "hello@abacreative.test",
  contactName: "Nana Aba",
  phone: "0240000000",
  packageTier: "Growth",
  requestedModules: ["Website", "Portal"],
  selectedModules: ["Website", "Portal"],
  setupChecklist: ["Discovery call"],
  businessType: "Creative services",
  timelinePreference: "This month",
  status,
  source: "faako-client-setup",
  formType: "client-setup",
  formLabel: "Client setup form",
  assignedOwner: "admin@example.com",
  internalNotes,
  createdAt: "2026-06-18T09:00:00.000Z",
  updatedAt: "2026-06-18T09:05:00.000Z",
  managementUpdatedAt: null,
  managementUpdatedBy: "",
  websiteUrl: "https://abacreative.test",
  currency: "GHS",
  teamSize: "2-5",
  currentWorkflow: "N/A",
  projectDetails: "N/A",
  painPoints: "N/A",
  additionalNotes: "N/A",
  emailDelivery: {
    status: "sent",
    updatedAt: "2026-06-18T09:06:00.000Z",
    attempts: [
      {
        type: "admin_summary",
        status: "sent",
        deliveryRecipient: "dev@nanaabaackah.com",
        wasRerouted: true,
      },
    ],
  },
  pdfSummary: {
    stored: false,
    fileName: "faako-client-setup-aba-creative-studio.pdf",
    note: "Generated as an email attachment; no stored PDF copy is available.",
  },
  activityTimeline: [
    {
      type: "submitted",
      label: "Submission received",
      at: "2026-06-18T09:00:00.000Z",
      by: "Faako website",
      note: "faako-client-setup",
    },
  ],
  wizardSections: [
    {
      key: "company",
      title: "Company",
      fields: [
        { key: "company.businessName", label: "Business name", value: "Aba Creative Studio" },
        { key: "company.mainEmail", label: "Main email", value: "hello@abacreative.test" },
      ],
    },
    {
      key: "brand",
      title: "Brand",
      fields: [
        { key: "brand.sharedContentLink", label: "Google Drive or shared folder link", value: "https://drive.google.com/example" },
        { key: "brand.colourScheme", label: "Colour scheme or brand colours", value: "Forest green and white" },
      ],
    },
    {
      key: "integrations",
      title: "Integrations",
      fields: [
        { key: "integrations.selectedIntegrationLabels", label: "Selected integrations", value: "Google Analytics, Paystack" },
      ],
    },
  ],
});

const makeListPayload = (submission) => ({
  submissions: [submission],
  summary: {
    total: 1,
    byStatus: {
      [submission.status.value]: 1,
    },
  },
  filters: {
    statuses: statusOptions,
    packages: [{ value: "Growth", label: "Growth" }],
    modules: [
      { value: "Website", label: "Website" },
      { value: "Portal", label: "Portal" },
    ],
  },
  ownerOptions: [{ value: "admin@example.com", label: "Admin User (admin@example.com)" }],
  capabilities: {
    internalNotes: true,
    assignedOwner: true,
    pdfSummary: true,
    emailDelivery: true,
    activityTimeline: true,
  },
});

test.beforeEach(async ({ page }) => {
  let detailSubmission = makeSubmission();

  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();

    if (!url.pathname.startsWith("/api/")) {
      await route.continue();
      return;
    }

    if (url.pathname === "/api/auth/session") {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ user: adminUser, csrfToken: "csrf-token" }),
      });
      return;
    }

    if (url.pathname === "/api/auth/refresh") {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ ok: true, csrfToken: "csrf-token" }),
      });
      return;
    }

    if (url.pathname === "/api/faako-onboarding" && method === "GET") {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify(makeListPayload(detailSubmission)),
      });
      return;
    }

    if (url.pathname === "/api/faako-onboarding/request-1" && method === "GET") {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          submission: detailSubmission,
          ownerOptions: [{ value: "admin@example.com", label: "Admin User (admin@example.com)" }],
          statusOptions,
        }),
      });
      return;
    }

    if (url.pathname === "/api/faako-onboarding/request-1" && method === "PATCH") {
      const body = request.postDataJSON();
      detailSubmission = makeSubmission({
        status: { value: body.status, label: "Contacted" },
        internalNotes: body.internalNotes,
      });
      detailSubmission.activityTimeline = [
        {
          type: "status_changed",
          label: "Status changed",
          at: "2026-06-18T10:00:00.000Z",
          by: "Admin User",
          from: "New",
          to: "Contacted",
        },
        ...detailSubmission.activityTimeline,
      ];
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          submission: detailSubmission,
          changedFields: ["status", "internalNotes"],
        }),
      });
      return;
    }

    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({}),
    });
  });

  await page.addInitScript((user) => {
    window.localStorage.setItem("user", JSON.stringify(user));
  }, adminUser);
});

test("Faako onboarding list opens detail and saves management updates", async ({ page }) => {
  await page.goto("/faako-onboarding");

  await expect(page.getByRole("heading", { name: "Faako Onboarding" })).toBeVisible();
  const submissionRow = page.locator("tbody tr", { hasText: "Aba Creative Studio" });
  await expect(submissionRow).toBeVisible();
  await expect(page.getByText("Client setup form").first()).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);

  await submissionRow.click();

  const dialog = page.getByRole("dialog", { name: /Aba Creative Studio/ });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("heading", { name: "Submission snapshot" })).toBeVisible();
  await expect(dialog.getByText("Google Drive or shared folder link")).toBeVisible();
  await expect(dialog.getByText("https://drive.google.com/example")).toBeVisible();
  await expect(dialog.getByText("Trading name")).toHaveCount(0);
  await expect(dialog.getByText("Google Analytics, Paystack")).toBeVisible();
  await expect(dialog.getByText("dev@nanaabaackah.com")).toBeVisible();

  const managementPanel = dialog.locator(".faako-management-panel");
  await managementPanel.getByRole("button", { name: "Status" }).click({ force: true });
  await page.getByRole("option", { name: "Contacted" }).click({ force: true });
  await managementPanel.getByLabel("Internal notes").fill("Follow up after proposal review.");
  await managementPanel.getByRole("button", { name: "Save updates" }).click();

  await expect(page.getByText("Faako onboarding submission updated.")).toBeVisible();
  await expect(dialog.getByText("Status changed")).toBeVisible();
  await expect(managementPanel.getByLabel("Internal notes")).toHaveValue("Follow up after proposal review.");
});
