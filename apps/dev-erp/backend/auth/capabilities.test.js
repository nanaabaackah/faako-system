import assert from "node:assert/strict";
import test from "node:test";
import { createCapabilityAccessMiddleware } from "./capabilities.js";

const createMockResponse = () => ({
  statusCode: null,
  body: null,
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(payload) {
    this.body = payload;
    return this;
  },
});

test("createCapabilityAccessMiddleware allows unrestricted roles", async () => {
  const middleware = createCapabilityAccessMiddleware({
    async resolveAuthenticatedPayload() {
      return { roleName: "Admin", modules: [] };
    },
    extractAllowedModules({ modules }) {
      return modules;
    },
    routeCapabilities: [{ pattern: /^\/api\/accounting(?:\/|$)/, modules: ["accounting"] }],
  });
  const req = { baseUrl: "/api", path: "/accounting/entries", originalUrl: "/api/accounting/entries" };
  const res = createMockResponse();
  let nextCalled = false;

  await middleware(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true);
  assert.equal(res.statusCode, null);
});

test("createCapabilityAccessMiddleware allows matching module access", async () => {
  const middleware = createCapabilityAccessMiddleware({
    async resolveAuthenticatedPayload() {
      return { roleName: "Tenant", modules: ["rent"] };
    },
    extractAllowedModules({ modules }) {
      return modules;
    },
    routeCapabilities: [{ pattern: /^\/api\/rent(?:\/|$)/, modules: ["rent"] }],
  });
  const req = { baseUrl: "/api", path: "/rent/dashboard", originalUrl: "/api/rent/dashboard" };
  const res = createMockResponse();
  let nextCalled = false;

  await middleware(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true);
  assert.equal(res.statusCode, null);
});

test("createCapabilityAccessMiddleware blocks mismatched module access", async () => {
  const middleware = createCapabilityAccessMiddleware({
    async resolveAuthenticatedPayload() {
      return { roleName: "Tenant", modules: ["rent"] };
    },
    extractAllowedModules({ modules }) {
      return modules;
    },
    routeCapabilities: [{ pattern: /^\/api\/accounting(?:\/|$)/, modules: ["accounting"] }],
  });
  const req = { baseUrl: "/api", path: "/accounting/entries", originalUrl: "/api/accounting/entries" };
  const res = createMockResponse();
  let nextCalled = false;

  await middleware(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 403);
  assert.deepEqual(res.body, {
    error: "You do not have access to this module.",
    requiredModules: ["accounting"],
  });
});

test("createCapabilityAccessMiddleware blocks non-admin roles without required modules", async () => {
  const middleware = createCapabilityAccessMiddleware({
    async resolveAuthenticatedPayload() {
      return { roleName: "Tenant", modules: [] };
    },
    extractAllowedModules({ modules }) {
      return modules;
    },
    routeCapabilities: [{ pattern: /^\/api\/accounting(?:\/|$)/, modules: ["accounting"] }],
  });
  const req = { baseUrl: "/api", path: "/accounting/entries", originalUrl: "/api/accounting/entries" };
  const res = createMockResponse();
  let nextCalled = false;

  await middleware(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 403);
  assert.deepEqual(res.body, {
    error: "You do not have access to this module.",
    requiredModules: ["accounting"],
  });
});

test("createCapabilityAccessMiddleware skips public paths", async () => {
  let resolvedAuth = false;
  const middleware = createCapabilityAccessMiddleware({
    async resolveAuthenticatedPayload() {
      resolvedAuth = true;
      return { roleName: "Tenant", modules: ["rent"] };
    },
    extractAllowedModules({ modules }) {
      return modules;
    },
    routeCapabilities: [{ pattern: /^\/api\/public(?:\/|$)/, modules: ["dashboard"] }],
    publicPathMatchers: [/^\/api\/public(?:\/|$)/],
  });
  const req = { baseUrl: "/api", path: "/public/trust-stats", originalUrl: "/api/public/trust-stats" };
  const res = createMockResponse();
  let nextCalled = false;

  await middleware(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true);
  assert.equal(res.statusCode, null);
  assert.equal(resolvedAuth, false);
});
