import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { Invitations } from "../src/onboarding/invitations.js";
import {
  invitationEmailCode, readInvitationDeliveryConfig, readInvitationPortalOrigin,
} from "../src/onboarding/invitation-email.js";
import {
  InvitationEmailSender, deliverOneInvitation,
} from "../src/notifications/invitations.js";
import { defaultInvitationCopy, invitationTemplate } from "../src/notifications/enquiry-template.js";

const organisationId = "00000000-0000-4000-8000-000000000001";
const secret = Buffer.alloc(32, 31).toString("base64url");
const enabled = readInvitationDeliveryConfig({
  TWE_INVITATION_DELIVERY_ENABLED: "true", TWE_INVITATION_DELIVERY_SECRET: secret,
});
const job = {
  invitation_id: "00000000-0000-4000-8000-000000000002",
  organisation_id: organisationId,
  environment: "staging",
  recipient_email: "invited@example.invalid",
  subject: "cf:verified-identity",
  role: "editor",
  expires_at: "2026-11-15T17:00:00.000Z",
  template_snapshot: defaultInvitationCopy,
};

test("automatic email delivery is opt-in and requires an independently generated 32-byte secret", () => {
  assert.equal(readInvitationDeliveryConfig({}), null);
  assert.equal(readInvitationDeliveryConfig({ TWE_INVITATION_DELIVERY_ENABLED: "false" }), null);
  for (const value of ["", "short", "x".repeat(42), "\n".repeat(43)]) {
    assert.throws(() => readInvitationDeliveryConfig({
      TWE_INVITATION_DELIVERY_ENABLED: "true", TWE_INVITATION_DELIVERY_SECRET: value,
    }));
  }
  // Exactly 32 decoded bytes are required; entropy comes from a crypto RNG.
  assert.equal(enabled.key.length, 32);
  assert.equal(readInvitationPortalOrigin({ TWE_INVITATION_PORTAL_ORIGIN: "https://portal-staging.example.invalid" }),
    "https://portal-staging.example.invalid");
  for (const url of ["http://portal.example.invalid", "https://evil.example.invalid/path",
    "https://alice:pass@portal.example.invalid", "https://portal.example.invalid/?code=x"]) {
    assert.throws(() => readInvitationPortalOrigin({ TWE_INVITATION_PORTAL_ORIGIN: url }));
  }
});

test("invitation codes bind to tenant/environment/subject/id and remain stable without stored plaintext", () => {
  const code = invitationEmailCode(enabled, {
    id: job.invitation_id, organisationId, environment: "staging", subject: job.subject,
  });
  assert.match(code, /^[A-Za-z0-9_-]{43}$/);
  assert.equal(code, invitationEmailCode(enabled, {
    id: job.invitation_id, organisationId, environment: "staging", subject: job.subject,
  }));
  for (const change of [
    { id: "00000000-0000-4000-8000-000000000099" },
    { subject: "different-subject" },
    { environment: "production" },
    { organisationId: "00000000-0000-4000-8000-000000000003" },
  ]) assert.notEqual(code, invitationEmailCode(enabled, {
    id: job.invitation_id, organisationId, environment: "staging", subject: job.subject, ...change,
  }));
});

test("enqueued invitation is atomic, identity bound, and does not return or persist plaintext code", async () => {
  const calls = [];
  const pool = {
    async connect() {
      return {
        release() {},
        async query(sql, params) {
          calls.push({ sql, params });
          if (sql.includes("SELECT 1 FROM twe.staff_users WHERE organisation_id"))
            return { rows: [], rowCount: 0 };
          return { rows: [], rowCount: 1 };
        },
      };
    },
  };
  const service = new Invitations(pool, organisationId,
    { issuer: "https://synthetic.example.invalid", audience: "aud" }, "staging", "", enabled);
  service.checkOwner = async () => ({ role: "owner" });
  const actor = { id: "00000000-0000-4000-8000-000000000005", organisationId, role: "owner" };
  const response = await service.issue({
    actor, subject: "cf:verified-identity", role: "editor", sendEmail: true,
    recipientEmail: "invited@example.invalid", approvalReference: "APPROVAL-2026-11",
    requestId: "request-1",
  });
  assert.equal(response.code, undefined);
  assert.equal(response.delivery, "queued");
  const persistedCode = invitationEmailCode(enabled, {
    id: response.id, organisationId, environment: "staging", subject: "cf:verified-identity",
  });
  const hashed = createHash("sha256").update(persistedCode).digest("hex");
  const invitationInsert = calls.find(({ sql }) => sql.includes("INSERT INTO twe.staff_invitations"));
  assert.ok(invitationInsert);
  assert.ok(invitationInsert.params.includes(hashed));
  assert.ok(!JSON.stringify(calls).includes(persistedCode),
    "No plaintext invitation code should be stored in any SQL parameter or audit");
  const emailInsert = calls.find(({ sql }) => sql.includes("INSERT INTO twe.staff_invitation_deliveries"));
  assert.ok(emailInsert);
  assert.deepEqual(emailInsert.params, [response.id, organisationId, "staging", "invited@example.invalid"]);
  assert.equal(calls.filter(({ sql }) => sql === "COMMIT").length, 1);
  assert.equal(calls.filter(({ sql }) => sql === "BEGIN").length, 1);

  const manual = await service.issue({
    actor, subject: "cf:other-verified-identity", role: "editor", sendEmail: false,
    approvalReference: "APPROVAL-2026-12", requestId: "request-2",
  });
  assert.match(manual.code, /^[A-Za-z0-9_-]{43}$/);
  assert.equal(manual.delivery, undefined);
  assert.equal(calls.filter(({ sql }) => sql.includes("INSERT INTO twe.staff_invitation_deliveries")).length, 1);
  const notConfigured = new Invitations(pool, organisationId, {}, "staging");
  await assert.rejects(
    notConfigured.issue({ actor, subject: "x", sendEmail: true, recipientEmail: "x@example.invalid" }),
    { status: 503 },
  );
  await assert.rejects(
    service.issue({ subject: "x", identity: {}, sendEmail: true, recipientEmail: "x@example.invalid" }),
    { status: 503 },
  );
});

