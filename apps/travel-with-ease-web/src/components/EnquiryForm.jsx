import { useEffect, useMemo, useRef, useState } from "react";
import { createBrowserApiClient } from "@faako/api-client/browser";
import { Button, TextField, TextareaField, SelectField, IconsaxIcon, AnimatedLoadingState, InlineNotice, ERPModal } from "@faako/ui";
import { defaultIntakeDefinition, intakeDefinitionSchema, INTAKE_FORM_ID, INTAKE_BASELINE_VERSION, INTAKE_CORE_FIELDS } from "../../../travel-with-ease-api/src/enquiries/intake-definition.js";
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
  function coreControl(field) {
    const { id, label, placeholder, options } = field;
    const original = INTAKE_CORE_FIELDS.find(item => item.id === id);
    if (id === "budget" && entry.entryType === "package") return null;
    if (options) return <SelectField key={id} name={id} label={label} value={form[id]} onChangeValue={value => setForm(current => ({ ...current, [id]: value }))} required>
      {options.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
    </SelectField>;
    const constraints = { destination: { minLength: 2, maxLength: 120 }, travelTimeframe: { minLength: 2, maxLength: 160 }, travellers: { min: "1", max: "100", step: "1" }, budget: { maxLength: 160 }, name: { minLength: 2, maxLength: 160, autoComplete: "name" }, email: { maxLength: 254, autoComplete: "email" }, phone: { maxLength: 40, autoComplete: "tel" } }[id] || {};
    return <TextField key={id} name={id} label={label} type={original.type} value={form[id]} onChange={update} required={original.required} placeholder={placeholder} {...constraints}/>;
  }
  function additionalControl(field) {
    const value = additionalAnswers[field.id] ?? (field.type === "multiselect" ? [] : "");
    const props = { label: field.label, name: field.id, value, required: field.required };
    return <div className="question-field" key={field.id}>
      {field.type === "multiselect" ? <fieldset><legend>{field.label}{field.required ? " (required)" : ""}</legend><div className="question-options">
        {field.options.map(option => <label key={option.value}><input type="checkbox" checked={value.includes(option.value)} onChange={event => setAnswer(field.id, event.target.checked ? [...value, option.value] : value.filter(item => item !== option.value))}/>{option.label}</label>)}
      </div></fieldset> : field.type === "select" ? <SelectField {...props} onChangeValue={next => setAnswer(field.id, next)}>
        <option value="">Choose an option</option>{field.options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
      </SelectField> : field.type === "textarea" ? <TextareaField {...props} maxLength={1500} onChange={event => setAnswer(field.id, event.target.value)}/> :
      <TextField {...props} type={field.type} {...(field.type === "number" ? { min: -1000000000, max: 1000000000, step: "0.0001" } : field.type === "text" ? { maxLength: 240 } : {})} onChange={event => setAnswer(field.id, event.target.value)}/>}
      {field.description && <p className="question-hint">{field.description}</p>}
    </div>;
  }
  const coreRows = [];
  // Preserve the established two-column arrangement when the original paired
  // questions remain adjacent, without overriding CMS field order.
  const paired = { enquiryType: "service", travelTimeframe: "travellers", email: "phone" };
  for (let index = 0; index < definition.core.length; index++) {
    const field = definition.core[index];
    const next = definition.core[index + 1];
    if (next && paired[field.id] === next.id) {
      coreRows.push(<div key={field.id} className="enquiry-fields-pair">{coreControl(field)}{coreControl(next)}</div>);
      index++;
    } else coreRows.push(coreControl(field));
  }
  return <form className="public-enquiry-form" onSubmit={submit} aria-busy={disabled}>
    {(!ready || !configuration) && !configError && <AnimatedLoadingState compact title="Preparing the enquiry" message="Loading the form controls." />}
    {configError && <><InlineNotice tone="warning" title="Enquiries unavailable" message={configError}/><Button type="button" onClick={() => setRetryConfig(value => value + 1)}>Retry</Button></>}
    {entry.warning && <InlineNotice tone="warning" title="Enquiry link updated" message={entry.warning} />}
    {(entry.context.packageTitle || entry.context.serviceTitle) && <p className="enquiry-context">Enquiring about <strong>{entry.context.packageTitle || entry.context.serviceTitle}</strong></p>}
    <fieldset disabled={!ready || !configuration || disabled}>
      <legend>{definition.title}</legend>
      {coreRows}
      {definition.additional.filter(field => field.entries.includes(entry.entryType)).map(additionalControl)}
      <div className="enquiry-honeypot" aria-hidden="true"><label>Leave this blank<input name="website" value={form.website} onChange={update} tabIndex={-1} autoComplete="off" /></label></div>
      <p className="enquiry-privacy-note">We only use your details to respond. <a href="/privacy">Privacy notice</a></p>
      <label className="enquiry-consent"><input name="consent" type="checkbox" checked={form.consent} onChange={update} required /><span>I agree that Travel With Ease may use these details to respond to my enquiry.</span></label>
      {siteKey && <TurnstileChallenge siteKey={siteKey} resetCount={resetCount} onToken={setTurnstileToken} />}
      {hosted && !siteKey && <p>Online enquiries are temporarily unavailable. Contact us on WhatsApp.</p>}
      {siteKey && <button type="button" className="enquiry-security-retry" onClick={() => setResetCount((value) => value + 1)}>Retry security check</button>}
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
