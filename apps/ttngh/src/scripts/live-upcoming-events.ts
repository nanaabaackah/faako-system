import { createBrowserApiClient } from "@faako/api-client/browser";
import { dateKey, eventTime, upcomingCalendarEvents, validateCalendarResponse } from "../lib/calendar.js";

type LiveEvent = { id: string; uid: string; title: string; start: string; end: string; allDay: boolean; timezone: string; location: string; status: string };
type EditorialLink = { uid: string; start: string };

const element = (tag: string, text: string, className = "") => {
  const result = document.createElement(tag);
  result.textContent = text;
  result.className = className;
  return result;
};

class LiveUpcomingEvents extends HTMLElement {
  connectedCallback() {
    if (this.dataset.ready) return;
    this.dataset.ready = "true";
    void this.load();
  }

  async load() {
    if (!this.dataset.api) return;
    const list = this.querySelector<HTMLElement>("[data-live-upcoming-list]");
    if (!list) return;
    try {
      const editorialLinks = JSON.parse(this.dataset.editorialLinks || "[]") as EditorialLink[];
      if (!Array.isArray(editorialLinks)) return;
      const from = dateKey(new Date());
      // Railway's existing calendar endpoint permits at most 62 days per request.
      const to = new Date(Date.parse(from + "T00:00:00Z") + 61 * 86400_000).toISOString().slice(0, 10);
      const client = createBrowserApiClient({ baseUrl: this.dataset.api, credentials: "omit" });
      const response = validateCalendarResponse(await client.get(
        "/api/calendar/events?" + new URLSearchParams({ from, to }),
        { responseMode: "data", cache: "no-store", signal: AbortSignal.timeout(15000) },
      ));
      const events = upcomingCalendarEvents(response.events, editorialLinks, new Date(), 6) as LiveEvent[];
      if (!events.length) return;

      const cards = events.map(event => {
        const card = element("article", "", "bubble-card live-upcoming-card");
        const date = document.createElement("time");
        date.className = "live-upcoming-date";
        date.dateTime = event.start;
        date.textContent = eventTime(event);
        card.append(date, element("h3", event.title));
        if (event.location) card.append(element("p", event.location, "live-upcoming-location"));
        if (event.status === "tentative") card.append(element("p", "Tentative · Date or time may change", "live-upcoming-tentative"));

        const link = element("a", "View date on calendar", "text-link");
        link.href = "#calendar-title";
        link.setAttribute("aria-label", "View " + event.title + " on the event calendar");
        link.addEventListener("click", () => {
          const chosenDate = Date.parse(event.start) < Date.now() ? dateKey(new Date()) : dateKey(new Date(event.start));
          document.querySelector("month-calendar")?.dispatchEvent(new CustomEvent("ttngh:calendar-select", { detail: { date: chosenDate } }));
        });
        card.append(link);
        return card;
      });

      list.replaceChildren(...cards);
      this.hidden = false;
    } catch {
      // The editorial events and independent live calendar remain usable if this summary fails.
      this.hidden = true;
    }
  }
}
if (!customElements.get("live-upcoming-events")) customElements.define("live-upcoming-events", LiveUpcomingEvents);
