import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_DOCUMENT_IDENTITY,
  DEFAULT_PORTAL_PREFERENCES,
  PORTAL_DOCUMENT_IDENTITY_CONFIG_KEY,
  buildDocumentIdentityAuditEvent,
  canManageDocumentIdentity,
  getPortalPreferencesConfigKey,
  handler,
  readPortalSettings,
  sanitizeDocumentIdentity,
  sanitizePortalPreferences,
  upsertPortalSetting,
} from "./portal-settings.js";

test("portal preference sanitizer normalizes supported options and defaults corrupt storage", () => {
  assert.deepEqual(
    sanitizePortalPreferences({ theme: " DARK ", fontSize: " LARGE " }),
    { theme: "dark", fontSize: "large" }
  );
  assert.deepEqual(
    sanitizePortalPreferences({ theme: "unknown", fontSize: "huge" }),
    DEFAULT_PORTAL_PREFERENCES
  );
});

test("strict portal preference validation rejects incomplete or unsupported values", () => {
  assert.throws(
    () => sanitizePortalPreferences({ theme: "dark" }, { strict: true }),
    /Font size must be/
  );
  assert.throws(
    () => sanitizePortalPreferences({ theme: "sepia", fontSize: "default" }, { strict: true }),
    /Theme must be/
  );
  assert.throws(
    () => sanitizePortalPreferences([], { strict: true }),
    /must be an object/
  );
});

test("document identity sanitizer trims values and validates strict updates", () => {
  assert.deepEqual(
    sanitizeDocumentIdentity(
      {
        storeName: "  REEBS   Party Themes ",
        storeEmail: " INFO@REEBSPARTYTHEMES.COM ",
        storePhone: " +233 24 478 1819 ",
        storeAddress: " Sakumono Broadway,   Tema, Ghana ",
      },
      { strict: true }
    ),
    DEFAULT_DOCUMENT_IDENTITY
  );
  assert.throws(
    () => sanitizeDocumentIdentity(
      { ...DEFAULT_DOCUMENT_IDENTITY, storeEmail: "not-an-email" },
      { strict: true }
    ),
    /valid email address/
  );
  assert.throws(
    () => sanitizeDocumentIdentity(
      { ...DEFAULT_DOCUMENT_IDENTITY, storePhone: "" },
      { strict: true }
    ),
    /phone is required/
  );
  assert.deepEqual(sanitizeDocumentIdentity({}), DEFAULT_DOCUMENT_IDENTITY);
});

test("document identity capability is limited to owner and admin roles", () => {
  assert.equal(canManageDocumentIdentity({ role: "Owner" }), true);
  assert.equal(canManageDocumentIdentity({ role: "ADMIN" }), true);
  for (const role of ["manager", "staff", "warehouse", "driver", "water", ""]) {
    assert.equal(canManageDocumentIdentity({ role }), false, role);
  }
});

test("appearance storage keys are user-specific and reject invalid identities", () => {
  assert.equal(getPortalPreferencesConfigKey(42), "portal.preferences.user.42");
  assert.notEqual(getPortalPreferencesConfigKey(42), getPortalPreferencesConfigKey(43));
  assert.throws(() => getPortalPreferencesConfigKey(0), /valid user id/);
  assert.throws(() => getPortalPreferencesConfigKey("not-an-id"), /valid user id/);
});

