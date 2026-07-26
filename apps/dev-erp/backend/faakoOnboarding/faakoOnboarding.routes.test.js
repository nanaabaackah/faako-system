import assert from "node:assert/strict";
import test from "node:test";
import {
  FAAKO_ONBOARDING_STATUS_OPTIONS,
  buildUpdatePatch,
  buildWizardSections,
  registerFaakoOnboardingRoutes,
  serializeFaakoOnboardingSubmission,
} from "./faakoOnboarding.routes.js";

const sampleRow = {
  id: "signup-1",
  companyName: "Aba Creative Studio",
  email: "hello@example.com",
  contactName: "Nana Aba",
  phone: "",
  teamSize: "2-5",
  currency: "GHS",
  websiteUrl: "",
  packageTier: "Growth",
  requestedModules: ["website", "portal"],
  businessType: "Creative services",
  currentWorkflow: "",
  communicationChannels: ["email"],
  timelinePreference: "This month",
  projectDetails: "",
  painPoints: "",
  additionalNotes: "",
  status: "PROPOSAL_SENT",
  source: "faako-client-setup",
  createdAt: new Date("2026-06-18T09:00:00.000Z"),
  updatedAt: new Date("2026-06-18T09:05:00.000Z"),
  onboardingIntake: {
    company: {
      businessName: "Aba Creative Studio",
      mainEmail: "hello@example.com",
    },
    service: {
      primaryProduct: "Website",
      extraProducts: ["Client portal"],
    },
    brand: {
      sharedContentLink: "https://drive.google.com/example",
      colourScheme: "",
    },
    integrations: {
      selectedIntegrationLabels: ["Google Analytics", "Paystack"],
    },
  },
  setupChecklist: ["Discovery call"],
  internalNotes: "",
  assignedOwner: "admin@example.com",
  activityTimeline: [
    {
      type: "status_changed",
      label: "Status changed",
      at: "2026-06-18T10:00:00.000Z",
      by: "Admin",
      from: "New",
      to: "Proposal Sent",
    },
  ],
  emailDelivery: {
    status: "sent",
    updatedAt: "2026-06-18T09:06:00.000Z",
    attempts: [{ type: "admin_summary", status: "sent", deliveryRecipient: "dev@nanaabaackah.com" }],
  },
  pdfSummary: {
    stored: false,
    fileName: "faako-client-setup-aba-creative-studio.pdf",
    generatedAt: "2026-06-18T09:05:00.000Z",
  },
  archivedAt: null,
  archivedBy: null,
};

test("Faako onboarding status options cover the internal workflow", () => {
  assert.deepEqual(
    FAAKO_ONBOARDING_STATUS_OPTIONS.map((option) => option.value),
    [
      "NEW",
      "REVIEWED",
      "CONTACTED",
      "PROPOSAL_SENT",
      "APPROVED",
      "SETUP_IN_PROGRESS",
      "CONVERTED",
      "CLOSED",
    ],
  );
});

test("buildWizardSections hides blank wizard answers and sections", () => {
  const sections = buildWizardSections(sampleRow.onboardingIntake);
  const company = sections.find((section) => section.key === "company");
  const brand = sections.find((section) => section.key === "brand");
  const integrations = sections.find((section) => section.key === "integrations");

  assert.equal(company.fields.some((field) => field.key === "company.tradingName"), false);
  assert.equal(brand.fields.some((field) => field.key === "brand.colourScheme"), false);
  assert.equal(
    integrations.fields.find((field) => field.key === "integrations.selectedIntegrationLabels").value,
    "Google Analytics, Paystack",
  );
});

test("serializeFaakoOnboardingSubmission exposes detail metadata for Dev ERP", () => {
  const submission = serializeFaakoOnboardingSubmission(sampleRow, { includeDetail: true });

  assert.equal(submission.companyName, "Aba Creative Studio");
  assert.equal(submission.phone, "N/A");
  assert.equal(submission.status.label, "Proposal Sent");
  assert.equal(submission.assignedOwner, "admin@example.com");
  assert.equal(submission.archivedAt, null);
  assert.equal(submission.archivedBy, "");
  assert.equal(submission.emailDelivery.status, "sent");
  assert.equal(submission.pdfSummary.stored, false);
  assert.equal(submission.wizardSections.some((section) => section.key === "website"), false);
  assert.equal(
    submission.wizardSections.some((section) =>
      section.fields.some((field) => field.value === "N/A")
    ),
    false,
  );
  assert.equal(submission.activityTimeline[0].type, "status_changed");
});

