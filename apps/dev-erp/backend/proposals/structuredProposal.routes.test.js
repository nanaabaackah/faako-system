import assert from "node:assert/strict";
import crypto from "node:crypto";
import test from "node:test";

import { createStructuredProposalHandlers } from "./structuredProposal.routes.js";

const createResponse = () => ({
  statusCode: 200,
  body: null,
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(body) {
    this.body = body;
    return this;
  },
  send(body = null) {
    this.body = body;
    return this;
  },
});
const request = ({ params = {}, query = {}, body = {}, headers = {}, user = {} } = {}) => ({
  params,
  query,
  body,
  headers,
  requestId: "request-test",
  user: { userId: 7, organizationId: 2, roleName: "Admin", ...user },
});

test("catalogue list remains tenant scoped for organization admins", async () => {
  let where = null;
  const prisma = {
    commercialCatalogueItem: {
      findMany: async (args) => {
        where = args.where;
        return [];
      },
    },
  };
  const handlers = createStructuredProposalHandlers({ prisma, isGlobalAdmin: () => false });
  const res = createResponse();
  await handlers.listCatalogue(request({ query: { organizationId: "99", kind: "SERVICE" } }), res);
  assert.equal(res.statusCode, 200);
  assert.equal(where.organizationId, 2);
  assert.equal(where.kind, "SERVICE");
});

test("catalogue create prevents normalized duplicates within the tenant", async () => {
  const prisma = {
    commercialCatalogueItem: {
      findFirst: async (args) => {
        assert.deepEqual(args.where, {
          organizationId: 2,
          kind: "SERVICE",
          normalizedName: "website development",
        });
        return { id: 4 };
      },
    },
  };
  const handlers = createStructuredProposalHandlers({ prisma, isGlobalAdmin: () => false });
  const res = createResponse();
  await handlers.createCatalogueItem(
    request({ body: { kind: "service", name: " Website   Development " } }),
    res
  );
  assert.equal(res.statusCode, 409);
  assert.match(res.body.error, /already exists/);
});

test("catalogue create rejects unsupported billing enum values before persistence", async () => {
  let created = false;
  const prisma = {
    commercialCatalogueItem: {
      findFirst: async () => null,
      create: async () => {
        created = true;
      },
    },
  };
  const handlers = createStructuredProposalHandlers({ prisma, isGlobalAdmin: () => false });
  const res = createResponse();
  await handlers.createCatalogueItem(
    request({ body: { kind: "service", name: "Support", defaultBillingType: "sometimes" } }),
    res
  );
  assert.equal(res.statusCode, 400);
  assert.match(res.body.error, /billing defaults/);
  assert.equal(created, false);
});

test("published proposal versions reject edits before any write", async () => {
  let transactionCalled = false;
  const prisma = {
    proposal: {
      findFirst: async (args) => {
        assert.deepEqual(args.where, { id: 5, organizationId: 2 });
        return { id: 5, organizationId: 2, title: "Proposal" };
      },
    },
    proposalVersion: {
      findFirst: async () => ({
        id: 8,
        proposalId: 5,
        status: "PUBLISHED",
        items: [],
        billingSchedule: [],
      }),
    },
    $transaction: async () => {
      transactionCalled = true;
    },
  };
  const handlers = createStructuredProposalHandlers({ prisma, isGlobalAdmin: () => false });
  const res = createResponse();
  await handlers.updateVersion(
    request({ params: { proposalId: "5", versionId: "8" }, body: { commercial: {} } }),
    res
  );
  assert.equal(res.statusCode, 409);
  assert.match(res.body.error, /immutable/);
  assert.equal(transactionCalled, false);
});

test("proposal version lookups enforce proposal tenant ownership", async () => {
  let versionRead = false;
  const prisma = {
    proposal: { findFirst: async () => null },
    proposalVersion: {
      findFirst: async () => {
        versionRead = true;
      },
    },
  };
  const handlers = createStructuredProposalHandlers({ prisma, isGlobalAdmin: () => false });
  const res = createResponse();
  await handlers.updateVersion(
    request({ params: { proposalId: "5", versionId: "8" } }),
    res
  );
  assert.equal(res.statusCode, 404);
  assert.equal(versionRead, false);
});

