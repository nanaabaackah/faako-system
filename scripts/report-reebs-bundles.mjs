import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { basename, join, resolve } from "node:path";

const root = resolve(process.cwd());

const readAssets = (directory) => {
  if (!existsSync(directory)) return [];
  return readdirSync(directory)
    .filter((name) => name.endsWith(".js") || name.endsWith(".css"))
    .map((name) => ({ name, bytes: statSync(join(directory, name)).size }));
};

const total = (assets, extension) =>
  assets.filter(({ name }) => name.endsWith(extension)).reduce((sum, asset) => sum + asset.bytes, 0);

const findLargest = (assets, pattern) =>
  assets.filter(({ name }) => pattern.test(name)).sort((left, right) => right.bytes - left.bytes)[0] || null;

const formatBytes = (bytes = 0) => `${(bytes / 1024).toFixed(1)} KiB`;
const formatAsset = (asset) => asset ? `${asset.name} (${formatBytes(asset.bytes)})` : "not emitted";

const BUDGETS = [
  ["Portal entry", /^index-.*\.js$/, 80 * 1024],
  ["Portal vendor", /^vendor-.*\.js$/, 520 * 1024],
  ["Portal icons", /^icons-vendor-.*\.js$/, 360 * 1024],
  ["Portal PDF", /^pdf-jspdf-vendor-.*\.js$/, 390 * 1024],
  ["Portal maps", /^maps-vendor-.*\.js$/, 165 * 1024],
];

const portal = readAssets(join(root, "apps/reebs-portal/dist/assets"));
const website = readAssets(join(root, "apps/reebs-website/dist/_astro"));
const websiteSource = join(root, "apps/reebs-website/src");
const hydrationDirectives = existsSync(websiteSource)
  ? readdirSync(join(websiteSource, "pages"), { recursive: true })
      .filter((name) => String(name).endsWith(".astro"))
      .reduce((count, name) => {
        const source = readFileSync(join(websiteSource, "pages", name), "utf8");
        return count + (source.match(/client:(?:load|idle|visible|media|only)/g) || []).length;
      }, 0)
    + ((readFileSync(join(websiteSource, "layouts/BaseLayout.astro"), "utf8")
      .match(/client:(?:load|idle|visible|media|only)/g) || []).length)
  : 0;

if (!portal.length || !website.length) {
  console.error("Build both REEBS apps before running this report.");
  process.exit(1);
}

const rows = [
  ["Portal JS", formatBytes(total(portal, ".js"))],
  ["Portal CSS", formatBytes(total(portal, ".css"))],
  ["Portal entry", formatAsset(findLargest(portal, /^index-.*\.js$/))],
  ["Portal vendor", formatAsset(findLargest(portal, /^vendor-.*\.js$/))],
  ["Portal icons", formatAsset(findLargest(portal, /^icons-vendor-.*\.js$/))],
  ["Portal PDF", formatAsset(findLargest(portal, /^(?:pdf-|jspdf|html2canvas|purify).*\.js$/i))],
  ["Portal maps", formatAsset(findLargest(portal, /^maps-vendor-.*\.js$/))],
  ["Portal Water route", formatAsset(findLargest(portal, /^AdminWater-.*\.js$/))],
  ["Portal Accounting route", formatAsset(findLargest(portal, /^AdminAccounting-.*\.js$/))],
  ["Website client JS", formatBytes(total(website, ".js"))],
  ["Website CSS", formatBytes(total(website, ".css"))],
  ["Website largest JS", formatAsset(findLargest(website, /\.js$/))],
  ["Website map route", formatAsset(findLargest(website, /^Map\..*\.js$/))],
  ["Website hydration directives", String(hydrationDirectives)],
];

const width = Math.max(...rows.map(([label]) => label.length));
for (const [label, value] of rows) console.log(`${label.padEnd(width)}  ${value}`);

const websiteClientJs = total(website, ".js");
const websiteLargestJs = findLargest(website, /\.js$/);
const warnings = BUDGETS.flatMap(([label, pattern, budget]) => {
  const asset = findLargest(portal, pattern);
  return asset && asset.bytes > budget
    ? [`${label} exceeds ${formatBytes(budget)}: ${formatAsset(asset)}`]
    : [];
});
if (websiteClientJs > 1050 * 1024) warnings.push(`Website client JS exceeds 1050.0 KiB: ${formatBytes(websiteClientJs)}`);
if (websiteLargestJs?.bytes > 380 * 1024) warnings.push(`Website largest JS exceeds 380.0 KiB: ${formatAsset(websiteLargestJs)}`);

if (warnings.length) {
  console.warn("\nBundle budget review warnings:");
  for (const warning of warnings) console.warn(`- ${warning}`);
}
