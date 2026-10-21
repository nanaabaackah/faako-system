import ical from "node-ical";
import { createHash } from "node:crypto";

const day = (date, timezone) => {
  const parts = new Intl.DateTimeFormat("en", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  return ["year", "month", "day"].map(key => parts.find(p => p.type === key).value).join("-");
};
const text = (value, max) => {
  const raw = typeof value === "string" ? value : typeof value?.val === "string" ? value.val : "";
  return raw.replace(/<[^>]*>/g, "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
};

// Runs only in a disposable worker with a wall-clock and heap limit.
export function normalizeCalendar(ics, from, to) {
  if (!ics.trimStart().startsWith("BEGIN:VCALENDAR") || !ics.trimEnd().endsWith("END:VCALENDAR")) throw new Error("Invalid calendar");
  const parsed = ical.sync.parseICS(ics);
  const source = Object.values(parsed).filter(event => event.type === "VEVENT");
  if (source.length > 2000) throw new Error("Calendar too large");
  const events = [];
  const startRange = new Date(from), endRange = new Date(to);
  for (const event of source) {
    if (!(event.start instanceof Date) || !Number.isFinite(+event.start)) throw new Error("Invalid date");
    if (event.status === "CANCELLED" || ["PRIVATE", "CONFIDENTIAL"].includes(event.class)) continue;
    const uid = text(event.uid, 512);
    if (!uid || uid !== event.uid) throw new Error("Invalid UID");
    const instances = ical.expandRecurringEvent(event, { from: startRange, to: new Date(+endRange - 1), expandOngoing: true });
    if (instances.length > 1000) throw new Error("Too many occurrences");
    for (const instance of instances) {
      const details = instance.event;
      if (details.status === "CANCELLED" || ["PRIVATE", "CONFIDENTIAL"].includes(details.class)) continue;
      const allDay = instance.isFullDay;
      const timezone = instance.start.tz && instance.start.tz !== "Etc/UTC" ? instance.start.tz : "UTC";
      const start = allDay ? day(instance.start, timezone) : instance.start.toISOString();
      const end = allDay ? day(instance.end, instance.end.tz || timezone) : instance.end.toISOString();
      if (!Number.isFinite(Date.parse(end)) || Date.parse(end) < Date.parse(start)) throw new Error("Invalid duration");
      if (Date.parse(start) >= +endRange || (Date.parse(end) <= +startRange && Date.parse(start) < +startRange)) continue;
      const title = text(instance.summary, 180);
      if (!title) throw new Error("Missing title");
      const location = text(details.location, 300);
      const recurrence = details.recurrenceid || instance.start;
      events.push({ id: createHash("sha256").update(`${uid}|${+recurrence}`).digest("hex"), uid, title, start, end, allDay,
        timezone: "Africa/Accra", location: /(?:https?:|www\.|meet\.google|zoom\.|teams\.|@)/i.test(location) ? "" : location,
        status: details.status === "TENTATIVE" ? "tentative" : "confirmed" });
      if (events.length > 1000) throw new Error("Too many events");
    }
  }
  return [...new Map(events.map(event => [event.id, event])).values()].sort((a, b) => a.start.localeCompare(b.start));
}
