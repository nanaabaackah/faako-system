import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

test("Astro component style blocks only import external CSS", () => {
  const directory = new URL("../src/components/", import.meta.url);
  let count = 0;
  for (const name of readdirSync(directory).filter((name) =>
    name.endsWith(".astro"),
  )) {
    const component = new URL(name, directory);
    const source = readFileSync(component, "utf8");
    for (const [, block] of source.matchAll(/<style>([\s\S]*?)<\/style>/g)) {
      const imported = block.match(
        /^\s*@import "(\.\.\/styles\/components\/[^"\n]+\.css)";\s*$/,
      );
      assert.ok(imported, `${name} must keep CSS declarations in a stylesheet`);
      assert.ok(readFileSync(new URL(imported[1], component), "utf8").trim());
      count++;
    }
  }
  assert.equal(count, 8);
});
