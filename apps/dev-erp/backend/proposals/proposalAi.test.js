import assert from "node:assert/strict";
import test from "node:test";

import { createProposalAiHandler } from "./proposalAi.js";

const response = () => ({
  statusCode: 200, body: null,
  status(code) { this.statusCode = code; return this; },
  json(body) { this.body = body; return this; },
});

const prismaMock = (initial = []) => {
  const logs = [...initial];
  const auditLog = {
    findUnique: async ({ where }) => logs.find((entry) => entry.externalRef === where.externalRef) || null,
    count: async ({ where }) => logs.filter((entry) => entry.organizationId === where.organizationId && entry.userId === where.userId && entry.action === where.action).length,
    create: async ({ data }) => { logs.push({ ...data, createdAt: new Date() }); return data; },
    update: async ({ where, data }) => { const entry = logs.find((row) => row.externalRef === where.externalRef); Object.assign(entry, data); return entry; },
  };
  return { logs, auditLog, $transaction: async (callback) => callback({ auditLog }) };
};

const request = (body, user = {}) => ({ body, requestId: "req-1", user: { userId: 7, organizationId: 2, ...user } });

test("proposal AI returns validated summary content and reports the daily allowance", async () => {
  const prisma = prismaMock();
  const handler = createProposalAiHandler({
    prisma, apiKey: "test", model: "test-model",
    fetchImpl: async (_url, options) => {
      const body = JSON.parse(options.body);
      assert.equal(body.max_output_tokens, 220);
      assert.doesNotMatch(body.input[1].content, /unitPrice/);
      return { ok: true, json: async () => ({ output_text: JSON.stringify({ summary: "A refined, factual project summary." }) }) };
    },
  });
  const res = response();
  await handler(request({ task: "REFINE_SUMMARY", requestKey: "one", sourceFingerprint: "abc", context: { summary: "Build a useful client website." } }), res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.usage.remaining, 9);
  assert.equal(prisma.logs[0].status, "SUCCESS");
});

test("proposal AI duplicate request keys are idempotently rejected without another claim", async () => {
  const prisma = prismaMock();
  let calls = 0;
  const handler = createProposalAiHandler({ prisma, apiKey: "test", fetchImpl: async () => { calls += 1; return { ok: true, json: async () => ({ output_text: '{"summary":"Refined summary"}' }) }; } });
  const body = { task: "REFINE_SUMMARY", requestKey: "same", sourceFingerprint: "abc", context: { summary: "Build a useful client website." } };
  await handler(request(body), response());
  const duplicate = response();
  await handler(request(body), duplicate);
  assert.equal(duplicate.statusCode, 409);
  assert.equal(prisma.logs.length, 1);
  assert.equal(calls, 1);
});

test("proposal AI enforces ten claims per user and tenant per UTC day", async () => {
  const prisma = prismaMock(Array.from({ length: 10 }, (_, index) => ({ id: index, organizationId: 2, userId: 7, action: "PROPOSAL_AI_REQUEST", externalRef: `existing-${index}`, createdAt: new Date() })));
  const handler = createProposalAiHandler({ prisma, apiKey: "test", fetchImpl: async () => { throw new Error("should not call provider"); } });
  const res = response();
  await handler(request({ task: "GENERATE_SCOPE_DELIVERY", requestKey: "eleventh", sourceFingerprint: "abc", context: {} }), res);
  assert.equal(res.statusCode, 429);
  assert.equal(res.body.usage.remaining, 0);
});

test("proposal AI quota claims remain isolated across users and tenants", async () => {
  const currentClaims = Array.from({ length: 9 }, (_, index) => ({ organizationId: 2, userId: 7, action: "PROPOSAL_AI_REQUEST", externalRef: `current-${index}`, createdAt: new Date() }));
  const prisma = prismaMock([
    ...currentClaims,
    { organizationId: 2, userId: 8, action: "PROPOSAL_AI_REQUEST", externalRef: "other-user", createdAt: new Date() },
    { organizationId: 3, userId: 7, action: "PROPOSAL_AI_REQUEST", externalRef: "other-tenant", createdAt: new Date() },
  ]);
  const handler = createProposalAiHandler({ prisma, apiKey: "test", fetchImpl: async () => ({ ok: true, json: async () => ({ output_text: '{"summary":"Refined summary"}' }) }) });
  const res = response();
  await handler(request({ task: "REFINE_SUMMARY", requestKey: "tenth", sourceFingerprint: "abc", context: { summary: "Build a useful client website." } }), res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.usage.dailyLimit, 10);
  assert.equal(res.body.usage.used, 10);
  assert.equal(res.body.usage.remaining, 0);
});

test("proposal AI provider failures retain the consumed quota claim", async () => {
  const prisma = prismaMock();
  const handler = createProposalAiHandler({ prisma, apiKey: "test", fetchImpl: async () => ({ ok: false, status: 503 }) });
  const res = response();
  await handler(request({ task: "REFINE_SUMMARY", requestKey: "provider-failure", sourceFingerprint: "abc", context: { summary: "Build a useful client website." } }), res);
  assert.equal(res.statusCode, 502);
  assert.equal(res.body.usage.used, 1);
  assert.equal(prisma.logs[0].status, "FAILED");
});

test("proposal AI rejects malformed scope output without releasing its claim", async () => {
  const prisma = prismaMock();
  const handler = createProposalAiHandler({ prisma, apiKey: "test", fetchImpl: async () => ({ ok: true, json: async () => ({ output_text: JSON.stringify({ scope: "Scope", deliverables: [{ itemKey: "invented", details: ["Unknown"] }], estimatedDelivery: "After discovery", exclusions: [], deliveryTerms: [] }) }) }) });
  const res = response();
  await handler(request({ task: "GENERATE_SCOPE_DELIVERY", requestKey: "malformed", sourceFingerprint: "abc", context: { items: [{ key: "website", name: "Website" }] } }), res);
  assert.equal(res.statusCode, 502);
  assert.equal(res.body.usage.remaining, 9);
  assert.equal(prisma.logs[0].status, "FAILED");
});
