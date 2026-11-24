import test from "node:test";
import assert from "node:assert/strict";
import { readHostedPublicBuildSettings, publicBuildEnvironment } from "../src/content/build.js";

const base = {
  APP_ENV: "staging",
  TWE_PUBLIC_API_ORIGIN: "https://api-staging.example.com",
  TWE_PUBLIC_TURNSTILE_SITE_KEY: "0x4AAAAAAExamplePublicKey",
  TWE_PUBLIC_SITE_INDEXABLE: "true",
  TWE_PUBLIC_GOOGLE_SITE_VERIFICATION: "test-public-verification",
  TWE_TURNSTILE_SECRET_KEY: "not-for-browser",
};
test("hosted public build validates required enquiry settings and never exposes server secrets", () => {
  const settings = readHostedPublicBuildSettings(base);
  assert.equal(settings.apiOrigin, base.TWE_PUBLIC_API_ORIGIN);
  assert.equal(settings.turnstileSiteKey, base.TWE_PUBLIC_TURNSTILE_SITE_KEY);
  assert.equal(settings.indexable, false);
  assert.equal(readHostedPublicBuildSettings({ ...base, APP_ENV: "production" }).indexable, true);
  const env = publicBuildEnvironment({ ...settings, environment: "staging" });
  assert.equal(env.PUBLIC_TURNSTILE_SITE_KEY, base.TWE_PUBLIC_TURNSTILE_SITE_KEY);
  assert.equal(env.PUBLIC_SITE_INDEXABLE, "false");
  assert.equal(env.TWE_TURNSTILE_SECRET_KEY, undefined);
});
test("hosted public build refuses missing or unsafe public configuration", () => {
  for (const origin of ["", "http://api.example.com", "https://api.example.com/path", "https://user:pass@api.example.com"]) {
    assert.throws(() => readHostedPublicBuildSettings({ ...base, TWE_PUBLIC_API_ORIGIN: origin }), /TWE_PUBLIC_API_ORIGIN/);
  }
  for (const siteKey of ["", "1x00000000000000000000AA", "not a valid key"]) {
    assert.throws(() => readHostedPublicBuildSettings({ ...base, TWE_PUBLIC_TURNSTILE_SITE_KEY: siteKey }), /TWE_PUBLIC_TURNSTILE_SITE_KEY/);
  }
  assert.throws(() => readHostedPublicBuildSettings({ ...base, APP_ENV: "test" }), /environment/);
});
