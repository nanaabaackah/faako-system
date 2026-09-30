import assert from "node:assert/strict";
import test from "node:test";
import { validateAppSystemConfig } from "@faako/security";
import api from "../appSystem.js";
import portal from "../../travel-with-ease-portal/appSystem.js";
import web from "../../travel-with-ease-web/appSystem.js";
import { createSecurityHeaders, REQUIRED_SECURITY_HEADERS } from "../src/security/securityHeaders.js";

test("Travel With Ease apps declare valid security profiles and local-only origins", () => {
  for (const config of [api, portal, web]) {
    assert.deepEqual(validateAppSystemConfig(config), { valid: true, errors: [] });
    for (const origin of config.security.allowedOrigins || []) {
      assert.equal(new URL(origin).hostname, "localhost");
    }
  }
  assert.equal(api.security.profileId, "api-service");
  assert.equal(portal.security.authMode, "bearer");
  assert.equal(web.security.authMode, "none");
});

test("API runtime emits the registered baseline and denies unlisted CORS origins", () => {
  for (const origin of ["http://localhost:5188", "https://unlisted.example"]) {
    const headers = {};
    let continued = false;
    createSecurityHeaders({ allowedOrigins: api.security.allowedOrigins })(
      { headers: { origin }, secure: true },
      { setHeader: (name, value) => { headers[name] = value; } },
      () => { continued = true; },
    );
    assert.equal(continued, true);
    for (const name of REQUIRED_SECURITY_HEADERS) assert.ok(headers[name], name);
    assert.equal(headers["Access-Control-Allow-Origin"], origin.startsWith("http://localhost:") ? origin : undefined);
  }
});
