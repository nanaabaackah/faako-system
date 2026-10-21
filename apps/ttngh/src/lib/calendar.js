export const CALENDAR_TIMEZONE = "Africa/Accra";
export function dateKey(date) {
  const parts = new Intl.DateTimeFormat("en", { timeZone: CALENDAR_TIMEZONE, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  return ["year", "month", "day"].map(key => parts.find(part => part.type === key).value).join("-");
}
export function monthRange(year, month) {
  return { from: dateKey(new Date(Date.UTC(year, month, 1))), to: dateKey(new Date(Date.UTC(year, month + 1, 1))) };
}
export function eventsOnDay(events, date) {
  // Accra has no daylight-saving offset. All-day dates retain their calendar meaning.
  const from = Date.parse(date + "T00:00:00Z"), to = from + 86400000;
  return events.filter(event => Date.parse(event.start) < to && (Date.parse(event.end) > from || Date.parse(event.start) >= from));
}
export function validateCalendarResponse(value) {
  if (!value || !Array.isArray(value.events) || value.events.length > 1000 || !Number.isInteger(value.freshnessSeconds) || value.freshnessSeconds < 0 || value.freshnessSeconds > 300) throw new Error("Invalid calendar response");
  for (const event of value.events) {
    for (const [key, max] of [["id", 128], ["uid", 512], ["title", 180], ["location", 300]]) {
      if (typeof event[key] !== "string" || event[key].length > max || (key !== "location" && !event[key])) throw new Error("Invalid event");
    }
    if (typeof event.allDay !== "boolean" || event.timezone !== CALENDAR_TIMEZONE || !["confirmed", "tentative"].includes(event.status)) throw new Error("Invalid event");
    const pattern = event.allDay ? /^\d{4}-\d{2}-\d{2}$/ : /^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/;
    if (![event.start, event.end].every(date => typeof date === "string" && pattern.test(date) && Number.isFinite(Date.parse(date))) || Date.parse(event.end) < Date.parse(event.start)) throw new Error("Invalid event date");
  }
  return value;
}
export function eventTime(event) {
  const date = new Intl.DateTimeFormat("en-GH", { day: "numeric", month: "short", year: "numeric", timeZone: CALENDAR_TIMEZONE });
  const time = new Intl.DateTimeFormat("en-GH", { hour: "numeric", minute: "2-digit", timeZone: CALENDAR_TIMEZONE });
  const start = new Date(event.start), end = new Date(event.end);
  if (event.allDay) {
    const last = new Date(Math.max(+start, +end - 86400000));
    return "All day · " + date.format(start) + (dateKey(start) !== dateKey(last) ? " – " + date.format(last) : "");
  }
  return date.format(start) + ", " + time.format(start) + " – " + (dateKey(start) !== dateKey(end) ? date.format(end) + ", " : "") + time.format(end) + " (Ghana time)";
}
