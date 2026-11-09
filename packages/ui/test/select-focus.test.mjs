import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("deferred select focus preserves an option focused before its animation frame", () => {
  const source = readFileSync(new URL("../src/components/Fields.tsx", import.meta.url), "utf8");
  const frame = source.slice(source.indexOf("const focusFrame = window.requestAnimationFrame"), source.indexOf("const handlePointerDown", source.indexOf("const focusFrame = window.requestAnimationFrame")));
  assert.match(frame, /if \(!panelRef\.current\?\.contains\(document\.activeElement\)\)\s*\{\s*target\?\.focus\(\{ preventScroll: true \}\)/);
  assert.match(frame, /openFocusDirectionRef\.current = "selected"/);
  assert.doesNotMatch(frame, /setTimeout/);
});

test("deferred select return focus does not steal focus from the next control", () => {
  const source = readFileSync(new URL("../src/components/Fields.tsx", import.meta.url), "utf8");
  const apply = source.slice(source.indexOf("const applyValue = (nextValue: string | string[])"), source.indexOf("const handleOptionSelect", source.indexOf("const applyValue = (nextValue: string | string[])")));
  assert.match(apply, /const focusAtSelection = document\.activeElement/);
  assert.match(apply, /if \(active === document\.body \|\| active === focusAtSelection \|\| active === triggerRef\.current\)/);
});
