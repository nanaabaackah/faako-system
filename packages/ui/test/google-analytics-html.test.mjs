import assert from "node:assert/strict";
import test from "node:test";
import { createGoogleAnalyticsHtmlPlugin } from "../../../scripts/vite/googleAnalyticsHtml.mjs";

test("the Vite HTML plugin defaults consent without loading the Google tag", () => {
  const plugin = createGoogleAnalyticsHtmlPlugin({
    measurementId: "G-APP123456",
    mode: "production",
  });
  plugin.configResolved({ base: "/" });

  const tags = plugin.transformIndexHtml();
  assert.equal(tags.length, 1);
  assert.match(tags[0].attrs.src, /faako-google-analytics-G-APP123456-bootstrap\.js$/);
  assert.doesNotMatch(tags[0].attrs.src, /googletagmanager/);

  let emitted;
  plugin.generateBundle.call({ emitFile(asset) { emitted = asset; } });
  assert.equal(emitted.type, "asset");
  assert.match(emitted.source, /analytics_storage: "denied"/);
  assert.match(emitted.source, /window\["ga-disable-" \+ measurementId\] = true/);
  assert.doesNotMatch(emitted.source, /window\.gtag\("config"/);
  assert.doesNotMatch(emitted.source, /window\.gtag\("js"/);
});

test("the Vite HTML plugin stays disabled when no app-specific ID exists", () => {
  const plugin = createGoogleAnalyticsHtmlPlugin({ mode: "production" });
  assert.equal(plugin.transformIndexHtml(), undefined);
  let emitted = false;
  plugin.generateBundle.call({ emitFile() { emitted = true; } });
  assert.equal(emitted, false);
});
