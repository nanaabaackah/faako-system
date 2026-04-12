import assert from "node:assert/strict";
import test from "node:test";
import {
  buildSafeAppRedirectUrl,
  normalizeSafeRelativeRedirectPath,
} from "./redirects.js";

test("normalizeSafeRelativeRedirectPath accepts same-site paths", () => {
  assert.equal(
    normalizeSafeRelativeRedirectPath("/bookings?calendar=google#settings"),
    "/bookings?calendar=google#settings"
  );
});

test("normalizeSafeRelativeRedirectPath rejects external redirect forms", () => {
  assert.equal(normalizeSafeRelativeRedirectPath("https://evil.example/path"), "");
  assert.equal(normalizeSafeRelativeRedirectPath("//evil.example/path"), "");
  assert.equal(normalizeSafeRelativeRedirectPath("/\\evil.example/path"), "");
});

test("buildSafeAppRedirectUrl preserves the configured app origin", () => {
  assert.equal(
    buildSafeAppRedirectUrl({
      appBaseUrl: "https://dev.example.com/app",
      returnTo: "/bookings?calendar=google",
      searchParams: { google: "connected" },
    }),
    "https://dev.example.com/bookings?calendar=google&google=connected"
  );
});

test("buildSafeAppRedirectUrl returns null for unsafe redirects", () => {
  assert.equal(
    buildSafeAppRedirectUrl({
      appBaseUrl: "https://dev.example.com",
      returnTo: "//evil.example/path",
      searchParams: { google: "connected" },
    }),
    null
  );
});
