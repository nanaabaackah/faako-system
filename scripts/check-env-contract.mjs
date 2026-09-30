#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const args = process.argv.slice(2);
const exampleArg = args.find((arg) => !arg.startsWith("--"));
const targetIndex = args.indexOf("--target");
const targetArg = targetIndex >= 0 ? args[targetIndex + 1] : "";

if (!exampleArg) {
  console.error("Usage: node scripts/check-env-contract.mjs <example-file> [--target <environment-file>]");
  process.exit(2);
}

const parseKeys = (filePath) => {
  const resolvedPath = resolve(filePath);
  if (!existsSync(resolvedPath)) {
    throw new Error(`Environment contract file not found: ${filePath}`);
  }

  const keys = new Set();
  const duplicates = new Set();
  for (const line of readFileSync(resolvedPath, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/);
    if (!match) continue;
    if (keys.has(match[1])) duplicates.add(match[1]);
    keys.add(match[1]);
  }

  return { keys, duplicates };
};

try {
  const example = parseKeys(exampleArg);
  if (example.duplicates.size) {
    throw new Error(`Duplicate keys in ${exampleArg}: ${[...example.duplicates].sort().join(", ")}`);
  }

  if (!targetArg) {
    console.log(`Environment contract passed: ${example.keys.size} documented keys in ${exampleArg}.`);
    process.exit(0);
  }

  const target = parseKeys(targetArg);
  if (target.duplicates.size) {
    throw new Error(`Duplicate keys in ${targetArg}: ${[...target.duplicates].sort().join(", ")}`);
  }

  const missing = [...example.keys].filter((key) => !target.keys.has(key)).sort();
  const undocumented = [...target.keys].filter((key) => !example.keys.has(key)).sort();

  console.log(`Environment drift check (key names only): ${exampleArg} -> ${targetArg}`);
  console.log(`Missing keys: ${missing.length ? missing.join(", ") : "none"}`);
  console.log(`Undocumented keys: ${undocumented.length ? undocumented.join(", ") : "none"}`);
  if (missing.length || undocumented.length) process.exitCode = 1;
} catch (error) {
  console.error(`Environment contract failed: ${error.message}`);
  process.exit(1);
}
