import { readFileSync } from "node:fs";
import approvedRelease from "../../content/approved-public-release.json" with { type: "json" };

export function publicationSnapshotPath(env = process.env) {
  if (env.TWE_CONTENT_SNAPSHOT) return env.TWE_CONTENT_SNAPSHOT;
  if (["production", "staging"].includes(env.PUBLIC_APP_ENV)) {
    return new URL("../../content/approved-public-release.json", import.meta.url);
  }
  return null;
}

// Build-only import. Never hydrate this module or fetch staff drafts publicly.
export function publishedPage(slug) {
  const filename = publicationSnapshotPath();
  if (!filename) return undefined; // Preserve the existing local scaffold only.
  // Import bundled content so Astro can relocate prerender modules safely.
  const snapshot = process.env.TWE_CONTENT_SNAPSHOT
    ? JSON.parse(readFileSync(filename, "utf8")) : approvedRelease;
  if (snapshot.version !== 1 || !snapshot.pages || typeof snapshot.pages !== "object") throw new Error("Invalid publication snapshot.");
  return snapshot.pages[slug] || null; // Explicitly unpublished; never fall back to old copy.
}
