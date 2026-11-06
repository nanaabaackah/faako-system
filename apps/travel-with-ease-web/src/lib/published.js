import { readFileSync } from "node:fs";
import approvedRelease from "../../content/approved-public-release.json" with { type: "json" };

export function publicationSnapshotPath(env = process.env) {
  if (env.TWE_CONTENT_SNAPSHOT) return env.TWE_CONTENT_SNAPSHOT;
  // Local development uses the same approved content as hosted builds.
  // Explicit snapshots remain authoritative and never fall back to bundled copy.
  return new URL("../../content/approved-public-release.json", import.meta.url);
}

// Build-only import. Never hydrate this module or fetch staff drafts publicly.
export function publishedPage(slug) {
  const filename = publicationSnapshotPath();
  // Import bundled content so Astro can relocate prerender modules safely.
  const snapshot = process.env.TWE_CONTENT_SNAPSHOT
    ? JSON.parse(readFileSync(filename, "utf8")) : approvedRelease;
  if (snapshot.version !== 1 || !snapshot.pages || typeof snapshot.pages !== "object") throw new Error("Invalid publication snapshot.");
  if (slug.startsWith("journal/")) return withPlacementImages(snapshot.pages.journal?.articles?.find(article => article.slug === slug.slice(8)) || null);
  if (slug.startsWith("travel-tips/")) return withPlacementImages(snapshot.pages["travel-tips"]?.tips?.find(tip => tip.slug === slug.slice(12)) || null);
  if (slug.startsWith("packages/")) return withPlacementImages(snapshot.pages.packages?.packages?.find(item => item.slug === slug.slice(9)) || null);
  return withPlacementImages(snapshot.pages[slug] || null); // Explicitly unpublished; never fall back to old copy.
}
function withPlacementImages(value) {
  if(Array.isArray(value))return value.map(withPlacementImages);
  if(!value||typeof value!=='object')return value;
  const copy=Object.fromEntries(Object.entries(value).map(([key,item])=>[key,withPlacementImages(item)]));
  if(copy.imagePlacement?.image)copy.image=copy.imagePlacement.image;
  else if(!copy.image&&copy.imagePlacement?.mobileImage)copy.image=copy.imagePlacement.mobileImage;
  return copy;
}
