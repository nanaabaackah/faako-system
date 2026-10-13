import { validateEvents } from "./events.js";

const query = `*[_type == "event" && publishState == "published" && !(_id in path("drafts.**")) && !(_id in path("versions.**"))]{
  _id, title, slug, summary, description, start, end, timezone, format, venue, address, seo, capacity, capacityApproved,
  onlineUrl, registrationState, registrationUrl, accessibility, owner, publishState,
  "relatedProgramme": select(relatedProgramme->publishState == "published" => relatedProgramme->title),
  "relatedProgrammeSlug": select(relatedProgramme->publishState == "published" => relatedProgramme->slug.current), "seoDescription": seo.description,
  "image": {"url": image.asset->url, "width": image.asset->metadata.dimensions.width,
    "height": image.asset->metadata.dimensions.height, "alt": image.alt}
}`;

// Build/server only. Never import this module into a browser script.
export async function fetchPublishedEvents(env, request = fetch) {
  const project = env.SANITY_PROJECT_ID?.trim(), dataset = env.SANITY_DATASET?.trim();
  if (!project && !dataset && env.TTNGH_CMS_REQUIRED !== "true") return [];
  if (!/^[a-z0-9]+$/.test(project || "") || !/^[a-z0-9_-]+$/.test(dataset || "")) throw new Error("Configure SANITY_PROJECT_ID and SANITY_DATASET before publishing events");
  const url = new URL(`https://${project}.api.sanity.io/v2025-02-19/data/query/${dataset}`);
  url.searchParams.set("query", query);
  url.searchParams.set("perspective", "published");
  const response = await request(url, { headers: env.SANITY_READ_TOKEN ? { Authorization: `Bearer ${env.SANITY_READ_TOKEN}` } : {}, signal: AbortSignal.timeout(15000), redirect: "error" });
  // Never expose provider bodies or authentication headers in build errors.
  if (!response.ok) throw new Error("Unable to load published TTNGH events; deployment stopped");
  const body = await response.json();
  return validateEvents(body.result);
}

let cached;
export function getPublishedEvents() {
  return cached ??= fetchPublishedEvents(import.meta.env);
}
