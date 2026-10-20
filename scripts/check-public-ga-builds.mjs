import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

const workspaceRoot = resolve(import.meta.dirname, "..");
const sites = [
  { name: "byNana Portfolio", directory: "apps/bynana-portfolio", keys: ["VITE_GA_MEASUREMENT_ID", "VITE_GA_ID"] },
  { name: "Faako Website", directory: "apps/faako-website", keys: ["VITE_GA_MEASUREMENT_ID", "VITE_GA_ID"] },
  { name: "REEBS Website", directory: "apps/reebs-website", keys: ["VITE_GA_MEASUREMENT_ID", "VITE_GA_ID"] },
  { name: "Stroane storefront", directory: "apps/stroane-web", keys: ["VITE_GA_MEASUREMENT_ID", "VITE_GA_ID"] },
  { name: "TTNGH", directory: "apps/ttngh", keys: ["PUBLIC_GA_MEASUREMENT_ID"] },
  { name: "Travel With Ease Website", directory: "apps/travel-with-ease-web", keys: ["PUBLIC_GA_MEASUREMENT_ID"] },
];

const readEnvironment = (file) => {
  if (!existsSync(file)) return {};

  return Object.fromEntries(
    readFileSync(file, "utf8")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#") && line.includes("="))
      .map((line) => {
        const separator = line.indexOf("=");
        const key = line.slice(0, separator).trim();
        const value = line.slice(separator + 1).trim().replace(/^(['"])(.*)\1$/, "$2");
        return [key, value];
      }),
  );
};

const walk = (directory) => {
  if (!existsSync(directory)) return [];

  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
};

const readBuildText = (directory) => walk(directory)
  .filter((file) => /\.(?:html|js|mjs|txt)$/i.test(file))
  .map((file) => readFileSync(file, "utf8"))
  .join("\n");

let failed = false;

for (const site of sites) {
  const root = join(workspaceRoot, site.directory);
  const environment = readEnvironment(join(root, ".env"));
  const measurementId = site.keys.map((key) => environment[key]).find(Boolean) || "";
  const outputDirectory = join(root, "dist");

  if (!measurementId) {
    console.log(`${site.name}: UNCONFIGURED (set ${site.keys[0]} in the deployment environment)`);
    continue;
  }

  if (!/^G-[A-Z0-9]+$/i.test(measurementId)) {
    console.error(`${site.name}: FAIL (configured value is not a GA4 measurement ID)`);
    failed = true;
    continue;
  }

  if (!existsSync(outputDirectory)) {
    console.error(`${site.name}: FAIL (build output is missing)`);
    failed = true;
    continue;
  }

  const buildText = readBuildText(outputDirectory);
  const containsOwnId = buildText.includes(measurementId);
  const containsGoogleLoader = buildText.includes("googletagmanager.com/gtag/js");

  if (!containsOwnId || !containsGoogleLoader) {
    console.error(`${site.name}: FAIL (compiled Google tag contract is incomplete)`);
    failed = true;
    continue;
  }

  if (site.directory === "apps/stroane-web") {
    const adminText = readBuildText(join(outputDirectory, "admin"));
    if (adminText.includes(measurementId) || adminText.includes("googletagmanager.com")) {
      console.error(`${site.name}: FAIL (private admin output contains public analytics)`);
      failed = true;
      continue;
    }
  }

  console.log(`${site.name}: PASS`);
}

process.exitCode = failed ? 1 : 0;