test("serializeFaakoOnboardingSubmission exposes archive metadata", () => {
  const submission = serializeFaakoOnboardingSubmission({
    ...sampleRow,
    archivedAt: new Date("2026-06-18T11:00:00.000Z"),
    archivedBy: "Admin User",
  });

  assert.equal(submission.archivedAt, "2026-06-18T11:00:00.000Z");
  assert.equal(submission.archivedBy, "Admin User");
});

test("status updates ignore empty legacy management fields before the Faako migration", () => {
  const patch = buildUpdatePatch({
    body: {
      status: "REVIEWED",
      internalNotes: "",
      assignedOwner: "",
    },
    existingRow: {
      ...sampleRow,
      status: "NEW",
      internalNotes: undefined,
      assignedOwner: undefined,
      activityTimeline: undefined,
    },
    columns: new Set(["status", "updatedAt"]),
    user: { fullName: "Admin User" },
  });

  assert.equal(patch.error, undefined);
  assert.deepEqual(patch.changedFields, ["status"]);
  assert.equal(patch.updates.includes('"status" = $1'), true);
});

test("non-empty management fields still require the Faako migration", () => {
  const patch = buildUpdatePatch({
    body: { status: "REVIEWED", internalNotes: "Follow up tomorrow." },
    existingRow: { ...sampleRow, status: "NEW", internalNotes: undefined },
    columns: new Set(["status", "updatedAt"]),
    user: { fullName: "Admin User" },
  });

  assert.equal(patch.errorStatus, 409);
  assert.match(patch.error, /Faako migration/i);
});

test("converting a submission returns and audits the resolved project result", async () => {
  let mountedRouter;
  let auditEntry;
  const columns = Object.keys(sampleRow).concat(["managementUpdatedAt", "managementUpdatedBy"]);
  const convertedRow = {
    ...sampleRow,
    status: "CONVERTED",
    updatedAt: new Date("2026-06-18T11:30:00.000Z"),
  };
  const existingProject = {
    id: 42,
    organizationId: 7,
    organization: { id: 7, name: "Faako", slug: "faako" },
    ownerUserId: 9,
    ownerUser: { id: 9, fullName: "Admin User", email: "admin@example.com" },
    title: "Aba Creative Studio - Growth setup",
    clientName: "Aba Creative Studio",
    projectType: "EXTERNAL",
    stage: "ACTIVE",
    priority: "HIGH",
    currency: "GHS",
    budgetAmount: null,
    dueDate: null,
    description: "Converted onboarding project.",
    externalRef: "faako-onboarding:signup-1",
    archivedAt: null,
    createdAt: new Date("2026-06-18T11:20:00.000Z"),
    updatedAt: new Date("2026-06-18T11:20:00.000Z"),
  };
  const faakoPool = {
    async query(sql) {
      if (sql.includes("information_schema.tables")) {
        return { rows: [{ table_schema: "public", table_name: "SignupRequest" }] };
      }
      if (sql.includes("information_schema.columns")) {
        return { rows: columns.map((column_name) => ({ column_name })) };
      }
      if (sql.includes("SELECT") && sql.includes('WHERE "id" = $1')) {
        return { rows: [sampleRow] };
      }
      if (sql.includes("UPDATE")) {
        return { rows: [convertedRow] };
      }
      throw new Error(`Unexpected query in onboarding route test: ${sql}`);
    },
  };
  const prisma = {
    project: {
      findFirst: async () => existingProject,
      create: async () => {
        throw new Error("Existing converted project should be reused.");
      },
    },
  };
  const app = {
    use(path, router) {
      assert.equal(path, "/api/faako-onboarding");
      mountedRouter = router;
    },
  };

  registerFaakoOnboardingRoutes(app, {
    faakoPool,
    prisma,
    authMiddleware: (_req, _res, next) => next(),
    requireAdmin: (_req, _res, next) => next(),
    writeAuditLog: async (_prisma, entry) => {
      auditEntry = entry;
    },
  });

  const patchLayer = mountedRouter.stack.find(
    (layer) => layer.route?.path === "/:id" && layer.route.methods.patch,
  );
  const patchHandler = patchLayer.route.stack.at(-1).handle;
  const req = {
    params: { id: sampleRow.id },
    body: { status: "CONVERTED" },
    user: {
      userId: 9,
      organizationId: 7,
      fullName: "Admin User",
      email: "admin@example.com",
    },
    headers: { "x-request-id": "request-1" },
    ip: "127.0.0.1",
  };
  const res = {
    statusCode: 200,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return payload;
    },
  };

  await patchHandler(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.project.created, false);
  assert.equal(res.body.project.project.id, 42);
  assert.equal(auditEntry.metadata.convertedProject.project.id, 42);
});
