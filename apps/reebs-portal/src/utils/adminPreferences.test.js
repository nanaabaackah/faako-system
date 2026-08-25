import assert from "node:assert/strict";
import test from "node:test";
import {
  applyAdminPreferences,
  clearAppliedAdminPreferences,
  resolveAdminTheme,
  sanitizeAdminPreferences,
} from "./adminPreferences.js";

test("admin preferences normalize unknown values", () => {
  assert.deepEqual(sanitizeAdminPreferences({ theme: "sepia", fontSize: "huge" }), {
    theme: "system",
    fontSize: "default",
  });
});

test("system theme follows the current device preference", () => {
  assert.equal(resolveAdminTheme("system", { matches: true }), "dark");
  assert.equal(resolveAdminTheme("system", { matches: false }), "light");
  assert.equal(resolveAdminTheme("light", { matches: true }), "light");
});

test("appearance preferences apply and clean up root attributes and font size", () => {
  const attributes = new Map();
  const styles = new Map();
  const root = {
    setAttribute: (key, value) => attributes.set(key, value),
    removeAttribute: (key) => attributes.delete(key),
    style: {
      set fontSize(value) {
        styles.set("font-size", value);
      },
      get fontSize() {
        return styles.get("font-size") || "";
      },
      removeProperty: (key) => styles.delete(key),
    },
  };

  applyAdminPreferences(
    { theme: "system", fontSize: "large" },
    { root, mediaQuery: { matches: true } },
  );
  assert.equal(attributes.get("data-admin-theme"), "dark");
  assert.equal(attributes.get("data-admin-font-size"), "large");
  assert.equal(styles.get("font-size"), "18px");

  clearAppliedAdminPreferences(root);
  assert.equal(attributes.size, 0);
  assert.equal(styles.size, 0);
});
