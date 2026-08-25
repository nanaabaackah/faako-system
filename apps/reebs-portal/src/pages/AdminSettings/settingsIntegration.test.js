import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { canAccessPortalRoute } from "../../utils/adminAccess.js";

test("Settings access exposes isolated Water pricing without opening it to standard roles", () => {
  assert.equal(canAccessPortalRoute("owner", "/admin/settings"), true);
  assert.equal(canAccessPortalRoute("admin", "/admin/settings"), true);
  assert.equal(canAccessPortalRoute("manager", "/admin/settings"), true);
  assert.equal(canAccessPortalRoute("water", "/admin/settings"), true);
  assert.equal(canAccessPortalRoute("staff", "/admin/settings"), false);
  assert.equal(canAccessPortalRoute("warehouse", "/admin/settings"), false);
  assert.equal(canAccessPortalRoute("driver", "/admin/settings"), false);
});

test("Water pricing deep link opens the real commercial-config tab", () => {
  const source = readFileSync(
    new URL("../AdminWater/components/WaterRestockCard.jsx", import.meta.url),
    "utf8",
  );
  assert.match(source, /\/admin\/settings\?tab=config/);
  assert.doesNotMatch(source, /tab=commercial/);
});

test("Settings contains no dead simple/advanced preference toggle", () => {
  const source = readFileSync(new URL("./AdminSettings.jsx", import.meta.url), "utf8");
  const workspaceSource = readFileSync(
    new URL("../AdminWorkspace/AdminWorkspace.jsx", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(source, /advancedViewMode/);
  assert.doesNotMatch(source, /This sets which dashboard control view/);
  assert.doesNotMatch(workspaceSource, /reebs_admin_view_mode_/);
  assert.doesNotMatch(workspaceSource, /setAdminViewMode/);
});
