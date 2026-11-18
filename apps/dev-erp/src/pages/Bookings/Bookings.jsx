import React, { useEffect, useMemo, useState } from "react";
import { AnimatedLoadingState } from "@faako/ui";
import { apiGet, apiPatch, apiPost } from "../../api/client";
import { formatDateTime } from "../../utils/formatters";
import { getHolidayLabelsForDate, listUpcomingHolidays } from "../../utils/holidays";
import { getSafeExternalUrl } from "../../utils/safeUrl";
import "./Bookings.css";
import NewAppointmentDrawer from "./NewAppointmentDrawer";

const PROVIDERS = [
  { value: "GOOGLE_MEET", label: "Google Meet" },
  { value: "ZOOM", label: "Zoom" },
  { value: "WHATSAPP", label: "WhatsApp call" },
  { value: "FACETIME", label: "FaceTime" },
];
const STATUS_MAP = {
  CONFIRMED: { label: "Confirmed", tone: "success" },
  TENTATIVE: { label: "Tentative", tone: "warning" },
  CANCELED: { label: "Canceled", tone: "danger" },
};
const startOfDay = (day) => {
  const value = new Date(day);
  value.setHours(0, 0, 0, 0);
  return value;
};
const sameDay = (a, b) => startOfDay(a).getTime() === startOfDay(b).getTime();
const durationOf = ({ startAt, endAt }) => {
  const minutes = Math.round((new Date(endAt) - new Date(startAt)) / 60000);
  return minutes > 0 ? `${minutes} min` : "N/A";
};
const nextWeek = () => Array.from({ length: 7 }, (_, index) => {
  const date = startOfDay(new Date());
  date.setDate(date.getDate() + index);
  return date;
});
const linkStateLabel = (booking) => {
  if (!booking?.meetingLink) return "Awaiting link";
  if (booking.meetingLinkDeliveryStatus === "SENT") return "Sent";
  if (booking.meetingLinkDeliveryStatus === "FAILED") return "Delivery failed";
  if (booking.meetingLinkDeliveryStatus === "TEST_REROUTED") return "Test email rerouted";
  return "Ready to send";
};

