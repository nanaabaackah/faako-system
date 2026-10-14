import { contentIssues } from "./cms-validation.js";
// Public event boundary. No drafts, private venue details or raw HTML are rendered.
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const timestampPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;
function validTimestamp(value) {
  if (!timestampPattern.test(value) || !Number.isFinite(Date.parse(value))) return false;
  const date = new Date(`${value.slice(0, 10)}T00:00:00Z`);
  return date.toISOString().slice(0, 10) === value.slice(0, 10) && Number(value.slice(11, 13)) < 24;
}

function text(value, field, max, required = true) {
  if (value == null && !required) return "";
  if (typeof value !== "string" || (required && !value.trim()) || value.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)) throw new Error(`Invalid event ${field}`);
  return value.trim();
}

function httpsUrl(value, field) {
  const url = new URL(text(value, field, 2048));
  if (url.protocol !== "https:" || url.username || url.password) throw new Error(`Invalid event ${field}`);
  return url.href;
}

export function validateEvents(documents) {
  if (!Array.isArray(documents)) throw new Error("Invalid event response");
  const slugs = new Set();
  return documents.filter(doc => doc && !doc._id?.startsWith("drafts.") && !doc._id?.startsWith("versions.") && doc.publishState === "published").map(doc => {
    const issues=contentIssues({...doc,_type:"event"});
    if(issues.length)throw new Error(`Event publication blocked: ${issues.join(" ")}`);
    const slug = text(doc.slug?.current ?? doc.slug, "slug", 96);
    if (!slugPattern.test(slug) || slugs.has(slug)) throw new Error("Invalid or duplicate event slug");
    slugs.add(slug);
    const start = text(doc.start, "start", 40), end = text(doc.end, "end", 40);
    if (![start, end].every(validTimestamp) || Date.parse(end) <= Date.parse(start)) throw new Error("Invalid event dates");
    const timezone = text(doc.timezone, "timezone", 80);
    new Intl.DateTimeFormat("en-GH", { timeZone: timezone }).format(new Date(start));
    if (!["online", "in-person"].includes(doc.format)) throw new Error("Invalid event format");
    if (!["open", "closed", "not-open", "not-required"].includes(doc.registrationState)) throw new Error("Invalid event registration state");
    const registrationUrl = doc.registrationUrl ? httpsUrl(doc.registrationUrl, "registration URL") : "";
    if (doc.registrationState === "open" && !registrationUrl) throw new Error("Open registration needs a URL");
    const imageUrl = httpsUrl(doc.image?.url, "image URL");
    if (new URL(imageUrl).hostname !== "cdn.sanity.io") throw new Error("Event images must be approved Sanity assets");
    if (![doc.image.width, doc.image.height].every(n => Number.isInteger(n) && n > 0 && n <= 30000)) throw new Error("Invalid event image dimensions");
    const description = text(doc.description, "description", 20000);
    return {
      id:doc._id, slug, title: text(doc.title, "title", 120), summary: text(doc.summary, "summary", 320), description,
      start, end, timezone, format: doc.format,
      venue: text(doc.venue, "venue", 180, doc.format === "in-person"),
      address: text(doc.address, "public address", 400, false),
      onlineUrl: doc.format === "online" ? httpsUrl(doc.onlineUrl, "public online information URL") : "",
      registrationState: doc.registrationState, registrationUrl,
      accessibility: text(doc.accessibility, "accessibility", 1200),
      owner: text(doc.owner, "content owner", 160),
      image: { url: imageUrl, alt: text(doc.image.alt, "image alt", 300), width: doc.image.width, height: doc.image.height },
      relatedProgramme: text(doc.relatedProgramme, "related programme", 120, false),
      relatedProgrammeSlug: typeof doc.relatedProgrammeSlug === "string" && slugPattern.test(doc.relatedProgrammeSlug) ? doc.relatedProgrammeSlug : "",
      capacity: doc.capacityApproved === true && Number.isSafeInteger(doc.capacity) && doc.capacity > 0 ? doc.capacity : null,
      seoDescription: text(doc.seoDescription || doc.summary, "SEO description", 320),
    };
  });
}

export function groupEvents(events, now = new Date()) {
  return {
    upcoming: events.filter(event => Date.parse(event.end) >= +now).sort((a, b) => Date.parse(a.start) - Date.parse(b.start)),
    past: events.filter(event => Date.parse(event.end) < +now).sort((a, b) => Date.parse(b.start) - Date.parse(a.start)),
  };
}

export const eventPath = event => `/events/${event.slug}`;
export function formatEventDate(event) {
  const format = new Intl.DateTimeFormat("en-GH", { dateStyle: "full", timeStyle: "short", timeZone: event.timezone });
  return `${format.format(new Date(event.start))} – ${format.format(new Date(event.end))}`;
}
const calendarDate = date => new Date(date).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const eventLocation = event => event.format === "online" ? event.onlineUrl : [event.venue, event.address].filter(Boolean).join(", ");
export function googleCalendarUrl(event, site) {
  const query = new URLSearchParams({ action: "TEMPLATE", text: event.title, dates: `${calendarDate(event.start)}/${calendarDate(event.end)}`, ctz: event.timezone, details: `${event.summary}\n${new URL(eventPath(event), site)}`, location: eventLocation(event) });
  return `https://calendar.google.com/calendar/render?${query}`;
}

const escapeCalendar = value => value.replace(/\\/g, "\\\\").replace(/\r\n|\r|\n/g, "\\n").replace(/;/g, "\\;").replace(/,/g, "\\,");
// RFC 5545: fold at 75 UTF-8 octets, never through a Unicode code point.
function foldCalendar(line) {
  let result = "", bytes = 0;
  for (const char of line) {
    const size = new TextEncoder().encode(char).length;
    if (bytes + size > 75) { result += "\r\n "; bytes = 1; }
    result += char; bytes += size;
  }
  return result;
}
export function eventCalendarFile(event, site, now = new Date()) {
  const url = new URL(eventPath(event), site);
  return ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//TTNGH//Public events//EN", "CALSCALE:GREGORIAN", "BEGIN:VEVENT", `UID:${event.slug}@${url.hostname}`, `DTSTAMP:${calendarDate(now)}`, `DTSTART:${calendarDate(event.start)}`, `DTEND:${calendarDate(event.end)}`, `SUMMARY:${escapeCalendar(event.title)}`, `DESCRIPTION:${escapeCalendar(`${event.summary}\n${url.href}`)}`, `LOCATION:${escapeCalendar(eventLocation(event))}`, `URL:${url.href}`, "END:VEVENT", "END:VCALENDAR"].map(foldCalendar).join("\r\n") + "\r\n";
}

export function eventStructuredData(event, site) {
  return {
    confirmed: true, title: event.title, url: new URL(eventPath(event), site).href,
    startDate: event.start, endDate: event.end, description: event.summary, image: event.image.url,
    eventAttendanceMode: `https://schema.org/${event.format === "online" ? "OnlineEventAttendanceMode" : "OfflineEventAttendanceMode"}`,
    location: event.format === "online" ? { "@type": "VirtualLocation", url: event.onlineUrl } : { "@type": "Place", name: event.venue, ...(event.address ? { address: event.address } : {}) },
  };
}
