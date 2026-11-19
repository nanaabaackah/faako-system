import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import test from "node:test";

const srcRoot = fileURLToPath(new URL(".", import.meta.url));
const findUiSources = async (directory) => {
  const entries = await readdir(directory, { withFileTypes: true });
  const results = await Promise.all(entries.map(async (entry) => {
    const pathname = path.join(directory, entry.name);
    if (entry.isDirectory()) return findUiSources(pathname);
    if (!entry.isFile() || !/\.(jsx|tsx)$/.test(entry.name) || /\.test\./.test(entry.name)) return [];
    return [pathname];
  }));
  return results.flat();
};

test("DEV ERP uses Faako fields and icon components instead of native form popovers or emoji glyphs", async () => {
  const files = await findUiSources(srcRoot);
  const failures = [];
  for (const filename of files) {
    const source = await readFile(filename, "utf8");
    const relative = path.relative(srcRoot, filename);
    for (const [description, pattern] of [
      ["native select (use SelectField)", /<select\b/gi],
      ["native calendar/time picker (use DateField, MonthField, or TimeField)", /<input\b[^>]*\btype\s*=\s*["'](?:date|month|time|datetime-local)["']/gi],
      ["emoji icon (use the existing icon library)", /[\u{1F300}-\u{1FAFF}\u2705\u274C\u26A0\u2713\u2192]/gu],
    ]) {
      for (const match of source.matchAll(pattern)) {
        const line = source.slice(0, match.index).split("\n").length;
        failures.push(`${relative}:${line}: ${description}`);
      }
    }
  }
  assert.deepEqual(failures, [], failures.join("\n"));
});