test("proposal access links persist only a hash and return the raw token once", async () => {
  let persisted = null;
  const prisma = {
    proposal: {
      findFirst: async () => ({ id: 5, organizationId: 2, title: "Proposal" }),
    },
    proposalVersion: {
      findFirst: async () => ({
        id: 8,
        proposalId: 5,
        status: "PUBLISHED",
        items: [],
        billingSchedule: [],
      }),
    },
    proposalAccessLink: {
      create: async ({ data }) => {
        persisted = data;
        return { id: 12, ...data };
      },
    },
  };
  const handlers = createStructuredProposalHandlers({ prisma, isGlobalAdmin: () => false });
  const res = createResponse();
  await handlers.prepareAccessLink(
    request({ params: { proposalId: "5", versionId: "8" }, body: { ttlHours: 24 } }),
    res
  );
  assert.equal(res.statusCode, 201);
  assert.match(res.body.access.token, /^[a-f0-9]{64}$/);
  assert.equal(
    persisted.tokenHash,
    crypto.createHash("sha256").update(res.body.access.token).digest("hex")
  );
  assert.notEqual(persisted.tokenHash, res.body.access.token);
  assert.equal("token" in persisted, false);
});

test("proposal email delivery sends once and rotates older links only after success", async () => {
  let createdData = null;
  let rotatedWhere = null;
  const version = {
    id: 8, proposalId: 5, status: "PUBLISHED", versionNumber: 2,
    title: "Website", customerName: "Client", customerEmail: "client@example.com",
    validUntil: new Date(Date.now() + 86400000), items: [], billingSchedule: [],
    accessLinks: [{ id: 22, deliveryStatus: "SENT" }],
  };
  const prisma = {
    proposal: { findFirst: async () => ({ id: 5, organizationId: 2, title: "Website" }) },
    proposalVersion: { findFirst: async () => version },
    proposalAccessLink: {
      findFirst: async () => null,
      create: async ({ data }) => { createdData = data; return { id: 31, ...data }; },
    },
    $transaction: async (callback) => callback({
      proposalAccessLink: {
        update: async () => ({}),
        updateMany: async ({ where }) => { rotatedWhere = where; return { count: 1 }; },
      },
    }),
  };
  let notification = null;
  let auditEvent = null;
  const handlers = createStructuredProposalHandlers({
    prisma,
    isGlobalAdmin: () => false,
    proposalNotifier: async (payload) => { notification = payload; return { providerMessageId: "email-1" }; },
    auditWriter: async (event) => { auditEvent = event; },
  });
  const res = createResponse();
  await handlers.sendPublishedVersion(request({
    params: { proposalId: "5", versionId: "8" },
    headers: { "idempotency-key": "send-request-123" },
    body: { recipient: "CLIENT@example.com", personalMessage: "Please review", ttlHours: 24 },
  }), res);
  assert.equal(res.statusCode, 201);
  assert.equal(createdData.sentTo, "client@example.com");
  assert.equal(createdData.deliveryStatus, "PENDING");
  assert.equal("token" in createdData, false);
  assert.equal(notification.recipient, "client@example.com");
  assert.deepEqual(rotatedWhere.id, { not: 31 });
  assert.equal(auditEvent.action, "PROPOSAL_EMAIL_RESENT");
  assert.match(res.body.access.token, /^[a-f0-9]{64}$/);
});

