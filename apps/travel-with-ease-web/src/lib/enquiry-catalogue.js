import { publishedPage } from "./published.js";
import { publishedServices } from "./services.js";

const serviceIds = Object.freeze({
  "travel-readiness-session": "readiness",
  "full-trip-planning": "full_planning",
  "premium-concierge": "premium",
  "group-trip-planning": "group",
});

export function publishedEnquiryCatalogue() {
  return {
    services: publishedServices(publishedPage("services")).map((service) => ({
      id: serviceIds[service.slug], slug: service.slug, title: service.title,
    })).filter((service) => service.id),
    packages: (publishedPage("packages")?.packages || []).map((item) => ({
      id: item.id || item.slug,
      slug: item.slug,
      title: item.title,
      available: !["closed", "sold_out"].includes(item.availability || ""),
    })),
  };
}