test("settings reads are tenant-scoped and return the exact public contract", async () => {
  const calls = [];
  const client = {
    async query(sql, params) {
      calls.push({ sql, params });
      return {
        rows: [
          {
            key: "portal.preferences.user.42",
            value: JSON.stringify({ theme: "dark", fontSize: "compact" }),
          },
          {
            key: PORTAL_DOCUMENT_IDENTITY_CONFIG_KEY,
            value: JSON.stringify({
              storeName: "Tenant Seven",
              storeEmail: "docs@tenant-seven.example",
              storePhone: "+233 20 000 0000",
              storeAddress: "Tema, Ghana",
            }),
          },
        ],
      };
    },
  };

  const result = await readPortalSettings(client, {
    organizationId: 7,
    user: { id: 42, role: "admin" },
  });

  assert.deepEqual(result, {
    preferences: { theme: "dark", fontSize: "compact" },
    documentIdentity: {
      storeName: "Tenant Seven",
      storeEmail: "docs@tenant-seven.example",
      storePhone: "+233 20 000 0000",
      storeAddress: "Tema, Ghana",
    },
    capabilities: { canManageDocumentIdentity: true },
  });
  assert.match(calls[0].sql, /"organizationId" = \$1/);
  assert.match(calls[0].sql, /key = ANY\(\$2::text\[\]\)/);
  assert.deepEqual(calls[0].params, [
    7,
    ["portal.preferences.user.42", PORTAL_DOCUMENT_IDENTITY_CONFIG_KEY],
  ]);
});

test("missing or malformed stored JSON safely returns defaults", async () => {
  const result = await readPortalSettings(
    {
      async query() {
        return {
          rows: [
            { key: "portal.preferences.user.5", value: "not-json" },
            { key: PORTAL_DOCUMENT_IDENTITY_CONFIG_KEY, value: "[]" },
          ],
        };
      },
    },
    { organizationId: 2, user: { id: 5, role: "water" } }
  );

  assert.deepEqual(result, {
    preferences: DEFAULT_PORTAL_PREFERENCES,
    documentIdentity: DEFAULT_DOCUMENT_IDENTITY,
    capabilities: { canManageDocumentIdentity: false },
  });
});

test("setting upserts bind organization scope and serialize validated JSON", async () => {
  const calls = [];
  await upsertPortalSetting(
    {
      async query(sql, params) {
        calls.push({ sql, params });
        return { rows: [] };
      },
    },
    {
      organizationId: 9,
      key: "portal.preferences.user.15",
      value: { theme: "light", fontSize: "default" },
      description: "User appearance",
    }
  );

  assert.match(calls[0].sql, /ON CONFLICT \("organizationId", key\)/);
  assert.deepEqual(calls[0].params, [
    9,
    "portal.preferences.user.15",
    JSON.stringify({ theme: "light", fontSize: "default" }),
    "User appearance",
  ]);
});

test("document identity audit records changed fields without logging contact values", () => {
  const event = buildDocumentIdentityAuditEvent({
    event: {
      headers: {
        "x-request-id": "req-settings-1",
        "x-forwarded-for": "192.0.2.10, 10.0.0.2",
      },
    },
    organizationId: 7,
    authUser: { id: 42, role: "admin", fullName: "Admin User" },
    previous: DEFAULT_DOCUMENT_IDENTITY,
    next: { ...DEFAULT_DOCUMENT_IDENTITY, storePhone: "+233 50 000 0000" },
  });

  assert.equal(event.action, "PORTAL_DOCUMENT_IDENTITY_UPDATED");
  assert.equal(event.organizationId, 7);
  assert.equal(event.userId, 42);
  assert.deepEqual(event.metadata, { changedFields: ["storePhone"] });
  assert.equal(JSON.stringify(event.metadata).includes("+233"), false);
  assert.equal(event.requestId, "req-settings-1");
  assert.equal(event.ipAddress, "192.0.2.10");
});

test("handler rejects unsupported methods and cross-site requests before database access", async () => {
  const options = await handler({ httpMethod: "OPTIONS" });
  assert.equal(options.statusCode, 204);

  const unsupported = await handler({ httpMethod: "PATCH" });
  assert.equal(unsupported.statusCode, 405);
  assert.equal(JSON.parse(unsupported.body).error, "Method not allowed.");

  const crossSite = await handler({
    httpMethod: "GET",
    headers: { "sec-fetch-site": "cross-site" },
  });
  assert.equal(crossSite.statusCode, 403);
  assert.equal(JSON.parse(crossSite.body).error, "Cross-site requests are not allowed.");
});
