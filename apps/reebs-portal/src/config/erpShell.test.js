import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("portal document titles begin with REEBS Portal", () => {
  const shellSource = readFileSync(new URL("./erpShell.js", import.meta.url), "utf8");
  const htmlSource = readFileSync(new URL("../../index.html", import.meta.url), "utf8");

  assert.match(shellSource, /name:\s*["']REEBS Portal["']/);
  assert.doesNotMatch(shellSource, /REEBS ERP/);
  assert.match(htmlSource, /<title>REEBS Portal<\/title>/);
});