test("failed proposal delivery revokes only the new link and preserves old links", async () => {
  let failedUpdate = null;
  let transactionCalled = false;
  const prisma = {
    proposal: { findFirst: async () => ({ id: 5, organizationId: 2 }) },
    proposalVersion: { findFirst: async () => ({
      id: 8, proposalId: 5, status: "PUBLISHED", versionNumber: 1, title: "Proposal",
      customerEmail: "client@example.com", validUntil: new Date(Date.now() + 86400000),
      items: [], billingSchedule: [], accessLinks: [],
    }) },
    proposalAccessLink: {
      findFirst: async () => null,
      create: async ({ data }) => ({ id: 40, ...data }),
      update: async ({ data }) => { failedUpdate = data; return {}; },
    },
    $transaction: async () => { transactionCalled = true; },
  };
  const handlers = createStructuredProposalHandlers({
    prisma, isGlobalAdmin: () => false,
    proposalNotifier: async () => { throw Object.assign(new Error("secret provider detail"), { statusCode: 503 }); },
    auditWriter: async () => {},
  });
  const res = createResponse();
  await handlers.sendPublishedVersion(request({
    params: { proposalId: "5", versionId: "8" },
    headers: { "idempotency-key": "send-request-fail" },
  }), res);
  assert.equal(res.statusCode, 503);
  assert.equal(res.body.failureCategory, "PROVIDER_UNAVAILABLE");
  assert.equal(failedUpdate.deliveryStatus, "FAILED");
  assert.ok(failedUpdate.revokedAt instanceof Date);
  assert.equal(transactionCalled, false);
  assert.doesNotMatch(res.body.error, /secret provider detail/);
});

test("proposal delivery reports incomplete server email configuration safely", async () => {
  let failedUpdate = null;
  const prisma = {
    proposal: { findFirst: async () => ({ id: 5, organizationId: 2 }) },
    proposalVersion: { findFirst: async () => ({
      id: 8, proposalId: 5, status: "PUBLISHED", versionNumber: 1, title: "Proposal",
      customerEmail: "client@example.com", validUntil: new Date(Date.now() + 86400000),
      items: [], billingSchedule: [], accessLinks: [],
    }) },
    proposalAccessLink: {
      findFirst: async () => null,
      create: async ({ data }) => ({ id: 45, ...data }),
      update: async ({ data }) => { failedUpdate = data; return {}; },
    },
  };
  const handlers = createStructuredProposalHandlers({
    prisma, isGlobalAdmin: () => false,
    proposalNotifier: async () => {
      throw Object.assign(new Error("RESEND_API_KEY is not configured"), {
        code: "EMAIL_PROVIDER_NOT_CONFIGURED",
        statusCode: 503,
      });
    },
    auditWriter: async () => {},
  });
  const res = createResponse();
  await handlers.sendPublishedVersion(request({
    params: { proposalId: "5", versionId: "8" },
    headers: { "idempotency-key": "configuration-failure" },
  }), res);

  assert.equal(res.statusCode, 503);
  assert.equal(res.body.failureCategory, "DELIVERY_CONFIGURATION");
  assert.match(res.body.error, /APP_BASE_URL.*RESEND_API_KEY.*PROPOSAL_EMAIL_FROM.*DEFAULT_ADMIN_EMAIL/);
  assert.doesNotMatch(res.body.error, /not configured$/);
  assert.equal(failedUpdate.failureCategory, "DELIVERY_CONFIGURATION");
  assert.ok(failedUpdate.revokedAt instanceof Date);
});

test("proposal send idempotency replays success without sending again", async () => {
  let sent = false;
  const existing = {
    id: 44, proposalVersionId: 8, deliveryStatus: "SENT", sentTo: "client@example.com",
    sentAt: new Date("2026-10-20T10:00:00Z"), expiresAt: new Date("2026-11-03T10:00:00Z"),
  };
  const fingerprint = crypto.createHash("sha256").update(JSON.stringify({
    versionId: 8, recipient: "client@example.com", personalMessage: "", ttlHours: 336,
  })).digest("hex");
  existing.sendRequestFingerprint = fingerprint;
  const prisma = {
    proposal: { findFirst: async () => ({ id: 5, organizationId: 2 }) },
    proposalVersion: { findFirst: async () => ({
      id: 8, proposalId: 5, status: "PUBLISHED", customerEmail: "client@example.com",
      validUntil: new Date("2026-12-01T00:00:00Z"), items: [], billingSchedule: [], accessLinks: [],
    }) },
    proposalAccessLink: { findFirst: async () => existing },
  };
  const handlers = createStructuredProposalHandlers({
    prisma, isGlobalAdmin: () => false, proposalNotifier: async () => { sent = true; },
  });
  const res = createResponse();
  await handlers.sendPublishedVersion(request({
    params: { proposalId: "5", versionId: "8" },
    headers: { "idempotency-key": "send-request-replay" },
  }), res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.duplicate, true);
  assert.equal(sent, false);
  assert.equal("access" in res.body, false);
});

