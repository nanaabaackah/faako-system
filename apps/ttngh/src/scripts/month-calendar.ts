import { createBrowserApiClient } from "@faako/api-client/browser";
import { dateKey, monthRange, eventsOnDay, eventTime, validateCalendarResponse } from "../lib/calendar.js";

type CalendarEvent = { id: string; uid: string; title: string; start: string; end: string; allDay: boolean; timezone: string; location: string; status: string };
type CalendarData = { events: CalendarEvent[]; freshnessSeconds: number };
const node = (tag: string, text: string, className = "") => {
  const element = document.createElement(tag);
  element.textContent = text;
  element.className = className;
  return element;
};

class MonthCalendar extends HTMLElement {
  timer?: ReturnType<typeof setInterval>;
  connectedCallback() {
    if (this.dataset.ready) return;
    this.dataset.ready = "true";
    // Build-produced published event links only; never guess from a title or date.
    const eventLinks = new Map<string, string>();
    try {
      const links = JSON.parse(this.dataset.eventLinks || "[]");
      if (Array.isArray(links)) for (const link of links) {
        if (typeof link.uid === "string" && typeof link.path === "string" && /^\/events\/[a-z0-9]+(?:-[a-z0-9]+)*$/.test(link.path)) eventLinks.set(link.uid, link.path);
      }
    } catch { /* The live schedule remains usable if editorial links are unavailable. */ }
    const today = dateKey(new Date());
    let year = Number(today.slice(0, 4)), month = Number(today.slice(5, 7)) - 1;
    let selected = today, events: CalendarEvent[] = [], loaded = false, busy = false;
    let desired = { year, month };
    const cache = new Map<string, { data: CalendarData; expires: number }>();
    const client = this.dataset.api ? createBrowserApiClient({ baseUrl: this.dataset.api, credentials: "omit" }) : null;
    const status = this.querySelector<HTMLElement>("[data-month-status]")!;
    const retry = this.querySelector<HTMLButtonElement>("[data-month-retry]")!;
    const table = this.querySelector<HTMLTableElement>("table")!;
    const body = this.querySelector<HTMLTableSectionElement>("tbody")!;
    const label = this.querySelector<HTMLElement>("[data-month-label]")!;
    const controls = [...this.querySelectorAll<HTMLButtonElement>(".month-toolbar button")];
    const longDate = (date: string) => new Intl.DateTimeFormat("en-GH", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Accra" }).format(new Date(date));
    const agenda = () => {
      this.querySelector("[data-agenda-title]")!.textContent = longDate(selected);
      const container = this.querySelector("[data-agenda-events]")!;
      container.replaceChildren();
      const matches = eventsOnDay(events, selected);
      if (!loaded || !matches.length) container.append(node("p", loaded ? "No events scheduled for this day." : "The live schedule has not loaded yet."));
      for (const event of matches) {
        const article = node("article", "", "month-agenda-event");
        article.append(node("h5", event.title), node("p", eventTime(event)));
        if (event.location) article.append(node("p", event.location));
        if (event.status === "tentative") article.append(node("p", "Tentative — date or time may change.", "month-tentative"));
        const path = eventLinks.get(event.uid);
        if (path) {
          const link = document.createElement("a");
          link.href = path;
          link.className = "text-link";
          link.textContent = "View full event";
          link.setAttribute("aria-label", `View full event: ${event.title}`);
          article.append(link);
        }
        container.append(article);
      }
    };
    const select = (date: string, focus = false) => {
      selected = date;
      for (const button of this.querySelectorAll<HTMLButtonElement>("[data-day]")) {
        const active = button.dataset.day === date;
        button.tabIndex = active ? 0 : -1;
        button.setAttribute("aria-pressed", String(active));
        if (active && focus) button.focus();
      }
      agenda();
    };
    const render = () => {
      const focusedDay = this.contains(document.activeElement) ? (document.activeElement as HTMLElement)?.dataset.day : undefined;
      label.textContent = new Intl.DateTimeFormat("en-GH", { month: "long", year: "numeric", timeZone: "Africa/Accra" }).format(new Date(Date.UTC(year, month, 1)));
      const offset = (new Date(Date.UTC(year, month, 1)).getUTCDay() + 6) % 7;
      const count = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
      body.replaceChildren();
      for (let row = 0; row < 6; row++) {
        const tr = document.createElement("tr");
        for (let col = 0; col < 7; col++) {
          const cell = document.createElement("td"), day = row * 7 + col - offset + 1;
          if (day > 0 && day <= count) {
            const date = dateKey(new Date(Date.UTC(year, month, day))), matches = eventsOnDay(events, date);
            const button = document.createElement("button");
            button.type = "button"; button.dataset.day = date; button.className = "month-day";
            button.append(node("span", String(day)));
            if (matches.length) button.append(node("span", String(matches.length), "month-count"));
            button.setAttribute("aria-label", longDate(date) + (date === dateKey(new Date()) ? ", today" : "") + (loaded ? ", " + matches.length + " events" : ", schedule not loaded"));
            if (date === dateKey(new Date())) button.setAttribute("aria-current", "date");
            if (matches.length) button.title = matches.map(event => event.title).join("; ");
            button.addEventListener("click", () => select(date));
            button.addEventListener("keydown", event => {
              const offsets: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7, Home: 1 - day, End: count - day };
              if (!(event.key in offsets)) return;
              event.preventDefault();
              select(dateKey(new Date(Date.UTC(year, month, Math.max(1, Math.min(count, day + offsets[event.key]))))), true);
            });
            cell.append(button);
          }
          tr.append(cell);
        }
        body.append(tr);
      }
      select(selected);
      if (focusedDay) this.querySelector<HTMLButtonElement>('[data-day="' + focusedDay + '"]')?.focus({ preventScroll: true });
    };
    const renderLoading = () => {
      body.replaceChildren();
      for (let row = 0; row < 6; row++) {
        const tr = document.createElement("tr");
        for (let col = 0; col < 7; col++) {
          const cell = document.createElement("td");
          const placeholder = node("span", "", "month-placeholder");
          placeholder.setAttribute("aria-hidden", "true");
          cell.append(placeholder); tr.append(cell);
        }
        body.append(tr);
      }
    };
    const load = async (nextYear = year, nextMonth = month, force = false) => {
      if (busy) return;
      busy = true; desired = { year: nextYear, month: nextMonth };
      controls.forEach(button => button.disabled = true); retry.hidden = true;
      table.setAttribute("aria-busy", "true"); this.classList.toggle("month-loading", !loaded);
      if (!loaded) renderLoading();
      status.textContent = loaded ? "Refreshing the live calendar…" : "Loading the live calendar…";
      try {
        if (!client) throw new Error("Calendar not configured");
        const range = monthRange(nextYear, nextMonth), key = range.from;
        let cached = cache.get(key);
        if (force || !cached || cached.expires <= Date.now()) {
          const data = validateCalendarResponse(await client.get("/api/calendar/events?" + new URLSearchParams(range), { responseMode: "data", signal: AbortSignal.timeout(15000), cache: "no-store" })) as CalendarData;
          cached = { data, expires: Date.now() + data.freshnessSeconds * 1000 };
          if (cache.size >= 12) cache.delete(cache.keys().next().value!);
          cache.set(key, cached);
        }
        year = nextYear; month = nextMonth; events = cached.data.events; loaded = true;
        const currentToday = dateKey(new Date());
        if (!selected.startsWith(range.from.slice(0, 7))) selected = currentToday.startsWith(range.from.slice(0, 7)) ? currentToday : range.from;
        render();
        status.textContent = events.length ? events.length + " scheduled events this month. Select a day for details." : "No events are scheduled for this month.";
      } catch {
        if (!loaded) render();
        status.textContent = "We couldn’t refresh the live calendar right now." + (loaded ? " The displayed schedule has not been refreshed; dates may have changed." : "");
        retry.hidden = false;
      } finally {
        busy = false; controls.forEach(button => button.disabled = false);
        table.setAttribute("aria-busy", "false"); this.classList.remove("month-loading");
      }
    };
    const move = (offset: number) => { const date = new Date(Date.UTC(year, month + offset, 1)); void load(date.getUTCFullYear(), date.getUTCMonth()); };
    this.querySelector("[data-month-prev]")!.addEventListener("click", () => move(-1));
    this.querySelector("[data-month-next]")!.addEventListener("click", () => move(1));
    this.querySelector("[data-month-today]")!.addEventListener("click", () => {
      const now = dateKey(new Date()); selected = now;
      void load(Number(now.slice(0, 4)), Number(now.slice(5, 7)) - 1);
    });
    retry.addEventListener("click", () => void load(desired.year, desired.month, true));
    void load();
    this.timer = setInterval(() => {
      const bounds = this.getBoundingClientRect();
      const cached = cache.get(monthRange(year, month).from);
      if ((!cached || cached.expires <= Date.now()) && !document.hidden && bounds.bottom > 0 && bounds.top < innerHeight && retry.hidden) void load();
    }, 60000);
  }
  disconnectedCallback() { clearInterval(this.timer); }
}
if (!customElements.get("month-calendar")) customElements.define("month-calendar", MonthCalendar);
