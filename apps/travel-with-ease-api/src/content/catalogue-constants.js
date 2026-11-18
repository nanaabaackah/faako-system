// Public product vocabulary only; safe for the web and CMS to import.
export const packageOccasions = Object.freeze([
  { value: "honeymoon_couples", label: "Honeymoon & Couples" },
  { value: "celebrations", label: "Celebrations" },
  { value: "girls_trips", label: "Girls’ Trips" },
  { value: "family", label: "Family" },
  { value: "faith", label: "Faith" },
]);
export const enquiryTypes = Object.freeze([
  { value: "trip", label: "Trip" },
  { value: "gift", label: "Gift" },
  { value: "group", label: "Group" },
  { value: "celebration", label: "Celebration" },
]);

// Preserve service URLs independently from editable display titles.
export function serviceSlug(heading) {
  return heading
    .split(" · ")[0]
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