test("approval snapshot preparation never accepts a proposal and is single-use per version", async () => {
  let created = false;
  const prisma = {
    proposal: {
      findFirst: async () => ({ id: 5, organizationId: 2, title: "Proposal" }),
    },
    proposalVersion: {
      findFirst: async () => ({
        id: 8,
        proposalId: 5,
        status: "PUBLISHED",
        items: [],
        billingSchedule: [],
      }),
    },
    proposalApprovalSnapshot: {
      findUnique: async () => ({ id: 13 }),
      create: async () => {
        created = true;
      },
    },
  };
  const handlers = createStructuredProposalHandlers({ prisma, isGlobalAdmin: () => false });
  const res = createResponse();
  await handlers.prepareApprovalSnapshot(
    request({ params: { proposalId: "5", versionId: "8" } }),
    res
  );
  assert.equal(res.statusCode, 409);
  assert.match(res.body.error, /already exists/);
  assert.equal(created, false);
});

test("structured proposal management rejects unsupported status filters before querying", async () => {
  let queried = false;
  const prisma = {
    proposal: {
      findMany: async () => {
        queried = true;
        return [];
      },
    },
  };
  const handlers = createStructuredProposalHandlers({ prisma, isGlobalAdmin: () => false });
  const res = createResponse();
  await handlers.listStructuredProposals(request({ query: { status: "unknown" } }), res);
  assert.equal(res.statusCode, 400);
  assert.equal(queried, false);
});

test("client questions are token scoped, audited, and idempotent", async () => {
  const token = "a".repeat(64);
  let saved = null;
  const audits = [];
  const link = {
    id: 17,
    expiresAt: new Date(Date.now() + 60_000),
    revokedAt: null,
    proposalVersion: {
      id: 8,
      proposalId: 5,
      status: "PUBLISHED",
      proposal: { organizationId: 2 },
    },
  };
  const prisma = {
    proposalAccessLink: { findUnique: async () => link },
    proposalRevisionRequest: {
      findUnique: async ({ where }) => saved?.requestKey === where.requestKey ? saved : null,
      create: async ({ data }) => {
        saved = { id: 21, status: "OPEN", ...data };
        return saved;
      },
    },
  };
  const handlers = createStructuredProposalHandlers({
    prisma,
    isGlobalAdmin: () => false,
    auditWriter: async (event) => audits.push(event),
  });
  const input = request({
    params: { token },
    body: { kind: "QUESTION", message: "Can delivery start sooner?", requestKey: "client-key" },
  });
  const first = createResponse();
  await handlers.submitClientMessage(input, first);
  assert.equal(first.statusCode, 201);
  assert.equal(saved.kind, "QUESTION");
  assert.notEqual(saved.requestKey, "client-key");
  assert.equal(audits[0].organizationId, 2);

  const duplicate = createResponse();
  await handlers.submitClientMessage(input, duplicate);
  assert.equal(duplicate.statusCode, 200);
  assert.equal(duplicate.body.duplicate, true);
  assert.equal(audits.length, 1);
});

test("staff can resolve only open requests belonging to the scoped version", async () => {
  let updated = null;
  const prisma = {
    proposal: {
      findFirst: async () => ({ id: 5, organizationId: 2, title: "Proposal" }),
    },
    proposalVersion: {
      findFirst: async () => ({ id: 8, proposalId: 5, status: "PUBLISHED", items: [], billingSchedule: [] }),
    },
    proposalRevisionRequest: {
      findFirst: async ({ where }) => {
        assert.deepEqual(where, { id: 21, proposalVersionId: 8 });
        return { id: 21, kind: "REVISION", status: "OPEN" };
      },
      update: async ({ data }) => {
        updated = data;
        return { id: 21, kind: "REVISION", ...data };
      },
    },
  };
  const handlers = createStructuredProposalHandlers({ prisma, isGlobalAdmin: () => false });
  const res = createResponse();
  await handlers.resolveRevisionRequest(request({
    params: { proposalId: "5", versionId: "8", requestId: "21" },
    body: { status: "RESOLVED" },
  }), res);
  assert.equal(res.statusCode, 200);
  assert.equal(updated.status, "RESOLVED");
  assert.ok(updated.resolvedAt instanceof Date);
});

