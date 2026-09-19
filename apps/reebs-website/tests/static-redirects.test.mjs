import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_PORTAL_ORIGIN,
  PORTAL_ORIGIN_MARKER,
  finalizePortalRedirects,
  resolvePortalOrigin,
} from "../scripts/staticRedirects.mjs";

const TEMPLATE = `/admin ${PORTAL_ORIGIN_MARKER}/ 302\n/login ${PORTAL_ORIGIN_MARKER}/ 302`;

test("storefront redirects use the configured staging portal origin", () => {
  const output = finalizePortalRedirects(
    TEMPLATE,
    "https://portal-stage.reebspartythemes.com/admin?ignored=true",
  );

  assert.match(output, /\/admin https:\/\/portal-stage\.reebspartythemes\.com\/ 302/);
  assert.match(output, /\/login https:\/\/portal-stage\.reebspartythemes\.com\/ 302/);
  assert.doesNotMatch(output, new RegExp(PORTAL_ORIGIN_MARKER));
});

test("storefront redirects retain the production portal fallback", () => {
  assert.equal(resolvePortalOrigin(""), DEFAULT_PORTAL_ORIGIN);
  assert.equal(resolvePortalOrigin("not-a-url"), DEFAULT_PORTAL_ORIGIN);
  assert.equal(resolvePortalOrigin("javascript:alert(1)"), DEFAULT_PORTAL_ORIGIN);
});
