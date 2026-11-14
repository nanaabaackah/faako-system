import { useEffect, useMemo, useRef, useState } from "react";
import { createBrowserApiClient } from "@faako/api-client/browser";
import { Button, TextField, TextareaField, SelectField, IconsaxIcon, AnimatedLoadingState, InlineNotice } from "@faako/ui";
import { enquiryTypes } from "../../../travel-with-ease-api/src/content/catalogue-constants.js";
import TurnstileChallenge from "./TurnstileChallenge.jsx";
import "../styles/components/enquiry-form.css";

const initial = {
  enquiryType: "trip", service: "not_sure", destination: "", travelTimeframe: "",
  travellers: "2", budget: "", name: "", email: "", phone: "", notes: "",
  consent: false, website: "",
};

function resolveEntry(catalogue) {
  const params = new URLSearchParams(window.location.search);
  const packageSlug = params.get("package");
  const serviceSlug = params.get("service");
  if (packageSlug) {
    const item = catalogue.packages.find((candidate) => candidate.slug === packageSlug && candidate.available);
    return item
      ? { entryType: "package", context: { packageId: item.id, packageTitle: item.title }, preset: { destination: item.title }, warning: "" }
      : { entryType: "general", context: {}, preset: {}, warning: "That package is unavailable, so we opened a general enquiry instead." };
  }
  if (serviceSlug) {
    const item = catalogue.services.find((candidate) => candidate.slug === serviceSlug);
    return item
      ? { entryType: "service", context: { serviceId: item.id, serviceTitle: item.title }, preset: { service: item.id }, warning: "" }
      : { entryType: "general", context: {}, preset: {}, warning: "That service link is unavailable, so we opened a general enquiry instead." };
  }
  return { entryType: "general", context: {}, preset: {}, warning: "" };
}

