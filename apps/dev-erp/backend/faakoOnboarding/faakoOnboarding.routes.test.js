import assert from "node:assert/strict";
import test from "node:test";
import {
  FAAKO_ONBOARDING_STATUS_OPTIONS,
  buildConvertedProjectPayload,
  buildUpdatePatch,
  buildWizardSections,
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

test("buildUpdatePatch persists status changes and conversion project activity", () => {
  const patch = buildUpdatePatch({
    body: { status: "CONVERTED" },
    existingRow: sampleRow,
    columns: new Set(["status", "activityTimeline", "managementUpdatedAt", "managementUpdatedBy", "updatedAt"]),
    user: { fullName: "Ops Admin" },
    extraTimelineEntries: [
      {
        type: "project_created",
        label: "Project created",
        note: "Aba Creative Studio - Growth setup (#42)",
      },
    ],
  });

  assert.deepEqual(patch.changedFields, ["status", "project"]);
  assert.equal(patch.values[0], "CONVERTED");
  assert.equal(patch.updates.some((update) => update === "\"status\" = $1"), true);
  const timeline = JSON.parse(patch.values[1]);
  const conversionEntries = timeline.slice(-2);
  assert.equal(conversionEntries[0].type, "status_changed");
  assert.equal(conversionEntries[0].to, "Converted");
  assert.equal(conversionEntries[1].type, "project_created");
  assert.equal(conversionEntries[1].note, "Aba Creative Studio - Growth setup (#42)");
});

test("buildConvertedProjectPayload maps converted submissions into external projects", () => {
  const payload = buildConvertedProjectPayload(sampleRow, { organizationId: 7, ownerUserId: 3 });

  assert.equal(payload.organizationId, 7);
  assert.equal(payload.ownerUserId, 3);
  assert.equal(payload.title, "Aba Creative Studio - Growth setup");
  assert.equal(payload.clientName, "Aba Creative Studio");
  assert.equal(payload.projectType, "EXTERNAL");
  assert.equal(payload.stage, "ACTIVE");
  assert.equal(payload.priority, "HIGH");
  assert.equal(payload.currency, "GHS");
  assert.equal(payload.externalRef, "faako-onboarding:signup-1");
  assert.match(payload.description, /Contact: Nana Aba <hello@example.com>/);
  assert.match(payload.description, /Requested modules: website, portal/);
  assert.match(payload.description, /Setup checklist: Discovery call/);
});
