// Isolated build-only variations. Never import into application code or deploy.
import { fixtureDocuments } from "./fixtures/cms.js";
if (process.env.TTNGH_FIXTURE_BUILD !== "true") throw Error("Fixture opt-in required");
for (const type of ["programme", "newsArticle", "resource"]) {
  const original = fixtureDocuments.find(doc => doc._type === type);
  for (let index = 2; index <= 3; index++) {
    const doc = structuredClone(original);
    doc._id += "-" + index;
    doc.slug.current += "-" + index;
    doc.title = index === 2 ? "Synthetic publication title with a deliberately longer description for responsive editorial layout checks" : "LongUnbrokenSyntheticTitleForResponsiveReflowVerificationAcrossSmallScreensWithoutInventingAnyClientClaims";
    doc.summary = "Synthetic summary for isolated layout verification only. ".repeat(5).trim();
    doc.seo.description = "Isolated " + type + " layout fixture " + index + ": verifies different collection sizes, responsive title wrapping and metadata without publishing real claims.";
    if(type === "resource" && index === 2) delete doc.image;
    fixtureDocuments.push(doc);
  }
}
await import("./fixture-loader.mjs");
