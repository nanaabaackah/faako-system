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

test("the Vite HTML plugin stays disabled in development unless explicitly enabled", () => {
  const disabled = createGoogleAnalyticsHtmlPlugin({
    measurementId: "G-APP123456",
    mode: "development",
  });
  assert.equal(disabled.transformIndexHtml(), undefined);

  const enabled = createGoogleAnalyticsHtmlPlugin({
    measurementId: "G-APP123456",
    mode: "development",
    enableInDevelopment: "true",
  });
  enabled.configResolved({ base: "/" });
  assert.equal(enabled.transformIndexHtml().length, 1);
});

test("the development middleware serves the generated denied-consent bootstrap", () => {
  const plugin = createGoogleAnalyticsHtmlPlugin({
    measurementId: "G-APP123456",
    mode: "development",
    enableInDevelopment: true,
  });
  plugin.configResolved({ base: "/" });

  let middleware;
  plugin.configureServer({ middlewares: { use(handler) { middleware = handler; } } });
  const headers = {};
  let body = "";
  const response = {
    setHeader(name, value) { headers[name] = value; },
    end(value) { body = value; },
  };
  middleware(
    { url: "/assets/faako-google-analytics-G-APP123456-bootstrap.js" },
    response,
    () => assert.fail("bootstrap request should not fall through"),
  );

  assert.equal(response.statusCode, 200);
  assert.equal(headers["Content-Type"], "application/javascript; charset=utf-8");
  assert.match(body, /analytics_storage: "denied"/);
  assert.doesNotMatch(body, /googletagmanager/);
});
