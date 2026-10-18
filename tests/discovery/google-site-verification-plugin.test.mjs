import test from "node:test";
import assert from "node:assert/strict";
import { createGoogleSiteVerificationHtmlPlugin } from "../../scripts/vite/googleSiteVerificationHtml.mjs";

test("injects a Search Console verification meta tag when configured", () => {
  const plugin = createGoogleSiteVerificationHtmlPlugin({ verificationToken: "  test-token  " });
  const tags = plugin.transformIndexHtml();

  assert.deepEqual(tags, [{
    tag: "meta",
    attrs: { name: "google-site-verification", content: "test-token" },
    injectTo: "head",
  }]);
});

test("does not emit an empty verification tag", () => {
  const plugin = createGoogleSiteVerificationHtmlPlugin({ verificationToken: " " });
  assert.equal(plugin.transformIndexHtml(), undefined);
});
