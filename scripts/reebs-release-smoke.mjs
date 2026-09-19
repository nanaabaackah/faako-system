#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const normalizeBaseUrl = (value, fallback) => String(value || fallback).replace(/\/+$/, "");
const apiBase = normalizeBaseUrl(process.env.REEBS_API_BASE_URL, "http://127.0.0.1:8888");
const portalBase = normalizeBaseUrl(process.env.REEBS_PORTAL_BASE_URL, "http://127.0.0.1:5174");
const websiteBase = normalizeBaseUrl(process.env.REEBS_WEBSITE_BASE_URL, "http://127.0.0.1:5173");
const timeoutMs = Math.max(1_000, Number(process.env.REEBS_SMOKE_TIMEOUT_MS) || 10_000);

const catalogue = JSON.parse(readFileSync(
  resolve("apps/reebs-website/src/content/public-catalogue.json"),
  "utf8"
));
const rentalPath = catalogue.rentals?.[0]?.path;
const shopPath = catalogue.shop?.[0]?.path;

const checks = [
  { area: "API", url: `${apiBase}/live`, text: '"status":"alive"' },
  { area: "API readiness", url: `${apiBase}/ready`, text: '"status":"ready"' },
  { area: "Water readiness", url: `${apiBase}/health/water`, text: '"water":"ready"' },
  {
    area: "Water payment webhook authentication",
    url: `${apiBase}/api/water-momo-webhook`,
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Water-Webhook-Secret": "release-smoke-invalid-secret" },
    body: JSON.stringify({ paymentReference: "RELEASE-SMOKE-NO-MUTATION" }),
    acceptedStatuses: [401],
    text: "Invalid webhook secret",
  },
  { area: "Portal login", url: `${portalBase}/login` },
  { area: "Portal dashboard route", url: `${portalBase}/admin` },
  { area: "Portal Water route", url: `${portalBase}/admin/water` },
  { area: "Storefront home", url: `${websiteBase}/` },
  { area: "Storefront catalogue", url: `${websiteBase}/shop` },
  { area: "Storefront rentals", url: `${websiteBase}/rentals` },
  ...(shopPath ? [{ area: "Storefront product", url: `${websiteBase}${shopPath}` }] : []),
  ...(rentalPath ? [{ area: "Storefront rental", url: `${websiteBase}${rentalPath}` }] : []),
  { area: "Storefront cart", url: `${websiteBase}/cart` },
  { area: "Checkout/payment start", url: `${websiteBase}/checkout` },
  { area: "Customer login", url: `${websiteBase}/customer-login` },
];

let failed = 0;
for (const check of checks) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(check.url, {
      method: check.method || "GET",
      signal: controller.signal,
      headers: { "User-Agent": "REEBS-release-smoke/1.0", ...check.headers },
      body: check.body,
      redirect: "follow",
    });
    const body = await response.text();
    const statusPassed = check.acceptedStatuses
      ? check.acceptedStatuses.includes(response.status)
      : response.ok;
    const passed = statusPassed && (!check.text || body.includes(check.text));
    console.log(`${passed ? "PASS" : "FAIL"} ${check.area}: HTTP ${response.status}`);
    if (!passed) failed += 1;
  } catch (error) {
    console.log(`FAIL ${check.area}: ${error.name === "AbortError" ? "timeout" : "request failed"}`);
    failed += 1;
  } finally {
    clearTimeout(timeout);
  }
}

if (failed) {
  console.error(`REEBS release smoke failed: ${failed} of ${checks.length} checks failed.`);
  process.exit(1);
}
console.log(`REEBS release smoke passed: ${checks.length} read-only checks.`);
