import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(
  new URL("../src/components/ERPModal.tsx", import.meta.url),
  "utf8",
);

test("destructive confirmation requires explicit button activation", () => {
  assert.doesNotMatch(source, /event\.key\s*!==?\s*["']Enter["']/);
  assert.match(source, /role="alertdialog"/);
  assert.match(source, /data-dialog-initial-focus/);
  assert.match(source, /<ConfirmAction onClick=\{onConfirm\}/);
});

test("dialog foundation contains focus, locks scroll, and restores focus", () => {
  assert.match(source, /event\.key\s*!==?\s*["']Tab["']/);
  assert.match(source, /document\.body\.style\.overflow = "hidden"/);
  assert.match(source, /previouslyFocused\?\.isConnected/);
});
