import React, { useState } from "react";
import { apiPost } from "../../api/client";

const PROVIDERS = [
  { value: "GOOGLE_MEET", label: "Google Meet" },
  { value: "ZOOM", label: "Zoom" },
  { value: "WHATSAPP", label: "WhatsApp call" },
  { value: "FACETIME", label: "FaceTime" },
];
const inputTime = (date) => {
  const adjusted = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return adjusted.toISOString().slice(0, 16);
};
const defaults = () => {
  const start = new Date();
  start.setDate(start.getDate() + 1);
  start.setHours(9, 0, 0, 0);
  if (start.getDay() === 6) start.setDate(start.getDate() + 2);
  if (start.getDay() === 0) start.setDate(start.getDate() + 1);
  const end = new Date(start.getTime() + 60 * 60 * 1000);
  return {
    title: "Consultation",
    attendeeName: "",
    attendeeEmail: "",
    startAt: inputTime(start),
    endAt: inputTime(end),
    meetingPlatform: "GOOGLE_MEET",
    description: "",
  };
};
const NewAppointmentDrawer = ({ onClose, onCreated }) => {
  const [form, setForm] = useState(defaults);
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);
  const update = (field) => (event) =>
    setForm((current) => ({ ...current, [field]: event.target.value }));

  const submit = async (event) => {
    event.preventDefault();
    const start = new Date(form.startAt);
    const end = new Date(form.endAt);
    if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end <= start) {
      setStatus("End time must be later than start time.");
      return;
    }
    setSaving(true);
    setStatus("");
    try {
      const created = await apiPost("/api/bookings", {
        attendeeName: form.attendeeName.trim(),
        attendeeEmail: form.attendeeEmail.trim(),
        title: form.title.trim(),
        description: form.description.trim(),
        startAt: start.toISOString(),
        endAt: end.toISOString(),
        meetingPlatform: form.meetingPlatform,
        status: "CONFIRMED",
      }, { fallbackMessage: "Unable to create appointment." });
      onCreated(created);
    } catch (error) {
      setStatus(error.message || "Unable to create appointment.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bookings-drawer-backdrop">
      <aside className="bookings-drawer" role="dialog" aria-modal="true" aria-labelledby="new-appointment-heading">
        <header className="bookings-drawer__header">
          <div>
            
            <h2 id="new-appointment-heading">New appointment</h2>
          </div>
          <button className="button button-ghost" type="button" onClick={onClose}>Close</button>
        </header>
        <form className="bookings-drawer__content" onSubmit={submit}>
          <label className="form-field">
            <span>Client name</span>
            <input className="input" required maxLength={200} value={form.attendeeName} onChange={update("attendeeName")}/>
          </label>
          <label className="form-field">
            <span>Client email</span>
            <input className="input" required type="email" maxLength={254} value={form.attendeeEmail} onChange={update("attendeeEmail")}/>
          </label>
          <label className="form-field">
            <span>Appointment title</span>
            <input className="input" required maxLength={300} value={form.title} onChange={update("title")}/>
          </label>
          <label className="form-field">
            <span>Start date and time</span>
            <input className="input" required type="datetime-local" value={form.startAt} onChange={update("startAt")}/>
          </label>
          <label className="form-field">
            <span>End date and time</span>
            <input className="input" required type="datetime-local" value={form.endAt} onChange={update("endAt")}/>
          </label>
          <label className="form-field">
            <span>Preferred meeting platform</span>
            <select className="input" value={form.meetingPlatform} onChange={update("meetingPlatform")}>
              {PROVIDERS.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}
            </select>
          </label>
          <label className="form-field">
            <span>Notes (optional)</span>
            <textarea className="input" maxLength={2000} value={form.description} onChange={update("description")}/>
          </label>
          <p className="muted">Times use your device timezone.</p>
          {status && <div className="notice is-error" role="alert">{status}</div>}
          <button className="button button-primary" type="submit" disabled={saving}>
            {saving ? "Creating..." : "Create appointment"}
          </button>
        </form>
      </aside>
    </div>
  );
};

export default NewAppointmentDrawer;
