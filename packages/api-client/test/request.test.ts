import assert from "node:assert/strict";
import test from "node:test";
import {
  API_ERROR_CODES,
  createCompatibleErrorResponse,
  createCompatibleSuccessResponse,
} from "@faako/api-contracts";
import {
  API_CLIENT_ERROR_CODES,
  ApiClientError,
  appendQuery,
  createApiClient,
  createCustomersApi,
} from "../src/index.ts";
import { createServerApiClient } from "../src/server.ts";

const jsonResponse = (
  payload: unknown,
  init: ResponseInit = {},
): Response =>
  new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "Content-Type": "application/json" },
    ...init,
  });

test("standardises JSON headers, explicit credentials, and raw payloads", async () => {
  let capturedUrl = "";
  let capturedInit: RequestInit | undefined;
  const client = createApiClient({
    baseUrl: "https://api.example.com/",
    credentials: "include",
    defaultHeaders: { "X-App": "faako" },
    fetch: async (input, init) => {
      capturedUrl = String(input);
      capturedInit = init;
      return jsonResponse({ legacy: true, value: 4 });
    },
  });

  const payload = await client.post<{ legacy: boolean; value: number }>(
    "/api/items",
    {
      json: { name: "Item" },
    },
  );

  assert.deepEqual(payload, { legacy: true, value: 4 });
  assert.equal(capturedUrl, "https://api.example.com/api/items");
  assert.equal(capturedInit?.method, "POST");
  assert.equal(capturedInit?.credentials, "include");
  assert.equal(capturedInit?.body, JSON.stringify({ name: "Item" }));
  const headers = new Headers(capturedInit?.headers);
  assert.equal(headers.get("accept"), "application/json");
  assert.equal(headers.get("content-type"), "application/json");
  assert.equal(headers.get("x-app"), "faako");
  assert.equal("json" in (capturedInit || {}), false);
  assert.equal("responseMode" in (capturedInit || {}), false);
});

test("supports AbortSignal and exposes a stable cancellation error", async () => {
  const controller = new AbortController();
  let calls = 0;
  const client = createApiClient({
    fetch: async (_input, init) => {
      calls += 1;
      assert.equal(init?.signal, controller.signal);
      controller.abort();
      throw new DOMException("Aborted", "AbortError");
    },
  });

  await assert.rejects(
    () => client.get("/api/items", { signal: controller.signal }),
    (error: unknown) => {
      assert.ok(error instanceof ApiClientError);
      assert.equal(error.code, API_CLIENT_ERROR_CODES.ABORTED);
      return true;
    },
  );
  assert.equal(calls, 1);
});

test("sends and returns request IDs without changing response payloads", async () => {
  const client = createApiClient({
    requestIdFactory: () => "client-request-id",
    fetch: async (_input, init) => {
      assert.equal(
        new Headers(init?.headers).get("x-request-id"),
        "client-request-id",
      );
      return jsonResponse(
        { items: [] },
        { headers: { "X-Request-Id": "server-request-id" } },
      );
    },
  });

  const result = await client.requestDetailed<{ items: unknown[] }>(
    "/api/items",
  );
  assert.deepEqual(result.data, { items: [] });
  assert.equal(result.requestId, "server-request-id");
});

test("normalises legacy and canonical HTTP errors with metadata", async () => {
  const client = createApiClient({
    fetch: async () =>
      jsonResponse(
        createCompatibleErrorResponse(
          {
            code: API_ERROR_CODES.RATE_LIMITED,
            message: "Please wait.",
          },
          { requestId: "payload-request", retryAfterSeconds: 30 },
        ),
        {
          status: 429,
          headers: {
            "Retry-After": "30",
            "X-Request-Id": "header-request",
          },
        },
      ),
  });

  await assert.rejects(
    () => client.get("/api/items"),
    (error: unknown) => {
      assert.ok(error instanceof ApiClientError);
      assert.equal(error.status, 429);
      assert.equal(error.code, API_ERROR_CODES.RATE_LIMITED);
      assert.equal(error.message, "Please wait.");
      assert.equal(error.requestId, "header-request");
      assert.equal(error.retryAfterSeconds, 30);
      return true;
    },
  );
});

test("data response mode unwraps canonical and compatible success envelopes", async () => {
  const client = createApiClient({
    fetch: async () =>
      jsonResponse(
        createCompatibleSuccessResponse(
          { challengeToken: "challenge-1" },
          { requestId: "request-1" },
        ),
      ),
  });

  const data = await client.post<{ challengeToken: string }>("/api/demo", {
    json: { action: "request" },
    responseMode: "data",
  });
  assert.deepEqual(data, { challengeToken: "challenge-1" });
});

test("invalid successful JSON responses fail consistently", async () => {
  const client = createApiClient({
    fetch: async () =>
      new Response("<!doctype html><title>Wrong route</title>", {
        status: 200,
        headers: { "Content-Type": "text/html" },
      }),
  });

  await assert.rejects(
    () => client.get("/api/items"),
    (error: unknown) => {
      assert.ok(error instanceof ApiClientError);
      assert.equal(error.code, API_CLIENT_ERROR_CODES.INVALID_RESPONSE);
      return true;
    },
  );
});

test("never automatically retries unsafe mutations", async () => {
  let calls = 0;
  const client = createApiClient({
    fetch: async () => {
      calls += 1;
      throw new TypeError("network unavailable");
    },
  });

  await assert.rejects(() =>
    client.post("/api/payments", {
      json: { amount: 100 },
    }),
  );
  assert.equal(calls, 1);
});

test("server entry adds explicit bearer configuration without leaking it to browser config", async () => {
  const client = createServerApiClient({
    baseUrl: "https://service.example.com",
    getBearerToken: async () => "service-token",
    userAgent: "faako-tests",
    fetch: async (_input, init) => {
      const headers = new Headers(init?.headers);
      assert.equal(headers.get("authorization"), "Bearer service-token");
      assert.equal(headers.get("user-agent"), "faako-tests");
      assert.equal(init?.credentials, "omit");
      return jsonResponse({ ok: true });
    },
  });

  assert.deepEqual(await client.get("/health"), { ok: true });
});

test("domain clients retain configurable routes, queries, and raw contracts", async () => {
  const paths: string[] = [];
  const client = createApiClient({
    fetch: async (input) => {
      paths.push(String(input));
      return jsonResponse({ customers: [{ id: 1 }] });
    },
  });
  const customers = createCustomersApi<
    { customers: Array<{ id: number }> }
  >(client, "/api/admin/customers");

  const result = await customers.list({ compact: true, limit: 25 });
  assert.deepEqual(result, { customers: [{ id: 1 }] });
  assert.equal(paths[0], "/api/admin/customers?compact=true&limit=25");
  assert.equal(
    appendQuery("/api/items?status=active", { tag: ["a", "b"] }),
    "/api/items?status=active&tag=a&tag=b",
  );
});
