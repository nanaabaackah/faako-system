// Explicit test-only Node preload. Production builds must never use this module.
import { fixtureDocuments, fixtureEvents } from "./fixtures/cms.js";
if (process.env.TTNGH_FIXTURE_BUILD !== "true") throw new Error("Fixture preload requires explicit test opt-in");
const originalFetch = globalThis.fetch;
globalThis.fetch = async (input, options) => {
  const url = new URL(typeof input === "string" || input instanceof URL ? input : input.url);
  if (url.hostname === "fixture.api.sanity.io") {
    const records = url.searchParams.get("query")?.includes('_type == "event"') ? fixtureEvents : fixtureDocuments;
    return Response.json({result:[...records,...records.map(doc=>({...doc,_id:`drafts.${doc._id}`}))]});
  }
  if (url.hostname.endsWith(".api.sanity.io")) throw new Error("Real CMS calls are forbidden in fixture tests");
  return originalFetch(input, options);
};
