import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const headerSource = readFileSync(
  new URL("../../public/_headers", import.meta.url),
  "utf8"
);

test("portal HTML is not reused across Cloudflare deployments", () => {
  for (const route of ["/", "/index.html", "/login", "/reset-password", "/admin*"]) {
    assert.match(
      headerSource,
      new RegExp(`${route.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\n\\s+Cache-Control: private, no-store, max-age=0`)
    );
  }
});

test("fingerprinted Vite assets remain immutable", () => {
  assert.match(
    headerSource,
    /\/assets\/\*\n\s+Cache-Control: public, max-age=31536000, immutable/
  );
});
