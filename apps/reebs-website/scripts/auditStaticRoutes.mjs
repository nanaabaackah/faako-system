import { existsSync, readFileSync, statSync } from "node:fs";
import { extname, join, normalize, resolve, sep } from "node:path";

const appRoot = resolve(new URL("..", import.meta.url).pathname);
const distRoot = join(appRoot, "dist");
const catalogue = JSON.parse(
  readFileSync(join(appRoot, "src", "content", "public-catalogue.json"), "utf8"),
);
const externalProtocols = /^(?:https?:|mailto:|tel:|sms:|javascript:|data:)/i;
const htmlRoutes = new Map();
const checkedAssets = new Set();
const redirectPaths = new Set();
const errors = [];

const routeFromHtmlFile = (file) => {
  const relative = file.slice(distRoot.length).split(sep).join("/");
  if (relative === "/index.html") return "/";
  if (relative === "/404.html") return "/404";
  if (relative === "/500.html") return "/500";
  return relative.replace(/\/index\.html$/, "");
};

const collectHtmlFiles = async () => {
  const { readdir } = await import("node:fs/promises");
  const visit = async (directory) => {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const entryPath = join(directory, entry.name);
      if (entry.isDirectory()) await visit(entryPath);
      else if (entry.name.endsWith(".html")) htmlRoutes.set(routeFromHtmlFile(entryPath), entryPath);
    }
  };
  await visit(distRoot);
};

const resolveInternalTarget = (rawHref, route) => {
  if (!rawHref || rawHref.startsWith("#") || externalProtocols.test(rawHref)) return null;
  const parsed = new URL(rawHref, `https://reebs.local${route.endsWith("/") ? route : `${route}/`}`);
  const pathname = decodeURIComponent(parsed.pathname);
  if (pathname.startsWith("//")) return null;
  return pathname;
};

const targetExists = (pathname) => {
  if (pathname === "/404" || pathname === "/500") return true;
  if (redirectPaths.has(pathname)) return true;
  if (htmlRoutes.has(pathname) || htmlRoutes.has(pathname.replace(/\/$/, ""))) return true;

  const relative = pathname.replace(/^\/+/, "");
  const assetPath = normalize(join(distRoot, relative));
  if (!assetPath.startsWith(`${distRoot}${sep}`) && assetPath !== distRoot) return false;
  if (checkedAssets.has(assetPath)) return true;
  if (existsSync(assetPath) && statSync(assetPath).isFile()) {
    checkedAssets.add(assetPath);
    return true;
  }
  return false;
};

await collectHtmlFiles();

const redirectsFile = join(distRoot, "_redirects");
if (existsSync(redirectsFile)) {
  readFileSync(redirectsFile, "utf8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"))
    .forEach((line) => redirectPaths.add(line.split(/\s+/)[0]));
}

for (const [route, file] of htmlRoutes) {
  const html = readFileSync(file, "utf8");
  const hrefs = [...html.matchAll(/\bhref=(?:"([^"]*)"|'([^']*)')/g)]
    .map((match) => match[1] ?? match[2]);
  for (const href of hrefs) {
    const pathname = resolveInternalTarget(href, route);
    if (!pathname || targetExists(pathname)) continue;
    errors.push(`${route} -> ${href}`);
  }
}

for (const item of [...catalogue.rentals, ...catalogue.shop]) {
  if (!htmlRoutes.has(item.path)) errors.push(`catalogue path missing: ${item.path}`);
}

if (errors.length) {
  console.error(`Static route audit failed with ${errors.length} broken target(s):`);
  errors.slice(0, 100).forEach((error) => console.error(`- ${error}`));
  process.exitCode = 1;
} else {
  console.log(
    `Static route audit passed: ${htmlRoutes.size} HTML routes, `
      + `${catalogue.rentals.length} rental details, ${catalogue.shop.length} shop details, `
      + `${checkedAssets.size} linked assets.`,
  );
}