export default function EnquiryForm({ catalogue = { services: [], packages: [] } }) {
  const api = useMemo(() => createBrowserApiClient({
    baseUrl: import.meta.env.DEV ? "" : import.meta.env.PUBLIC_API_BASE_URL || "", credentials: "omit",
  }), []);
  const [form, setForm] = useState(initial);
  const [entry, setEntry] = useState({ entryType: "general", context: {}, warning: "", preset: {} });
  const [ready, setReady] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState("");
  const [resetCount, setResetCount] = useState(0);
  const hosted = !import.meta.env.DEV && ["staging", "production"].includes(import.meta.env.PUBLIC_APP_ENV);
  const siteKey = import.meta.env.DEV ? "" : import.meta.env.PUBLIC_TURNSTILE_SITE_KEY || "";
  const [status, setStatus] = useState({ state: "idle", message: "" });
  const operation = useRef(null);
  const pending = useRef(false);

  useEffect(() => {
    const resolved = resolveEntry(catalogue);
    setEntry(resolved);
    setForm((current) => ({ ...current, ...resolved.preset }));
    setReady(true);
  }, [catalogue]);

  const update = (event) => {
    const { name, type, checked, value } = event.target;
    setForm((current) => ({ ...current, [name]: type === "checkbox" ? checked : value }));
  };

  async function submit(event) {
    event.preventDefault();
    if (pending.current || (hosted && !turnstileToken)) return;
    const body = { ...form, travellers: Number(form.travellers), entryType: entry.entryType, context: entry.context, sourcePath: window.location.pathname };
    const fingerprint = JSON.stringify(body);
    if (!operation.current || operation.current.fingerprint !== fingerprint) operation.current = { fingerprint, id: crypto.randomUUID() };
    pending.current = true;
    setStatus({ state: "sending", message: "Sending your enquiry…" });
    try {
      const data = await api.post("/api/public/enquiries", {
        json: { ...body, submissionId: operation.current.id, turnstileToken }, responseMode: "data",
        fallbackMessage: "We could not confirm your enquiry. Your details remain here so you can try again.",
      });
      if (data?.status !== "received" || !/^[a-f0-9-]{36}$/i.test(data.inquiryId || "")) throw new Error("The service did not confirm your enquiry. Please try again.");
      setStatus({ state: "success", message: `Your enquiry is received. Reference: ${data.inquiryId.slice(0, 8).toUpperCase()}. Check your email for a private, optional link to add your full trip details. This is not a booking.` });
      setForm({ ...initial, ...entry.preset });
      operation.current = null;
    } catch (error) {
      setStatus({ state: "error", message: error.message || "We could not confirm your enquiry. Try again or contact us on WhatsApp." });
    } finally {
      pending.current = false;
      setTurnstileToken("");
      setResetCount((value) => value + 1);
    }
  }

  const disabled = status.state === "sending";
  return <form className="public-enquiry-form" onSubmit={submit} aria-busy={disabled}>
    {!ready && <AnimatedLoadingState compact title="Preparing the enquiry" message="Loading the form controls." />}
    {entry.warning && <InlineNotice tone="warning" title="Enquiry link updated" message={entry.warning} />}
    {(entry.context.packageTitle || entry.context.serviceTitle) && <p className="enquiry-context">Enquiring about <strong>{entry.context.packageTitle || entry.context.serviceTitle}</strong></p>}
    <fieldset disabled={!ready || disabled}>
      <legend>Tell us about your trip</legend>
      <div className="enquiry-fields-pair">
        <SelectField name="enquiryType" label="Enquiry type" value={form.enquiryType} onChangeValue={(value) => setForm((current) => ({ ...current, enquiryType: value }))} required>
          {enquiryTypes.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
        </SelectField>
        <SelectField name="service" label="Planning support" value={form.service} onChangeValue={(value) => setForm((current) => ({ ...current, service: value }))} required>
          <option value="not_sure">Help me choose</option><option value="readiness">Travel Readiness Session</option><option value="full_planning">Full Trip Planning</option><option value="premium">Premium Concierge</option><option value="group">Group Trip Planning</option>
        </SelectField>
      </div>
      <TextField name="destination" label="Where would you like to go?" value={form.destination} onChange={update} required minLength={2} maxLength={120} placeholder="A destination, a few ideas, or help me choose" />
      <div className="enquiry-fields-pair">
        <TextField name="travelTimeframe" label="When would you like to travel?" value={form.travelTimeframe} onChange={update} required minLength={2} maxLength={160} placeholder="Dates, a month, or still exploring" />
        <TextField name="travellers" label="Travellers" type="number" value={form.travellers} onChange={update} required min="1" max="100" step="1" />
      </div>
      <TextField name="budget" label="Approximate total budget (optional)" value={form.budget} onChange={update} maxLength={160} placeholder="Include the currency, or leave this blank" />
      <TextField name="name" label="Your name" autoComplete="name" value={form.name} onChange={update} required minLength={2} maxLength={160} />
      <div className="enquiry-fields-pair">
        <TextField name="email" label="Email" type="email" autoComplete="email" value={form.email} onChange={update} required maxLength={254} />
        <TextField name="phone" label="WhatsApp number" type="tel" autoComplete="tel" value={form.phone} onChange={update} required maxLength={40} placeholder="+233…" />
      </div>
      <TextareaField name="notes" label="Anything else? (optional)" value={form.notes} onChange={update} maxLength={1500} rows={3} hint="Do not include passport numbers, payment details or medical records." />
      <div className="enquiry-honeypot" aria-hidden="true"><label>Leave this blank<input name="website" value={form.website} onChange={update} tabIndex={-1} autoComplete="off" /></label></div>
      <p className="enquiry-privacy-note">We collect these contact details and travel preferences to respond to your enquiry and plan the service you request. This is not a booking or consent to marketing.</p>
      <label className="enquiry-consent"><input name="consent" type="checkbox" checked={form.consent} onChange={update} required /><span>I agree that Travel With Ease may use these details to respond to my enquiry.</span></label>
      {siteKey && <TurnstileChallenge siteKey={siteKey} resetCount={resetCount} onToken={setTurnstileToken} />}
      {hosted && !siteKey && <p>The form security check needs configuration. You can still enquire using WhatsApp below.</p>}
      {siteKey && <button type="button" className="enquiry-security-retry" onClick={() => setResetCount((value) => value + 1)}>Retry security check</button>}
      <Button type="submit" disabled={!ready || disabled || (hosted && !turnstileToken)}>{disabled ? "Sending enquiry…" : "Send enquiry"} <IconsaxIcon name="ArrowRight4" /></Button>
    </fieldset>
    {status.message && <p role={status.state === "error" ? "alert" : "status"} aria-live="polite">{status.message}</p>}
    <noscript>Please contact us on WhatsApp to enquire without JavaScript. Nothing has been submitted.</noscript>
    <a href="https://wa.me/233208387020" rel="noreferrer">Prefer WhatsApp? Talk to us directly.</a>
  </form>;
}