test("revoked and expired public links cannot expose proposal details", async () => {
  const token = "b".repeat(64);
  const handlersFor = (link) => createStructuredProposalHandlers({
    prisma: {
      proposalAccessLink: {
        findUnique: async () => link,
        update: async () => assert.fail("Unavailable links must not record access."),
      },
    },
    isGlobalAdmin: () => false,
  });

  const revoked = createResponse();
  await handlersFor({
    revokedAt: new Date(),
    expiresAt: new Date(Date.now() + 60_000),
  }).viewInteractive(request({ params: { token } }), revoked);
  assert.equal(revoked.statusCode, 404);

  const expired = createResponse();
  await handlersFor({
    revokedAt: null,
    expiresAt: new Date(Date.now() - 60_000),
  }).viewInteractive(request({ params: { token } }), expired);
  assert.equal(expired.statusCode, 410);
});

test("pricing preview discards client totals and recalculates the proposal", async () => {
  const handlers = createStructuredProposalHandlers({ prisma: {}, isGlobalAdmin: () => false });
  const res = createResponse();
  await handlers.previewPricing(request({
    body: {
      commercial: {
        title: "Website",
        depositPercent: 50,
        totals: { oneTimeTotal: 1, depositAmount: 1 },
        items: [{ kind: "SERVICE", name: "Website Development", unitPrice: 5000 }],
      },
    },
  }), res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.commercial.totals.oneTimeTotal, 5000);
  assert.equal(res.body.commercial.totals.depositAmount, 2500);
});

const acceptedVersionFixture = (overrides = {}) => ({
  id: 8,
  proposalId: 5,
  versionNumber: 2,
  status: "PUBLISHED",
  title: "Website proposal",
  currency: "GHS",
  validUntil: new Date("2099-12-31T00:00:00.000Z"),
  customerName: "Client",
  customerEmail: "client@example.com",
  customerAddress: null,
  scope: "Build the approved website.",
  exclusions: ["Copywriting"],
  terms: ["50% deposit"],
  sourceSnapshot: {
    schemaVersion: 2,
    title: "Website proposal",
    currency: "GHS",
    customer: { name: "Client", email: "client@example.com" },
    project: {},
    depositPercent: 50,
    items: [{
      key: "source-1",
      kind: "SERVICE",
      name: "Website Development",
      quantity: 1,
      unitPrice: 5000,
      billingType: "ONE_TIME",
      required: true,
      selected: true,
    }],
  },
  items: [{
    id: 41,
    kind: "SERVICE",
    name: "Website Development",
    description: "Website delivery",
    deliverables: ["Responsive website"],
    quantity: 1,
    unitPrice: 5000,
    discount: 0,
    amount: 5000,
    billingType: "ONE_TIME",
    billingFrequency: "NONE",
    required: true,
    clientSelectable: false,
    selectedByDefault: true,
    custom: false,
    costOwnership: "FAAKO_BILLED",
    sortOrder: 0,
  }],
  billingSchedule: [{
    id: 51,
    type: "DEPOSIT",
    label: "Deposit",
    percentage: 50,
    amount: 2500,
    billingFrequency: "NONE",
    sortOrder: 0,
  }],
  invoices: [],
  approvalSnapshot: null,
  proposal: { id: 5, organizationId: 2, clientName: "Client" },
  ...overrides,
});

