import { readFileSync } from "node:fs";

// Build-only import. Never hydrate this module or fetch staff drafts publicly.
export function publishedPage(slug) {
  const filename = process.env.TWE_CONTENT_SNAPSHOT;
  if (!filename) return undefined; // Preserve the existing local scaffold only.
  const snapshot = JSON.parse(readFileSync(filename, "utf8"));
  if (snapshot.version !== 1 || !snapshot.pages || typeof snapshot.pages !== "object") throw new Error("Invalid publication snapshot.");
  return snapshot.pages[slug] || null; // Explicitly unpublished; never fall back to old copy.
}
