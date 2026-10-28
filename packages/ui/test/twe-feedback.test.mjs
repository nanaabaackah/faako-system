import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const source = readFileSync(new URL("../src/components/Feedback.tsx",import.meta.url),"utf8");
test("TWE presentation is opt-in and exposes operation updates",()=>{
  assert.match(source,/presentation = "default"/);
  assert.match(source,/presentation === "twe"/);
  assert.match(source,/updateToast: \(id: string, item: Partial<FeedbackItem>\)/);
  assert.match(source,/current\.map\(toast => toast\.id === id/);
  assert.match(source,/const \[mounted, setMounted\] = useState\(false\)/);
  assert.match(source,/\{mounted\s*\? createPortal/);
});
test("TWE toast timers pause for hover/focus and persist loading/errors",()=>{
  assert.match(source,/hovered \|\| focused \|\| toast\.tone === "loading" \|\| toast\.tone === "error"/);
  assert.match(source,/remaining\.current - \(Date\.now\(\) - started\)/);
  assert.match(source,/window\.clearTimeout\(timer\)/);
  assert.match(source,/onBlurCapture/);
});
