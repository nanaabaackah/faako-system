// Explicit local-only build fixture. Never imported by application code.
import { fixtureEvent } from "./event.js";
if (process.env.TTNGH_EVENTS_QA !== "true" || process.env.PUBLIC_SITE_INDEXABLE !== "false" || process.env.SANITY_PROJECT_ID !== "fixture") throw new Error("Event fixtures require an isolated non-indexable QA build");
const events = Array.from({length:7}, (_, index) => ({
  ...fixtureEvent, _id:`qa-event-${index}`, slug:{current:`qa-event-${index}`},
  title:`QA event ${index} — editorial layout verification`,
  seo:{description:`Synthetic event ${index} used only for automated website validation and never published as a real TTNGH event.`},
  seoDescription:`Synthetic event ${index} used only for automated website validation and never published as a real TTNGH event.`,
  calendarUid:index === 0 ? "qa-only" : "",
  start:`${index < 4 ? "2099" : "2000"}-10-${20+index}T10:00:00Z`,
  end:`${index < 4 ? "2099" : "2000"}-10-${20+index}T12:00:00Z`,
  registrationState:"open", registrationUrl:"https://example.org/qa-only",
}));
globalThis.fetch = async input => {
  const url = new URL(typeof input === "string" ? input : input.url || input);
  if (url.hostname !== "fixture.api.sanity.io") throw new Error("QA build blocked an unexpected network request");
  return Response.json({result: url.searchParams.get("query")?.includes('_type == "event"') ? events : []});
};
