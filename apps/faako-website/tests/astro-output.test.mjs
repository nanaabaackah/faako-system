import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const appRoot = new URL("..", import.meta.url).pathname;
const distRoot = join(appRoot, "dist");

const routes = [
  "/",
  "/about",
  "/case-studies",
  "/client-setup",
  "/configure",
  "/contact",
  "/dashboard",
  "/forgot-password",
  "/login",
  "/modules/crm",
  "/modules/delivery",
  "/modules/hr",
  "/modules/inventory",
  "/modules/reports",
  "/modules/website",
  "/pricing",
  "/privacy",
  "/signup",
  "/solutions",
  "/terms",
];

const noIndexRoutes = new Set([
  "/client-setup",
  "/dashboard",
  "/forgot-password",
  "/login",
  "/signup",
]);

const htmlPathForRoute = (route) =>
  route === "/" ? join(distRoot, "index.html") : join(distRoot, route, "index.html");

const readRoute = (route) => readFileSync(htmlPathForRoute(route), "utf8");

const walk = (directory) =>
  readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });

test("every public route is pre-rendered with complete metadata", () => {
  const titles = new Set();

  routes.forEach((route) => {
    const outputPath = htmlPathForRoute(route);
    assert.ok(existsSync(outputPath), `missing output for ${route}`);
    const html = readFileSync(outputPath, "utf8");
    const title = html.match(/<title>([^<]+)<\/title>/)?.[1];

    assert.ok(title, `missing title for ${route}`);
    assert.ok(!titles.has(title), `duplicate title: ${title}`);
    titles.add(title);
    assert.match(html, /<meta name="description" content="[^"]+"/);
    assert.match(html, /<link rel="canonical" href="https:\/\/faako\.nanaabaackah\.com/);
    assert.match(html, /<meta property="og:title" content="[^"]+"/);
    assert.match(html, /<meta name="twitter:card" content="summary_large_image"/);
    assert.match(html, /<script type="application\/ld\+json">/);
    assert.match(html, /<h1[\s>]/, `missing h1 for ${route}`);

    const expectedRobots = noIndexRoutes.has(route)
      ? 'content="noindex, nofollow"'
      : 'content="index, follow"';
    assert.ok(html.includes(expectedRobots), `wrong robots directive for ${route}`);
  });
});

test("sitemap and robots agree with indexability", () => {
  const robots = readFileSync(join(distRoot, "robots.txt"), "utf8");
  const sitemap = readFileSync(join(distRoot, "sitemap-0.xml"), "utf8");

  assert.match(robots, /Sitemap: https:\/\/faako\.nanaabaackah\.com\/sitemap-index\.xml/);
  noIndexRoutes.forEach((route) => {
    assert.ok(!sitemap.includes(`faako.nanaabaackah.com${route}<`), `${route} leaked into sitemap`);
  });
  assert.ok(sitemap.includes("faako.nanaabaackah.com/contact<"));
  assert.ok(sitemap.includes("faako.nanaabaackah.com/modules/inventory<"));
});

test("404, error, redirects, and forms use the Astro deployment contract", () => {
  const notFound = readFileSync(join(distRoot, "404.html"), "utf8");
  const serverError = readFileSync(join(distRoot, "500.html"), "utf8");
  const redirects = readFileSync(join(distRoot, "_redirects"), "utf8");
  const signup = readRoute("/signup");
  const clientSetup = readRoute("/client-setup");
  const contact = readRoute("/contact");

  assert.ok(notFound.includes('content="noindex, nofollow"'));
  assert.ok(serverError.includes('content="noindex, nofollow"'));
  assert.equal(redirects.trim(), "/case-studies/* /case-studies 301");
  assert.ok(!redirects.includes("index.html 200"), "SPA fallback must not remain");
  const signupAction = signup.match(/<form[^>]+action="([^"]+)"/)?.[1];
  const setupAction = clientSetup.match(/<form[^>]+action="([^"]+)"/)?.[1];
  assert.ok(new URL(signupAction, "https://faako.invalid").pathname.endsWith("/signup"));
  assert.ok(new URL(setupAction, "https://faako.invalid").pathname.endsWith("/signup"));
  assert.match(contact, /action="mailto:hello@faako\.nanaabaackah\.com"/);
});

test("the deployment CSP authorises every generated inline script by hash", () => {
  const headers = readFileSync(join(distRoot, "_headers"), "utf8");
  assert.ok(!headers.includes("__ASTRO_SCRIPT_HASHES__"));
  assert.ok(!headers.includes("'unsafe-inline' https://www.googletagmanager.com"));

  const htmlFiles = walk(distRoot).filter((path) => path.endsWith(".html"));
  htmlFiles.forEach((file) => {
    const html = readFileSync(file, "utf8");
    for (const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
      if (/\bsrc\s*=/i.test(match[1] || "") || !match[2]) continue;
      const digest = createHash("sha256").update(match[2]).digest("base64");
      assert.ok(headers.includes(`'sha256-${digest}'`), `missing CSP hash for ${file}`);
    }
  });
});

test("generated documents have no unresolved placeholder links or missing local targets", () => {
  const htmlFiles = walk(distRoot).filter((path) => path.endsWith(".html"));

  htmlFiles.forEach((file) => {
    const html = readFileSync(file, "utf8");
    assert.ok(!/X{4,}|example\.com\/placeholder/i.test(html), `placeholder found in ${file}`);

    for (const match of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
      const rawTarget = match[1];
      if (
        /^(?:https?:|mailto:|tel:|data:|blob:|#)/.test(rawTarget) ||
        rawTarget.startsWith("//")
      ) {
        continue;
      }

      const path = rawTarget.split(/[?#]/, 1)[0];
      if (!path || !path.startsWith("/")) continue;

      const localPath = join(distRoot, path);
      const routeIndex = join(distRoot, path, "index.html");
      const htmlFile = `${localPath}.html`;
      assert.ok(
        existsSync(localPath) || existsSync(routeIndex) || existsSync(htmlFile),
        `missing local target ${rawTarget} linked from ${file}`,
      );
    }
  });
});