test("formal acceptance snapshots server pricing and transitions exactly one published version", async () => {
  const token = "c".repeat(64);
  const version = acceptedVersionFixture();
  let snapshotData = null;
  let transitioned = 0;
  const prisma = {
    proposalAccessLink: {
      findUnique: async () => ({
        id: 17,
        revokedAt: null,
        expiresAt: new Date("2099-12-31T00:00:00.000Z"),
        proposalVersion: version,
      }),
    },
    proposalApprovalSnapshot: { findUnique: async () => null },
    proposalClientSelection: { findMany: async () => [] },
    $transaction: async (callback) => callback({
      proposalVersion: {
        updateMany: async () => {
          transitioned += 1;
          return { count: 1 };
        },
      },
      proposalApprovalSnapshot: {
        create: async ({ data }) => {
          snapshotData = data;
          return { id: 61, ...data };
        },
      },
      proposalBillingScheduleItem: { updateMany: async () => ({ count: 1 }) },
    }),
  };
  const handlers = createStructuredProposalHandlers({
    prisma,
    isGlobalAdmin: () => false,
    acceptanceNotifier: async () => { throw new Error("provider unavailable"); },
  });
  const res = createResponse();
  await handlers.acceptInteractive(request({
    params: { token },
    body: {
      expectedVersionNumber: 2,
      approverName: "Client Signatory",
      approverContact: "client@example.com",
      consentConfirmed: true,
      requestKey: "accept-once",
      totals: { oneTimeTotal: 1 },
    },
  }), res);
  assert.equal(res.statusCode, 201);
  assert.equal(transitioned, 1);
  assert.equal(snapshotData.pricingSnapshot.oneTimeTotal, 5000);
  assert.equal(snapshotData.pricingSnapshot.depositAmount, 2500);
  assert.equal(snapshotData.consentConfirmed, true);
  assert.equal(snapshotData.scopeSnapshot.items[0].deliverables[0], "Responsive website");
  assert.equal(res.body.notification.status, "failed");
});

test("acceptance rejects version mismatch before writing", async () => {
  let wrote = false;
  const prisma = {
    proposalAccessLink: {
      findUnique: async () => ({
        id: 17,
        revokedAt: null,
        expiresAt: new Date("2099-12-31T00:00:00.000Z"),
        proposalVersion: acceptedVersionFixture(),
      }),
    },
    $transaction: async () => { wrote = true; },
  };
  const handlers = createStructuredProposalHandlers({ prisma, isGlobalAdmin: () => false });
  const res = createResponse();
  await handlers.acceptInteractive(request({
    params: { token: "d".repeat(64) },
    body: { expectedVersionNumber: 1, consentConfirmed: true },
  }), res);
  assert.equal(res.statusCode, 409);
  assert.equal(wrote, false);
});

test("billing invoice generation is idempotent and preserves accepted traceability", async () => {
  const version = acceptedVersionFixture({
    status: "ACCEPTED",
    approvalSnapshot: { id: 61, status: "ACCEPTED" },
  });
  const proposal = { id: 5, organizationId: 2, clientName: "Client" };
  const billingItem = {
    id: 51,
    proposalVersionId: 8,
    type: "DEPOSIT",
    label: "Deposit",
    amount: 2500,
    status: "ACTIVE",
    generationRule: "ON_ACCEPTANCE",
    billingFrequency: "NONE",
    generatedCount: 0,
    startDate: new Date("2026-10-16T00:00:00.000Z"),
  };
  let storedInvoice = null;
  let createCount = 0;
  const prisma = {
    proposal: { findFirst: async () => proposal },
    proposalVersion: { findFirst: async () => version },
    proposalBillingScheduleItem: { findFirst: async () => billingItem },
    invoice: {
      findUnique: async () => storedInvoice,
      count: async () => 0,
    },
    $transaction: async (callback) => callback({
      invoice: {
        create: async ({ data }) => {
          createCount += 1;
          storedInvoice = { id: 71, ...data };
          return storedInvoice;
        },
      },
      proposalBillingScheduleItem: { update: async () => billingItem },
    }),
  };
  const handlers = createStructuredProposalHandlers({ prisma, isGlobalAdmin: () => false });
  const input = request({ params: { proposalId: "5", versionId: "8", billingItemId: "51" } });
  const first = createResponse();
  await handlers.generateBillingInvoice(input, first);
  assert.equal(first.statusCode, 201);
  assert.equal(storedInvoice.proposalVersionId, 8);
  assert.equal(storedInvoice.billingScheduleItemId, 51);
  assert.match(storedInvoice.generationKey, /proposal:8:billing:51/);

  const duplicate = createResponse();
  await handlers.generateBillingInvoice(input, duplicate);
  assert.equal(duplicate.statusCode, 200);
  assert.equal(duplicate.body.created, false);
  assert.equal(createCount, 1);
});

