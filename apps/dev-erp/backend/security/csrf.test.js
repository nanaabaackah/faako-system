import assert from "node:assert/strict";
import test from "node:test";
import { createCsrfMiddleware } from "./csrf.js";

const createResponse = () => ({
  statusCode: 200,
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

const getCookieValue = (req, name) => req.cookies?.[name] || null;
const timingSafeEqual = (left, right) => left === right;

test("csrf middleware skips safe methods", () => {
  const middleware = createCsrfMiddleware({
    getCookieValue,
    authCookieName: "auth",
    csrfCookieName: "csrf",
    timingSafeEqual,
  });
  let nextCalled = false;
  middleware({ method: "GET", path: "/accounting/entries", cookies: {}, header: () => "" }, createResponse(), () => {
    nextCalled = true;
  });
  assert.equal(nextCalled, true);
});

test("csrf middleware skips excluded auth paths", () => {
  const middleware = createCsrfMiddleware({
    getCookieValue,
    authCookieName: "auth",
    csrfCookieName: "csrf",
    timingSafeEqual,
  });
  let nextCalled = false;
  middleware(
    { method: "POST", path: "/auth/login", cookies: { auth: "cookie" }, header: () => "" },
    createResponse(),
    () => {
      nextCalled = true;
    }
  );
  assert.equal(nextCalled, true);
});

test("csrf middleware allows refresh recovery without a browser-readable csrf token", () => {
  const middleware = createCsrfMiddleware({
    getCookieValue,
    authCookieName: "auth",
    csrfCookieName: "csrf",
    timingSafeEqual,
  });
  let nextCalled = false;
  middleware(
    { method: "POST", path: "/auth/refresh", cookies: { auth: "expired-cookie" }, header: () => "" },
    createResponse(),
    () => {
      nextCalled = true;
    }
  );
  assert.equal(nextCalled, true);
});

test("csrf middleware blocks unsafe cookie-authenticated requests without matching token", () => {
  const middleware = createCsrfMiddleware({
    getCookieValue,
    authCookieName: "auth",
    csrfCookieName: "csrf",
    timingSafeEqual,
  });
  const response = createResponse();
  let nextCalled = false;

  middleware(
    {
      method: "POST",
      path: "/accounting/entries",
      cookies: { auth: "session-token", csrf: "csrf-cookie" },
      header: () => "",
    },
    response,
    () => {
      nextCalled = true;
    }
  );

  assert.equal(nextCalled, false);
  assert.equal(response.statusCode, 403);
  assert.deepEqual(response.body, { error: "Invalid CSRF token" });
});

test("csrf middleware allows unsafe cookie-authenticated requests with matching token", () => {
  const middleware = createCsrfMiddleware({
    getCookieValue,
    authCookieName: "auth",
    csrfCookieName: "csrf",
    timingSafeEqual,
  });
  let nextCalled = false;

  middleware(
    {
      method: "POST",
      path: "/accounting/entries",
      cookies: { auth: "session-token", csrf: "csrf-token" },
      header(name) {
        return name === "x-csrf-token" ? "csrf-token" : "";
      },
    },
    createResponse(),
    () => {
      nextCalled = true;
    }
  );

  assert.equal(nextCalled, true);
});
