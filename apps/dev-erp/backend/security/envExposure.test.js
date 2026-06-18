import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const envExamplePath = path.join(appRoot, ".env.example");

const BROWSER_VISIBLE_ENV_ALLOWLIST = new Set([
  "VITE_API_BASE",
  "VITE_DEFAULT_ORG_SLUG",
  "VITE_AUTH_CSRF_COOKIE_NAME",
  "VITE_CAD_TO_GHS_RATE",
  "VITE_API_PROXY_TARGET",
  "VITE_ENABLE_GA_IN_DEV",
  "VITE_GA_MEASUREMENT_ID",
]);
const SECRET_SHAPED_KEY_PATTERN =
  /(SECRET|PASSWORD|TOKEN|PRIVATE|DATABASE|OAUTH|JWT|RESEND|TWILIO|API_KEY|CLIENT_SECRET|ENCRYPTION)/i;

const readEnvExampleKeys = () =>
  fs
    .readFileSync(envExamplePath, "utf8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"))
    .map((line) => line.match(/^([A-Z0-9_]+)\s*=/)?.[1])
    .filter(Boolean);

test(".env.example keeps browser-visible VITE values separate from secrets", () => {
  const viteKeys = readEnvExampleKeys()
    .filter((key) => key.startsWith("VITE_"))
    .sort();
  const unknownViteKeys = viteKeys.filter((key) => !BROWSER_VISIBLE_ENV_ALLOWLIST.has(key));
  const secretShapedViteKeys = viteKeys.filter(
    (key) => SECRET_SHAPED_KEY_PATTERN.test(key) && !BROWSER_VISIBLE_ENV_ALLOWLIST.has(key)
  );

  assert.deepEqual(unknownViteKeys, []);
  assert.deepEqual(secretShapedViteKeys, []);
});
