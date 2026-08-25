import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_DOCUMENT_IDENTITY,
  PORTAL_SETTINGS_ENDPOINT,
  cacheDocumentIdentity,
  loadPortalSettings,
  readCachedPortalConfig,
  sanitizeDocumentIdentity,
  savePortalSettingsSection,
} from "./portalSettings.js";

test("document identity normalization trims values and falls back safely", () => {
  assert.deepEqual(
    sanitizeDocumentIdentity({
      storeName: "  REEBS Party Themes  ",
      storeEmail: "",
      storePhone: " +233 24 000 0000 ",
      storeAddress: " Tema ",
    }),
    {
      storeName: "REEBS Party Themes",
      storeEmail: DEFAULT_DOCUMENT_IDENTITY.storeEmail,
      storePhone: "+233 24 000 0000",
      storeAddress: "Tema",
    },
  );
});

test("document identity cache preserves retired legacy fields", () => {
  const values = new Map([
    ["reebs_erp_config", JSON.stringify({ currency: "GHS", taxRate: "0.15" })],
  ]);
  const originalWindow = globalThis.window;
  globalThis.window = {
    localStorage: {
      getItem: (key) => values.get(key) || null,
      setItem: (key, value) => values.set(key, value),
    },
  };

  try {
    cacheDocumentIdentity({
      storeName: "REEBS",
      storeEmail: "accounts@example.com",
      storePhone: "+233 20 000 0000",
      storeAddress: "Tema",
    });
    assert.deepEqual(readCachedPortalConfig(), {
      currency: "GHS",
      taxRate: "0.15",
      storeName: "REEBS",
      storeEmail: "accounts@example.com",
      storePhone: "+233 20 000 0000",
      storeAddress: "Tema",
    });
  } finally {
    globalThis.window = originalWindow;
  }
});

test("portal settings client uses the stable authenticated endpoint and complete PUT shape", async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  const responsePayload = {
    preferences: { theme: "dark", fontSize: "large" },
    documentIdentity: DEFAULT_DOCUMENT_IDENTITY,
    capabilities: { canManageDocumentIdentity: true },
  };
  globalThis.fetch = async (...args) => {
    calls.push(args);
    return {
      ok: true,
      status: 200,
      async json() {
        return responsePayload;
      },
    };
  };

  try {
    assert.deepEqual(await loadPortalSettings(), responsePayload);
    assert.deepEqual(
      await savePortalSettingsSection("preferences", responsePayload.preferences),
      responsePayload,
    );
    assert.equal(calls[0][0], PORTAL_SETTINGS_ENDPOINT);
    assert.equal(calls[1][0], PORTAL_SETTINGS_ENDPOINT);
    assert.equal(calls[1][1].method, "PUT");
    assert.deepEqual(JSON.parse(calls[1][1].body), {
      section: "preferences",
      value: responsePayload.preferences,
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("portal settings client surfaces backend errors", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: false,
    status: 403,
    async json() {
      return { error: "Read only", code: "FORBIDDEN" };
    },
  });

  try {
    await assert.rejects(
      () => savePortalSettingsSection("documentIdentity", DEFAULT_DOCUMENT_IDENTITY),
      (error) => error.message === "Read only" && error.status === 403 && error.code === "FORBIDDEN",
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