test("failed invoice generation preserves acceptance and exposes a recoverable billing error", async () => {
  const version = acceptedVersionFixture({
    status: "ACCEPTED",
    approvalSnapshot: { id: 61, status: "ACCEPTED" },
  });
  let recoveryStatus = null;
  const prisma = {
    proposal: { findFirst: async () => ({ id: 5, organizationId: 2, clientName: "Client" }) },
    proposalVersion: { findFirst: async () => version },
    proposalBillingScheduleItem: {
      findFirst: async () => ({
        id: 51,
        proposalVersionId: 8,
        type: "DEPOSIT",
        label: "Deposit",
        amount: 2500,
        status: "ACTIVE",
        generationRule: "ON_ACCEPTANCE",
        billingFrequency: "NONE",
        generatedCount: 0,
      }),
      update: async ({ data }) => { recoveryStatus = data.status; },
    },
    invoice: { findUnique: async () => null, count: async () => 0 },
    $transaction: async (callback) => callback({
      invoice: { create: async () => { throw new Error("database unavailable"); } },
    }),
  };
  const handlers = createStructuredProposalHandlers({ prisma, isGlobalAdmin: () => false });
  await assert.rejects(
    handlers.generateBillingInvoice(
      request({ params: { proposalId: "5", versionId: "8", billingItemId: "51" } }),
      createResponse()
    ),
    /database unavailable/
  );
  assert.equal(recoveryStatus, "ERROR");
  assert.equal(version.status, "ACCEPTED");
});

test("withdrawal is transactional and revokes outstanding client links", async () => {
  let revoked = false;
  const withdrawn = acceptedVersionFixture({ status: "WITHDRAWN", accessLinks: [] });
  const prisma = {
    proposal: { findFirst: async () => ({ id: 5, organizationId: 2 }) },
    proposalVersion: { findFirst: async () => acceptedVersionFixture() },
    $transaction: async (callback) => callback({
      proposalVersion: {
        updateMany: async () => ({ count: 1 }),
        findUnique: async () => withdrawn,
      },
      proposalAccessLink: { updateMany: async () => { revoked = true; } },
    }),
  };
  const handlers = createStructuredProposalHandlers({ prisma, isGlobalAdmin: () => false });
  const res = createResponse();
  await handlers.withdrawVersion(request({ params: { proposalId: "5", versionId: "8" } }), res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.version.status, "WITHDRAWN");
  assert.equal(revoked, true);
});

test("accepted project linkage remains tenant scoped and references the accepted version", async () => {
  let projectWhere = null;
  let projectUpdate = null;
  let proposalUpdate = null;
  const prisma = {
    proposalVersion: {
      findFirst: async () => acceptedVersionFixture({
        status: "ACCEPTED",
        approvalSnapshot: { id: 61, status: "ACCEPTED" },
        deliveryProject: null,
      }),
    },
    project: {
      findFirst: async ({ where }) => {
        projectWhere = where;
        return { id: 22, title: "Delivery", stage: "SCOPING", ownerUserId: null, acceptedProposalVersionId: null };
      },
      update: async ({ data }) => { projectUpdate = data; return { id: 22 }; },
    },
    proposal: {
      findFirst: async () => ({ id: 5, organizationId: 2, projectId: null }),
      update: async ({ data }) => { proposalUpdate = data; return { id: 5 }; },
    },
    $transaction: async (operations) => Promise.all(operations),
  };
  const handlers = createStructuredProposalHandlers({ prisma, isGlobalAdmin: () => false });
  const res = createResponse();
  await handlers.linkAcceptedProject(request({
    params: { proposalId: "5", versionId: "8" },
    body: { projectId: 22 },
  }), res);
  assert.equal(res.statusCode, 200);
  assert.equal(projectWhere.organizationId, 2);
  assert.equal(projectUpdate.acceptedProposalVersionId, 8);
  assert.equal(proposalUpdate.projectId, 22);
});
