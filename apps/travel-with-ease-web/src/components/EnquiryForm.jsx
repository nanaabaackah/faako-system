import { useEffect, useMemo, useRef, useState } from "react";
import { createBrowserApiClient } from "@faako/api-client/browser";
import { Button, IconsaxIcon, AnimatedLoadingState, InlineNotice, ERPModal } from "@faako/ui";
import { defaultIntakeDefinition, intakeDefinitionSchema, INTAKE_FORM_ID, INTAKE_BASELINE_VERSION } from "../../../travel-with-ease-api/src/enquiries/intake-definition.js";
import IntakeQuestionFields from "./IntakeQuestionFields.jsx";
import TurnstileChallenge from "./TurnstileChallenge.jsx";
import "../styles/components/enquiry-form.css";

const initial = {
  enquiryType: "trip", service: "not_sure", destination: "", travelTimeframe: "",
  travellers: "2", budget: "", name: "", email: "", phone: "",
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

export default function EnquiryForm({ catalogue = { services: [], packages: [] }, copy = {} }) {
  const api = useMemo(() => createBrowserApiClient({
    baseUrl: import.meta.env.DEV ? "" : import.meta.env.PUBLIC_API_BASE_URL || "", credentials: "omit",
  }), []);
  const [form, setForm] = useState(initial);
  const [entry, setEntry] = useState({ entryType: "general", context: {}, warning: "", preset: {} });
  const [ready, setReady] = useState(false);
  const [configuration, setConfiguration] = useState(null);
  const [configError, setConfigError] = useState("");
  const [retryConfig, setRetryConfig] = useState(0);
  const [additionalAnswers, setAdditionalAnswers] = useState({});
  const [turnstileToken, setTurnstileToken] = useState("");
  const [resetCount, setResetCount] = useState(0);
  const hosted = !import.meta.env.DEV && ["staging", "production"].includes(import.meta.env.PUBLIC_APP_ENV);
  const siteKey = import.meta.env.DEV ? "" : import.meta.env.PUBLIC_TURNSTILE_SITE_KEY || "";
  const [status, setStatus] = useState({ state: "idle", message: "" });
  const [confirmation, setConfirmation] = useState(null);
  const operation = useRef(null);
  const pending = useRef(false);

  useEffect(() => {
    const resolved = resolveEntry(catalogue);
    setEntry(resolved);
    setForm((current) => ({ ...current, ...resolved.preset }));
    setReady(true);
  }, [catalogue]);

  useEffect(() => {
    let current = true;
    setConfigError("");
    if (!hosted) {
      setConfiguration({ version: INTAKE_BASELINE_VERSION, definition: defaultIntakeDefinition() });
      return;
    }
    api.get("/api/public/enquiry-forms/intake", { responseMode: "data" }).then(result => {
      if (result.formId !== INTAKE_FORM_ID || !Number.isInteger(result.version) || result.version < 1) throw new Error("Invalid form version.");
      const definition = intakeDefinitionSchema.parse(result.definition);
      if (current) setConfiguration({ version: result.version, definition });
    }).catch(() => { if (current) setConfigError("The enquiry form is temporarily unavailable."); });
    return () => { current = false; };
  }, [api, hosted, retryConfig]);

  const update = (event) => {
    const { name, type, checked, value } = event.target;
    setForm((current) => ({ ...current, [name]: type === "checkbox" ? checked : value }));
  };

  async function submit(event) {
    event.preventDefault();
    if (!ready || !configuration || pending.current || (hosted && !turnstileToken)) return;
    const applicable = configuration.definition.additional.filter(field => field.entries.includes(entry.entryType));
    if (applicable.some(field => field.required && (!additionalAnswers[field.id] || additionalAnswers[field.id]?.length === 0))) { setStatus({ state: "error", message: "Please answer all required questions." }); return; }
    const body = { ...form, budget: entry.entryType === "package" ? "" : form.budget, travellers: Number(form.travellers), entryType: entry.entryType, context: entry.context, sourcePath: window.location.pathname, intakeVersion: configuration.version, additionalAnswers: Object.fromEntries(applicable.filter(field => additionalAnswers[field.id] !== undefined).map(field => [field.id, additionalAnswers[field.id]])) };
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
      const reference = data.inquiryId.slice(0, 8).toUpperCase();
      setStatus({ state: "success", message: "Enquiry received." });
      setConfirmation({ reference });
      setForm({ ...initial, ...entry.preset });
      setAdditionalAnswers({});
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
  const definition = configuration?.definition || defaultIntakeDefinition();
  const setAnswer = (id, value) => setAdditionalAnswers(current => ({ ...current, [id]: value }));
  return <form className="public-enquiry-form" onSubmit={submit} aria-busy={disabled}>
    {(!ready || !configuration) && !configError && <AnimatedLoadingState compact title="Preparing the enquiry" message="Loading the form controls." />}
    {configError && <><InlineNotice tone="warning" title="Enquiries unavailable" message={configError}/><Button type="button" onClick={() => setRetryConfig(value => value + 1)}>Retry</Button></>}
    {entry.warning && <InlineNotice tone="warning" title="Enquiry link updated" message={entry.warning} />}
    {(entry.context.packageTitle || entry.context.serviceTitle) && <p className="enquiry-context">Enquiring about <strong>{entry.context.packageTitle || entry.context.serviceTitle}</strong></p>}
    <fieldset disabled={!ready || !configuration || disabled}>
      <legend>{definition.title}</legend>
      <IntakeQuestionFields definition={definition} entryType={entry.entryType} form={form} setForm={setForm} update={update} additionalAnswers={additionalAnswers} setAnswer={setAnswer}/>
      <div className="enquiry-honeypot" aria-hidden="true"><label>Leave this blank<input name="website" value={form.website} onChange={update} tabIndex={-1} autoComplete="off" /></label></div>
      <label className="enquiry-consent"><input name="consent" type="checkbox" checked={form.consent} onChange={update} required /><span>I agree that Travel With Ease may use these details to respond to my enquiry. <a href="/privacy">Privacy notice</a></span></label>
      {siteKey && <TurnstileChallenge siteKey={siteKey} resetCount={resetCount} onToken={setTurnstileToken} />}
      {hosted && !siteKey && <p>Online enquiries are temporarily unavailable. Contact us on WhatsApp.</p>}
      {siteKey && <Button type="button" variant="ghost" className="enquiry-security-retry" onClick={() => setResetCount((value) => value + 1)}>Retry security check</Button>}
      <Button type="submit" aria-busy={disabled} disabled={!ready || !configuration || disabled || (hosted && !turnstileToken)}>{disabled ? "Sending enquiry…" : (copy.submitLabel || "Send enquiry")} <IconsaxIcon name="ArrowRight4" /></Button>
    </fieldset>
    {status.message && <p role={status.state === "error" ? "alert" : "status"} aria-live="polite">{status.message}</p>}
    <noscript>Please contact us on WhatsApp to enquire without JavaScript. Nothing has been submitted.</noscript>
    <a href={copy.whatsappUrl || "https://wa.me/233208387020"} rel="noreferrer">{copy.whatsappLabel || "Prefer WhatsApp? Talk to us directly."}</a>
    <ERPModal open={Boolean(confirmation)} title="Enquiry received" description={`Reference ${confirmation?.reference || ""}`} onClose={() => setConfirmation(null)} size="sm" footer={<Button type="button" onClick={() => setConfirmation(null)}>Close</Button>}>
      <p>Check your email for a private, optional link to add your full trip details. This is not a booking.</p>
    </ERPModal>
  </form>;
}