const Bookings = () => {
  const [bookings, setBookings] = useState([]);
  const [organizationSlug, setOrganizationSlug] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [status, setStatus] = useState({ tone: "", message: "" });
  const [selectedDay, setSelectedDay] = useState(null);
  const [selectedBookingId, setSelectedBookingId] = useState(null);
  const [draft, setDraft] = useState({ meetingPlatform: "GOOGLE_MEET", meetingLink: "" });
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");
  const [copyLabel, setCopyLabel] = useState("Copy booking link");
  const [creating, setCreating] = useState(false);
  const days = useMemo(nextWeek, []);
  const holidayBlocks = useMemo(() => listUpcomingHolidays({ startDate: new Date(), days: 45 }), []);
  const selectedBooking = bookings.find((item) => item.id === selectedBookingId) || null;

  const load = async () => {
    setIsLoading(true);
    try {
      const [items, settings] = await Promise.all([
        apiGet("/api/bookings", { fallbackMessage: "Unable to load appointments." }),
        apiGet("/api/bookings/settings", { fallbackMessage: "Unable to load booking settings." }),
      ]);
      setBookings(Array.isArray(items) ? items : []);
      setOrganizationSlug(settings?.organizationSlug || "");
    } catch (error) {
      setStatus({ tone: "error", message: error.message });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const bookingUrl = organizationSlug
    ? `${window.location.origin}/book/${encodeURIComponent(organizationSlug)}`
    : "";

  const upcoming = useMemo(() => bookings.filter((item) =>
    item.status !== "CANCELED" && new Date(item.endAt || item.startAt) >= new Date()
  ).sort((a, b) => new Date(a.startAt) - new Date(b.startAt)), [bookings]);
  const filtered = upcoming.filter((item) => {
    if (selectedDay && !sameDay(new Date(item.startAt), selectedDay)) return false;
    const haystack = [item.title, item.attendeeEmail, item.attendeeName, item.meetingPlatform].join(" ").toLowerCase();
    return haystack.includes(search.trim().toLowerCase());
  });

  const openBooking = (booking) => {
    setSelectedBookingId(booking.id);
    setDraft({
      meetingPlatform: booking.meetingPlatform || "GOOGLE_MEET",
      meetingLink: booking.meetingLink || "",
    });
    setStatus({ tone: "", message: "" });
  };
  const updateBookingInState = (nextBooking) => setBookings((items) =>
    items.map((item) => item.id === nextBooking.id ? nextBooking : item)
  );
  const saveLink = async () => {
    if (!selectedBooking) return;
    setBusy(true);
    setStatus({ tone: "", message: "" });
    try {
      const updated = await apiPatch(`/api/bookings/${selectedBooking.id}`, draft, {
        fallbackMessage: "Could not save meeting details.",
      });
      updateBookingInState(updated);
      setStatus({ tone: "success", message: "Meeting details saved. You can now send the link." });
    } catch (error) {
      setStatus({ tone: "error", message: error.message });
    } finally { setBusy(false); }
  };
  const sendLink = async () => {
    if (!selectedBooking) return;
    setBusy(true);
    setStatus({ tone: "", message: "" });
    try {
      const updated = await apiPost(`/api/bookings/${selectedBooking.id}/send-link`, {
        resend: selectedBooking.meetingLinkDeliveryStatus === "SENT",
      }, { fallbackMessage: "Could not send the meeting link." });
      updateBookingInState(updated);
      setStatus(updated.deliveryWasRerouted
        ? { tone: "warning", message: "Test email was rerouted. The client has not received the link." }
        : { tone: "success", message: "Meeting link was submitted for email delivery to the attendee." });
    } catch (error) {
      setStatus({ tone: "error", message: error.message });
    } finally { setBusy(false); }
  };
  const hasUnsavedMeetingChanges = Boolean(selectedBooking) && (
    draft.meetingPlatform !== (selectedBooking.meetingPlatform || "GOOGLE_MEET")
    || draft.meetingLink.trim() !== (selectedBooking.meetingLink || "").trim()
  );
  const copyBookingLink = async () => {
    if (!bookingUrl) return;
    try {
      await navigator.clipboard.writeText(bookingUrl);
      setCopyLabel("Copied");
    } catch { setCopyLabel("Copy failed"); }
  };

  const totals = {
    sevenDays: upcoming.filter((item) => item.startAt && new Date(item.startAt) <= new Date(Date.now() + 7 * 86400000)).length,
    confirmed: bookings.filter((item) => item.status === "CONFIRMED").length,
    tentative: bookings.filter((item) => item.status === "TENTATIVE").length,
    waiting: upcoming.filter((item) => !item.meetingLink).length,
  };

  return (
    <section className="page bookings-page">
      <header className="page-header">
        <div>
                    <h1>Appointments</h1>
          
        </div>
        <div className="header-actions">
          <button type="button" className="button button-primary" onClick={() => setCreating(true)}>+ New appointment</button>
          {bookingUrl ? (
            <>
              <a className="button button-primary" href={bookingUrl} target="_blank" rel="noopener noreferrer">Open booking page</a>
              <button className="button button-ghost" type="button" onClick={copyBookingLink}>{copyLabel}</button>
            </>
          ) : <span className="muted">Booking URL unavailable: check the organization configuration.</span>}
        </div>
      </header>

      {status.message && <div className={`notice is-${status.tone || "info"}`} role="status">{status.message}</div>}

      <div id="bookings-summary" className="panel-grid bookings-summary-grid">
        {[
          ["Upcoming (7 days)", totals.sevenDays, "Scheduled sessions"],
          ["Confirmed", totals.confirmed, "Accepted bookings"],
          ["Tentative", totals.tentative, "Awaiting confirmation"],
          ["Meeting links pending", totals.waiting, "Action required"],
        ].map(([label, count, detail]) => (
          <article className="panel kpi-card" key={label}>
            <span className="kpi-label">{label}</span>
            <strong className="kpi-value">{count}</strong>
            <span className="kpi-delta">{detail}</span>
          </article>
        ))}
      </div>

      <article id="bookings-planner" className="panel bookings-planner">
        <div className="panel-header">
          <div>
            <h3>Appointment schedule</h3>
            
          </div>
          <button className="button button-ghost" type="button" onClick={() => setSelectedDay(null)}>Show all</button>
        </div>
        <div className="bookings-planner__days">
          {days.map((day) => {
            const count = upcoming.filter((item) => sameDay(new Date(item.startAt), day)).length;
            const active = selectedDay && sameDay(selectedDay, day);
            const holidayLabels = getHolidayLabelsForDate(day);
            return (
              <button
                className={`bookings-planner__day${active ? " is-active" : ""}`}
                key={day.toISOString()}
                onClick={() => setSelectedDay(day)}
                type="button"
                aria-pressed={Boolean(active)}
                title={holidayLabels.join(", ") || undefined}
              >
                <span>{day.toLocaleDateString(undefined, { weekday: "short" })}</span>
                <strong>{day.getDate()}</strong>
                <small>{holidayLabels.length ? "Holiday" : `${count} booked`}</small>
              </button>
            );
          })}
        </div>
      </article>

      <article id="bookings-records" className="panel bookings-records">
        <div className="panel-header">
          <div>
            <h3>{selectedDay ? "Selected day" : "Upcoming appointments"}</h3>
            
          </div>
          <input className="input bookings-search" type="search" value={search}
            aria-label="Search appointments" placeholder="Search appointments"
            onChange={(event) => setSearch(event.target.value)} />
        </div>
        {isLoading ? <AnimatedLoadingState compact title="Loading appointments" /> : filtered.length ? (
          <div className="data-table bookings-table">
            <div className="table-row table-head is-7">
              <span>Client</span><span>Service</span><span>When</span><span>Duration</span><span>Meeting</span><span>Status</span><span>Source</span>
            </div>
            {filtered.map((booking) => {
              const statusConfig = STATUS_MAP[booking.status] || STATUS_MAP.TENTATIVE;
              const safeLink = getSafeExternalUrl(booking.meetingLink);
              return (
                <div className="table-row is-7" key={booking.id}>
                  <span className="table-strong">
                    {booking.attendeeName || booking.attendeeEmail || "Client"}
                    <button className="bookings-records__open" type="button" onClick={() => openBooking(booking)}>Open details</button>
                  </span>
                  <span>{booking.title || "Appointment"}</span>
                  <span>{formatDateTime(booking.startAt)}</span>
                  <span>{durationOf(booking)}</span>
                  <span>{safeLink ? <a href={safeLink} target="_blank" rel="noopener noreferrer">Join</a> : linkStateLabel(booking)}</span>
                  <span className={`status-pill is-${statusConfig.tone}`}>{statusConfig.label}</span>
                  <span>{booking.source === "GOOGLE_CALENDAR" ? "Historical sync" : "Faako"}</span>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="muted">No appointments match this view.</p>
        )}
      </article>

      <article id="bookings-holidays" className="panel">
        <div className="panel-header"><div><h3>Holiday blocks</h3><p className="muted">Dates blocked for new appointments (Canada and Ghana).</p></div></div>
        <div className="bookings-holiday-list">
          {holidayBlocks.slice(0, 5).map((day) => (
            <div key={day.key} className="bookings-holiday-list__item">
              <strong>{day.dateLabel}</strong><span>{day.labels.join(" • ")}</span>
            </div>
          ))}
        </div>
      </article>

      {creating && <NewAppointmentDrawer onClose={() => setCreating(false)} onCreated={(booking) => {
        setBookings((all) => [...all, booking]);
        setCreating(false);
        setSelectedDay(null);
        openBooking(booking);
        setStatus({ tone: "success", message: "Appointment created. Attach its meeting link and send it to the client." });
      }} />}

      {selectedBooking && (
        <div className="bookings-drawer-backdrop">
          <aside className="bookings-drawer" role="dialog" aria-modal="true" aria-labelledby="booking-detail-title">
            <header className="bookings-drawer__header">
              <div><p className="eyebrow">Appointment details</p><h2 id="booking-detail-title">{selectedBooking.title || "Appointment"}</h2></div>
              <button type="button" className="button button-ghost" onClick={() => setSelectedBookingId(null)} aria-label="Close appointment details">Close</button>
            </header>
            <div className="bookings-drawer__content">
              <p className="muted">Client</p><strong>{selectedBooking.attendeeName || selectedBooking.attendeeEmail || "Client"}</strong>
              <p className="muted">{selectedBooking.attendeeEmail || "No email address"}</p>
              <p><strong>Time:</strong> {formatDateTime(selectedBooking.startAt)}</p>
              <p><strong>Status:</strong> {STATUS_MAP[selectedBooking.status]?.label || selectedBooking.status}</p>
              <p><strong>Meeting link:</strong> {linkStateLabel(selectedBooking)}</p>
              {selectedBooking.source === "GOOGLE_CALENDAR" ? (
                <div className="notice">Historical Google Calendar booking. Original record remains read-only.</div>
              ) : (
                <>
                  <label className="form-field"><span>Meeting platform</span>
                    <select className="input" value={draft.meetingPlatform} onChange={(event) => setDraft((previous) => ({ ...previous, meetingPlatform: event.target.value, meetingLink: "" }))}>
                      {PROVIDERS.map((provider) => <option value={provider.value} key={provider.value}>{provider.label}</option>)}
                    </select>
                  </label>
                  <label className="form-field"><span>Meeting link (HTTPS)</span>
                    <input className="input" type="url" maxLength={2000}
                      placeholder="Paste the provider's call link"
                      value={draft.meetingLink}
                      onChange={(event) => setDraft((previous) => ({ ...previous, meetingLink: event.target.value }))} />
                  </label>
                  
                  {hasUnsavedMeetingChanges ? <p className="notice is-warning">Save your edits before sending the joining link.</p> : null}
                  <div className="booking-actions">
                    <button className="button button-primary" type="button" onClick={saveLink} disabled={busy}>{busy ? "Saving..." : "Save meeting details"}</button>
                    <button className="button button-ghost" type="button" onClick={sendLink}
                      disabled={busy || hasUnsavedMeetingChanges || !selectedBooking.meetingLink || !selectedBooking.attendeeEmail || selectedBooking.status === "CANCELED"}>
                      {selectedBooking.meetingLinkDeliveryStatus === "SENT" ? "Resend email" : "Send meeting link"}
                    </button>
                  </div>
                </>
              )}
              {selectedBooking.meetingLinkSentAt && (
                <p className="muted">Last sent: {formatDateTime(selectedBooking.meetingLinkSentAt)}</p>
              )}
              {status.message && <div className={`notice is-${status.tone || "info"}`} role="status">{status.message}</div>}
            </div>
          </aside>
        </div>
      )}
    </section>
  );
};

export default Bookings;
