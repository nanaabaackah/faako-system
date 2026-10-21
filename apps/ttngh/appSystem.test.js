import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import appSystem from "./appSystem.js";
import { validateAppSystemConfig } from "../../packages/security/src/index.js";

test("TTNGH declares a valid public, unauthenticated app without invented deployment origins", () => {
  const manifest = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8"));
  assert.equal(appSystem.appId, manifest.name);
  assert.deepEqual(validateAppSystemConfig(appSystem), { valid: true, errors: [] });
  assert.equal(appSystem.security.profileId, "public-interactive");
  assert.equal(appSystem.security.authMode, "none");
  assert.equal(appSystem.security.allowedOrigins, undefined);
});

test("TTNGH config preserves the site's existing shared theme mappings", () => {
  const css = readFileSync(new URL("./src/styles/global.css", import.meta.url), "utf8");
  const mappings = [...css.matchAll(/(--sys-[\w-]+):\s*([^;]+);/g)];
  let checked = 0;
  for (const [, name, value] of mappings) {
    if (!(name in appSystem.theme.tokenOverrides)) continue;
    assert.equal(appSystem.theme.tokenOverrides[name], value.trim(), name);
    checked += 1;
  }
  assert.ok(checked >= 12, "expected the existing theme mappings to be checked");
  const layout = readFileSync(new URL("./src/layouts/BaseLayout.astro", import.meta.url), "utf8");
  assert.ok(layout.includes(`data-faako-theme="${appSystem.theme.presetId}"`));
});

test("TTNGH calendar uses its API without a provider embed", () => {
  const calendar = readFileSync(new URL("./src/components/EventCalendar.astro", import.meta.url), "utf8");
  const envExample = readFileSync(new URL("./.env.example", import.meta.url), "utf8");
  const headers = readFileSync(new URL("./public/_headers", import.meta.url), "utf8");
  const privacy = readFileSync(new URL("./src/pages/privacy.astro", import.meta.url), "utf8");

  assert.match(calendar, /<MonthCalendar/);
  assert.doesNotMatch(calendar, /iframe|data-calendar-load|calendarUrl/);
  assert.doesNotMatch(envExample, /PUBLIC_TTNGH_GOOGLE_CALENDAR_ID=/);
  assert.doesNotMatch(headers, /frame-src[^;]*calendar.google.com/);
  assert.match(privacy, /Google receives feed requests from TTNGH/);
});
