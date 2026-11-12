import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const read = (name) => readFileSync(path.join(root, name), "utf8");
const readme = read("README.md");
const docs = [
  "README.md",
  "docs/apps/travel-with-ease/README.md",
  "docs/apps/travel-with-ease/completion-status-2026-11-01.md",
  "docs/apps/travel-with-ease/readiness-check.md",
  "docs/apps/travel-with-ease/architecture.md",
  "docs/apps/travel-with-ease/env.md",
  "docs/apps/travel-with-ease/implementation-plan.md",
];
const memberPaths = ["apps", "packages"].flatMap((directory) =>
  readdirSync(path.join(root, directory), { withFileTypes: true })
    .filter((item) => item.isDirectory())
    .map((item) => `${directory}/${item.name}`)
    .filter((name) => existsSync(path.join(root, name, "package.json"))),
);
memberPaths.push("apps/ttngh/studio", "services/ttngh-api");
const manifests = memberPaths.map((name) => ({
  path: name,
  ...JSON.parse(read(`${name}/package.json`)),
}));
const matches = (name, pattern) =>
  new RegExp(
    `^${pattern
      .split("*")
      .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, "\\$&"))
      .join(".*")}$`,
  ).test(name);

test("root README workspace counts and package inventory match actual manifests", () => {
  assert.match(
    readme,
    new RegExp(`\\b${memberPaths.length} workspace members\\b`),
  );
  for (const directory of ["apps", "packages"]) {
    const count = memberPaths.filter(
      (name) =>
        name.startsWith(directory + "/") && name.split("/").length === 2,
    ).length;
    assert.match(
      readme,
      new RegExp(
        `\\b${count} ${directory === "apps" ? "application workspaces" : "shared packages"}\\b`,
      ),
    );
  }
  for (const manifest of manifests.filter(
    (item) =>
      item.path.split("/").length === 2 && !item.path.startsWith("services/"),
  )) {
    assert.ok(
      readme.includes(`\`${manifest.name}\``),
      `Missing workspace ${manifest.name}`,
    );
  }
});

test("current README and TWE navigation links resolve inside the repository", () => {
  for (const filename of docs) {
    const body = read(filename);
    for (const match of body.matchAll(/\[[^\]\n]*\]\(([^)\s]+)\)/g)) {
      const target = match[1];
      if (/^(?:https?:|mailto:|#)/.test(target)) continue;
      assert.ok(
        !path.isAbsolute(target),
        `Machine-local link in ${filename}: ${target}`,
      );
      const resolved = path.resolve(
        root,
        path.dirname(filename),
        target.split("#")[0],
      );
      assert.ok(
        resolved.startsWith(root),
        `Link escapes repository: ${target}`,
      );
      assert.ok(existsSync(resolved), `Missing link in ${filename}: ${target}`);
      const anchor = target.split("#")[1];
      if (anchor && resolved.endsWith(".md")) {
        const headings =
          readFileSync(resolved, "utf8").match(/^#{1,6} .+$/gm) || [];
        const anchors = headings.map((heading) =>
          heading
            .replace(/^#{1,6} /, "")
            .toLowerCase()
            .replace(/[^\p{L}\p{N}_ -]/gu, "")
            .replace(/ /g, "-"),
        );
        assert.ok(
          anchors.includes(anchor),
          `Missing heading in ${filename}: ${target}`,
        );
      }
    }
  }
});

test("documented TWE and root pnpm script commands exist", () => {
  const rootManifest = JSON.parse(read("package.json"));
  for (const filename of [
    "README.md",
    "docs/apps/travel-with-ease/completion-status-2026-11-01.md",
  ]) {
    const body = read(filename);
    for (const match of body.matchAll(
      /pnpm --filter (?:'([^']+)'|([^\s`]+)) (?:run )?([\w:-]+)/g,
    )) {
      const [, quoted, plain, command] = match;
      const selected = manifests.filter((manifest) =>
        matches(manifest.name, quoted || plain),
      );
      assert.ok(
        selected.length,
        `Unknown filter in ${filename}: ${quoted || plain}`,
      );
      for (const manifest of selected) {
        assert.ok(
          manifest.scripts?.[command],
          `Missing ${command} in ${manifest.name} (${filename})`,
        );
      }
    }
    for (const match of body.matchAll(/^pnpm (?:run )?([\w:-]+)/gm)) {
      const command = match[1];
      if (command === "install" || command === "--filter") continue;
      assert.ok(
        rootManifest.scripts?.[command],
        `Unknown root command ${command}`,
      );
    }
  }
});