test("branded emails contain the expiring code, while template previews and manual codes do not", () => {
  const code = invitationEmailCode(enabled, {
    id: job.invitation_id, organisationId, environment: job.environment, subject: job.subject,
  });
  const email = invitationTemplate({
    copy: defaultInvitationCopy, code, role: "editor",
    expiresAt: job.expires_at, portalOrigin: "https://portal-staging.example.invalid",
  });
  assert.match(email.html, /Your one-time activation code/);
  assert.match(email.text, new RegExp(code));
  assert.match(email.text, /This email alone does not grant workspace access/);
  assert.match(email.html, /portal-staging.example.invalid/);
  const preview = invitationTemplate();
  assert.doesNotMatch(preview.text + preview.html, new RegExp(code));
  assert.match(preview.text, /activation code separately/);
  assert.throws(() => invitationTemplate({ code: "bad-code", role: "owner", expiresAt: job.expires_at }));
});

test("Resend invitation deliveries redirect only to the testing mailbox outside production", async () => {
  const calls = [];
  const fetcher = async (url, options) => {
    calls.push({ url, options });
    return { ok: true, json: async () => ({ id: "synthetic-provider-id" }) };
  };
  const stage = new InvitationEmailSender({
    environment: "staging", from: "Travel With Ease <sender@example.invalid>", apiKey: "synthetic",
  }, enabled, "https://portal-staging.example.invalid", fetcher);
  const payload = stage.payload(job);
  assert.deepEqual(payload.to, ["testing@travelwitheasegh.com"]);
  assert.equal(payload.cc, undefined);
  assert.doesNotMatch(JSON.stringify(payload.to), /invited@example.invalid/);
  await stage.send(job);
  await stage.send(job);
  assert.equal(calls[0].options.headers["Idempotency-Key"],
    calls[1].options.headers["Idempotency-Key"]);
  assert.equal(calls[0].options.body, calls[1].options.body);
  assert.equal(calls[0].url, "https://api.resend.com/emails");

  const prod = new InvitationEmailSender({
    environment: "production", from: "Travel With Ease <sender@example.invalid>", apiKey: "synthetic",
  }, enabled, "https://portal.example.invalid", fetcher);
  const production = prod.payload({ ...job, environment: "production" });
  assert.deepEqual(production.to, ["invited@example.invalid"]);
  assert.equal(production.cc, undefined);
  await assert.rejects(stage.send({ ...job, recipient_email: "invalid" }), { message: "delivery_configuration_changed" });
});

test("revoked/expired invitation is cancelled before delivery and sender failures are safely redacted", async () => {
  const events = [];
  const outbox = {
    claim: async () => job,
    isStillValid: async () => false,
    cancel: async () => events.push("cancel"),
    fail: async (_job, reason) => events.push(reason),
    finish: async () => events.push("finish"),
  };
  const sender = {
    send: async () => {
      throw new Error("must not deliver");
    },
  };
  assert.equal(await deliverOneInvitation(outbox, sender, defaultInvitationCopy), true);
  assert.deepEqual(events, ["cancel"]);
  outbox.isStillValid = async () => true;
  sender.send = async () => { throw new Error("raw secret response or token"); };
  const logger = { warn: (...args) => events.push(args) };
  assert.equal(await deliverOneInvitation(outbox, sender, defaultInvitationCopy, logger), true);
  assert.equal(events[1], "delivery_failed");
  assert.doesNotMatch(JSON.stringify(events), /raw secret response or token/);
});
