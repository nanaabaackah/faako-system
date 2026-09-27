import { useMemo, useState } from "react";
import { createBrowserApiClient } from "@faako/api-client/browser";

const api = createBrowserApiClient({ baseUrl: import.meta.env.PUBLIC_API_BASE_URL || "" });
const initial = { destination: "Istanbul, Türkiye", travellers: 2, nights: 7, travelDate: "2027-01-15", accommodation: "premium", tripStyle: "balanced", activities: "some", flightPreference: "economy" };
const format = (minor) => `GHS ${new Intl.NumberFormat("en-GH", { maximumFractionDigits: 0 }).format(BigInt(minor) / 100n)}`;

export default function Estimator() {
  const [trip, setTrip] = useState(initial);
  const [estimate, setEstimate] = useState(null);
  const [contact, setContact] = useState({ name: "", email: "", phone: "+233 ", notes: "", consent: false, website: "" });
  const [status, setStatus] = useState({ state: "idle", message: "" });
  const updateTrip = (event) => setTrip((value) => ({ ...value, [event.target.name]: event.target.type === "number" ? Number(event.target.value) : event.target.value }));
  const updateContact = (event) => setContact((value) => ({ ...value, [event.target.name]: event.target.type === "checkbox" ? event.target.checked : event.target.value }));
  const range = useMemo(() => estimate ? `${format(estimate.lowMinor)} – ${format(estimate.highMinor).replace("GHS ", "")}` : "Choose your trip details", [estimate]);

  const calculate = async () => {
    setStatus({ state: "loading", message: "Calculating with the latest available rate…" });
    try {
      const data = await api.post("/api/public/estimate", { json: trip, fallbackMessage: "We could not calculate an estimate." });
      setEstimate(data);
      setStatus({ state: "ready", message: data.stale ? "Using the most recent cached rate." : `Rate updated ${new Date(data.rateTimestamp).toLocaleString("en-GH")}.` });
    } catch (error) { setStatus({ state: "error", message: error.message }); }
  };

  const submit = async (event) => {
    event.preventDefault();
    setStatus({ state: "loading", message: "Sending your trip plan…" });
    try {
      const data = await api.post("/api/public/inquiries", { json: { ...trip, ...contact, estimateLowMinor: estimate?.lowMinor, estimateHighMinor: estimate?.highMinor }, fallbackMessage: "We could not send your inquiry." });
      setStatus({ state: "success", message: `Your plan is in. Reference ${data.inquiryId.slice(0, 8).toUpperCase()}. We’ll be in touch.` });
    } catch (error) { setStatus({ state: "error", message: error.message }); }
  };

  return <div className="estimator-grid">
    <div className="estimator-controls">
      <label>Where would you like to go?<input name="destination" value={trip.destination} onChange={updateTrip} required /></label>
      <div className="field-pair"><label>Travellers<input name="travellers" type="number" min="1" max="30" value={trip.travellers} onChange={updateTrip} /></label><label>Nights<input name="nights" type="number" min="1" max="60" value={trip.nights} onChange={updateTrip} /></label></div>
      <label>When are you thinking?<input name="travelDate" type="date" value={trip.travelDate} onChange={updateTrip} /></label>
      <div className="field-pair"><label>Stay<select name="accommodation" value={trip.accommodation} onChange={updateTrip}><option value="comfortable">Comfortable</option><option value="premium">Premium</option><option value="luxury">Luxury</option></select></label><label>Travel pace<select name="tripStyle" value={trip.tripStyle} onChange={updateTrip}><option value="relaxed">Relaxed</option><option value="balanced">Balanced</option><option value="immersive">Immersive</option></select></label></div>
      <div className="field-pair"><label>Activities<select name="activities" value={trip.activities} onChange={updateTrip}><option value="few">A few highlights</option><option value="some">A considered mix</option><option value="many">Fill the days</option></select></label><label>Flights<select name="flightPreference" value={trip.flightPreference} onChange={updateTrip}><option value="economy">Economy</option><option value="premium_economy">Premium economy</option><option value="business">Business</option></select></label></div>
      <button type="button" onClick={calculate} disabled={status.state === "loading"}>See my estimate</button>
    </div>
    <aside className="estimate-card" aria-live="polite"><span>Estimated trip cost</span><strong>{range}</strong><p>{estimate?.disclaimer || "A thoughtful starting point, calculated in Ghana cedis."}</p>{status.message && <p className={`status ${status.state}`}>{status.message}</p>}</aside>
    {estimate && <form className="contact-form" onSubmit={submit}>
      <div><span className="eyebrow">Plan this trip</span><h3>Tell us where to reach you.</h3></div>
      <label>Full name<input name="name" value={contact.name} onChange={updateContact} autoComplete="name" required /></label>
      <div className="field-pair"><label>Email<input name="email" type="email" value={contact.email} onChange={updateContact} autoComplete="email" required /></label><label>WhatsApp / phone<input name="phone" value={contact.phone} onChange={updateContact} autoComplete="tel" required /></label></div>
      <label>Anything we should know?<textarea name="notes" value={contact.notes} onChange={updateContact} rows="3" /></label>
      <label className="honeypot" aria-hidden="true">Website<input name="website" value={contact.website} onChange={updateContact} tabIndex="-1" autoComplete="off" /></label>
      <label className="consent"><input name="consent" type="checkbox" checked={contact.consent} onChange={updateContact} required /> I agree that Travel With Ease may use these details to respond to my trip inquiry.</label>
      <button type="submit" disabled={status.state === "loading"}>Send my trip plan</button>
    </form>}
  </div>;
}
