import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { buildHoldingPage } from "../scripts/build-holding.mjs";

const rootDirectory = fileURLToPath(new URL("../", import.meta.url));
const launcher = path.join(rootDirectory, "scripts", "build-site.mjs");

test("holding page publishes only allowlisted assets without any functional website", async () => {
  const scratch = await mkdtemp(path.join(os.tmpdir(), "twe-holding-"));
  try {
    const outputDirectory = path.join(scratch, "dist");
    await buildHoldingPage({ rootDirectory, outputDirectory });
    const files = (await readdir(outputDirectory)).sort();
    assert.deepEqual(files, [
      "404.html", "_headers", "_redirects", "brand", "favicon.ico",
      "holding.css", "index.html", "media", "robots.txt",
    ].sort());
    const html = await readFile(path.join(outputDirectory, "index.html"), "utf8");
    assert.match(html, /noindex, nofollow/);
    assert.match(html, /https:\/\/wa\.me\/233208387020/);
    assert.match(html, /mailto:info@travelwitheasegh\.com/);
    assert.match(html, /The best journeys are worth the wait/);
    assert.match(html, /Our website is currently under construction/);
    assert.match(html, /class="signature">A Little More You/);
    assert.match(html, /family=Poiret\+One/);
    assert.match(html, /family=Quicksand/);
    assert.match(html, /family=Sassy\+Frass/);
    assert.match(html, /family=Inter/);
    assert.match(html, /<svg class="action-icon" aria-hidden="true"/);
    assert.doesNotMatch(html, /↗|·/);
    const css = await readFile(path.join(outputDirectory, "holding.css"), "utf8");
    assert.match(css, /--brand-navy:#010c33/);
    assert.match(css, /--brand-cream:#f4ede3/);
    assert.match(css, /--brand-gold:#d8b56a/);
    assert.match(css, /--twe-radius-button:6px/);
    assert.match(css, /--font-display:"Poiret One"/);
    assert.match(css, /--font-body:"Quicksand"/);
    assert.match(css, /--font-signature:"Sassy Frass"/);
    assert.match(css, /--font-impact:"Inter"/);
    assert.doesNotMatch(css, /Georgia|border-radius:999px/);
    assert.doesNotMatch(html, /<script|\/api\/|googletagmanager|\/packages|<form/i);
    assert.equal(await readFile(path.join(outputDirectory, "404.html"), "utf8"), html);
    assert.equal(await readFile(path.join(outputDirectory, "_redirects"), "utf8"), "/* /index.html 200\n");
    assert.match(await readFile(path.join(outputDirectory, "_headers"), "utf8"), /X-Robots-Tag: noindex, nofollow/);
    assert.match(await readFile(path.join(outputDirectory, "_headers"), "utf8"), /font-src .*https:\/\/fonts\.gstatic\.com/);
    for (const name of ["brand/logo.png", "media/hero.webp", "media/mobile.webp"]) {
      assert.ok((await stat(path.join(outputDirectory, name))).size > 1000);
    }
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }
});

test("holding mode fails outside production and never conceals staging", () => {
  for (const environment of ["staging", "development", "test", ""]) {
    const result = spawnSync(process.execPath, [launcher], {
      cwd: rootDirectory,
      encoding: "utf8",
      env: { ...process.env, PUBLIC_APP_ENV: environment, TWE_HOLDING_PAGE: "true" },
    });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /holding page may only be built/);
  }
});

test("invalid holding flag fails explicitly", () => {
  const result = spawnSync(process.execPath, [launcher], {
    cwd: rootDirectory,
    encoding: "utf8",
    env: { ...process.env, PUBLIC_APP_ENV: "production", TWE_HOLDING_PAGE: "yes" },
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /TWE_HOLDING_PAGE must be/);
});
