import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import {
  EmailTemplates,
  emailTemplateRoutes,
  templateCopySchema,
} from "../src/notifications/templates.js";
import {
  defaultEnquiryCopy,
  enquiryTemplate,
  defaultInvitationCopy,
  invitationTemplate,
} from "../src/notifications/enquiry-template.js";
import { hasPermission } from "../src/auth/permissions.js";
import { ResendSender } from "../src/notifications/resend.js";
import { renderEmailTemplate } from "../src/notifications/template-catalogue.js";

test("staff invitation uses branded, escaped copy and a fixed workspace link without issuing access", () => {
  const invitation = invitationTemplate({
    copy: { ...defaultInvitationCopy, heading: "<script>unsafe</script>" },
  });
  assert.match(invitation.html, /&lt;script&gt;unsafe/);
  assert.match(
    invitation.html,
    /href="https:\/\/portal.travelwitheasegh.com\/"/,
  );
  assert.match(invitation.text, /does not grant workspace access/);
  assert.match(invitation.text, /activation code separately/);
  assert.doesNotMatch(
    invitation.html,
    /<script>|business registration|BN\d{6,}|TWE\s+Concierge|House no\s+\d/i,
  );
  assert.throws(() => renderEmailTemplate("unknown", defaultInvitationCopy));
});

test("template type is allowlisted before any database query and defaults remain compatible", async () => {
  const calls = [];
  const service = new EmailTemplates(
    {
      async query(sql, values) {
        calls.push({ sql, values });
        return { rows: [] };
      },
    },
    "tenant-a",
  );
  const actor = { id: "staff", role: "owner", organisationId: "tenant-a" };
  assert.deepEqual((await service.get(actor)).draft, defaultEnquiryCopy);
  assert.deepEqual(
    (await service.get(actor, "staff-invitation")).draft,
    defaultInvitationCopy,
  );
  assert.deepEqual(
    await service.activeCopy("staff-invitation"),
    defaultInvitationCopy,
  );
  assert.deepEqual(
    calls.map((call) => call.values),
    [
      ["tenant-a", "enquiry-acknowledgement"],
      ["tenant-a", "staff-invitation"],
      ["tenant-a", "staff-invitation"],
    ],
  );
  await assert.rejects(service.get(actor, "other-tenant-template"));
  await assert.rejects(
    service.change(actor, "test", 0, defaultEnquiryCopy, false, "unknown"),
  );
  assert.equal(calls.length, 3);
});

test("template copy is bounded and escaped; delivery and mandatory footer are code-owned", () => {
  for (const copy of [
    {
      ...defaultEnquiryCopy,
      subject: "Injected\r\nBcc: other@example.invalid",
    },
    { ...defaultEnquiryCopy, to: "attacker@example.invalid" },
    { ...defaultEnquiryCopy, message: "x".repeat(3001) },
  ])
    assert.equal(templateCopySchema.safeParse(copy).success, false);
  const copy = {
    ...defaultEnquiryCopy,
    heading: "<script>alert(1)</script>",
    message: "<img src=x onerror=alert(1)>",
  };
  const rendered = enquiryTemplate({ copy });
  assert.match(rendered.html, /&lt;script&gt;/);
  assert.doesNotMatch(rendered.html, /<script>|<img src=x/);
  assert.match(rendered.html, /not a booking or payment confirmation/);
  const staging = new ResendSender(
    { environment: "staging", from: "test@example.invalid" },
    null,
    copy,
  ).payload({ email: "real@example.invalid" });
  assert.deepEqual(staging.to, ["testing@travelwitheasegh.com"]);
  assert.equal(staging.cc, undefined);
  assert.match(staging.html, /&lt;script&gt;/);
});

test("template service refuses editors, platform administrators and cross-tenant owners before querying", async () => {
  const service = new EmailTemplates(
    {
      query() {
        throw new Error("must not query");
      },
    },
    "tenant-a",
  );
  for (const actor of [
    { id: "staff", role: "editor", organisationId: "tenant-a" },
    { id: "staff", role: "platform_admin", organisationId: "tenant-a" },
    { id: "staff", role: "owner", organisationId: "tenant-b" },
  ]) {
    await assert.rejects(service.get(actor), { status: 403 });
    await assert.rejects(service.change(actor, "test", 0, defaultEnquiryCopy), {
      status: 403,
    });
  }
});

test("template HTTP preview requires owner permission, CSRF and strict input; never sends email", async (context) => {
  let role = "owner",
    saves = 0;
  const actor = () => ({ id: "staff", role, organisationId: "tenant-a" });
  const service = new EmailTemplates({}, "tenant-a");
  service.get = async () => ({ version: 0, draft: defaultEnquiryCopy });
  service.change = async () => {
    saves++;
    return { version: 1 };
  };
  const auth = {
    requirePermission: (permission) => (req, res, next) => {
      req.staff = actor();
      return hasPermission(req.staff, permission, "tenant-a")
        ? next()
        : res.sendStatus(403);
    },
    requireMutation: (req, res, next) =>
      req.get("X-CSRF-Token") === "synthetic" ? next() : res.sendStatus(403),
  };
  const app = express();
  app.use(express.json());
  app.use(emailTemplateRoutes(service, auth));
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  context.after(() => new Promise((resolve) => server.close(resolve)));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const post = (path, body, csrf = true) =>
    fetch(origin + path, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(csrf ? { "X-CSRF-Token": "synthetic" } : {}),
      },
      body: JSON.stringify(body),
    });
  assert.equal((await post("/preview", defaultEnquiryCopy, false)).status, 403);
  assert.equal(
    (await post("/preview", { ...defaultEnquiryCopy, html: "unsafe" })).status,
    400,
  );
  const preview = await post("/preview", defaultEnquiryCopy);
  assert.equal(preview.status, 200);
  assert.equal((await preview.json()).data.preview, true);
  assert.equal(saves, 0);
  const invitation = await post(
    "/staff-invitation/preview",
    defaultInvitationCopy,
  );
  assert.equal(invitation.status, 200);
  assert.match(
    (await invitation.json()).data.html,
    /This email does not grant workspace access/,
  );
  assert.equal(
    (await post("/staff-invitation/preview", defaultInvitationCopy, false))
      .status,
    403,
  );
  assert.equal(
    (await post("/unknown/preview", defaultInvitationCopy)).status,
    400,
  );
  assert.equal(saves, 0);
  for (const denied of ["editor", "platform_admin"]) {
    role = denied;
    assert.equal((await fetch(origin)).status, 403);
    assert.equal((await fetch(origin + "/staff-invitation")).status, 403);
    assert.equal(
      (await post("/staff-invitation/preview", defaultInvitationCopy)).status,
      403,
    );
    assert.equal(
      (await post("/draft", { expectedVersion: 0, copy: defaultEnquiryCopy }))
        .status,
      403,
    );
  }
});
