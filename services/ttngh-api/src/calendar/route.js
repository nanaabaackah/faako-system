import { rateLimit } from "express-rate-limit";
import { calendarRange, createCalendarService } from "./service.js";

export function mountCalendar(app, config, { request, fail, ok }) {
  const getEvents = createCalendarService(config.calendarId, { request });
  app.all("/api/calendar/events", (req, res, next) => {
    res.set("Access-Control-Allow-Methods", "GET,OPTIONS");
    if (req.headers.origin && !config.origins.includes(req.headers.origin)) return fail(req, res, 403, "This origin is not permitted.");
    if (req.method === "OPTIONS") return res.sendStatus(204);
    if (req.method !== "GET") { res.set("Allow", "GET,OPTIONS"); return fail(req, res, 405, "Use GET for calendar events."); }
    next();
  }, rateLimit({ windowMs: 60_000, limit: 60, standardHeaders: "draft-8", legacyHeaders: false, handler: (req, res) => fail(req, res, 429, "Please try the calendar again shortly.") }), async (req, res) => {
    try { calendarRange(req.query); } catch { return fail(req, res, 400, "Provide valid from and to dates, at most 62 days apart. The end date is exclusive."); }
    try { return ok(req, res, await getEvents(req.query)); }
    catch { req.log.warn({ event: "calendar_refresh_unavailable" }); return fail(req, res, 503, "We couldn't refresh the live calendar right now."); }
  });
}
