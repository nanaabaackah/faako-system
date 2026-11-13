import { useEffect, useMemo, useRef, useState } from "react";
import { createBrowserApiClient } from "@faako/api-client/browser";
// eslint-disable-next-line no-unused-vars -- JSX components
import { Button, IconsaxIcon, AnimatedLoadingState, InlineNotice } from "@faako/ui";
import {
  QUESTIONNAIRE_ID, QUESTIONNAIRE_VERSION, applicableQuestionIds,
  questionnaireRoute, questionnaireSteps, questions, selectedServiceFromAnswers,
} from "../../../travel-with-ease-api/src/enquiries/questionnaires/index.js";
// eslint-disable-next-line no-unused-vars -- JSX component
import TurnstileChallenge from "./TurnstileChallenge.jsx";
import "../styles/components/enquiry-form.css";

const contactIds = { name: "476632894", phone: "1078451195", email: "214964047" };
const empty = (value) => value === undefined || value === "" || (Array.isArray(value) && value.length === 0);

function resolveEntry(catalogue) {
  if (typeof window === "undefined") return { entryType: "general", context: {}, warning: "" };
  const params = new URLSearchParams(window.location.search);
  const serviceSlug = params.get("service");
  const packageSlug = params.get("package");
  if (packageSlug) {
    const item = catalogue.packages.find((candidate) => candidate.slug === packageSlug && candidate.available);
    return item
      ? { entryType: "package", context: { packageId: item.id, packageTitle: item.title }, warning: "" }
      : { entryType: "general", context: {}, warning: "That package is unavailable, so we opened a general enquiry instead." };
  }
  if (serviceSlug) {
    const item = catalogue.services.find((candidate) => candidate.slug === serviceSlug);
    return item
      ? { entryType: "service", context: { serviceId: item.id, serviceTitle: item.title }, warning: "" }
      : { entryType: "general", context: {}, warning: "That service link is unavailable, so we opened a general enquiry instead." };
  }
  return { entryType: "general", context: {}, warning: "" };
}

function questionError(question, value, answers) {
  const conditional = question.id === "1653151808" && selectedServiceFromAnswers(answers) === "not_sure";
  if ((question.required || conditional) && empty(value)) return "Answer this question to continue.";
  if (question.maxSelections && Array.isArray(value) && value.length > question.maxSelections) return `Choose no more than ${question.maxSelections}.`;
  return "";
}

// eslint-disable-next-line no-unused-vars -- JSX component
function Question({ question, value, onChange, error }) {
  const describedBy = `${question.id}-hint${error ? ` ${question.id}-error` : ""}`;
  if (question.type === "CHECKBOX") {
    const selected = Array.isArray(value) ? value : [];
    return <fieldset className="question-field" aria-describedby={describedBy}>
      <legend>{question.label}{question.required && <span aria-hidden="true"> *</span>}</legend>
      {question.description && <p id={`${question.id}-hint`} className="question-hint">{question.description}</p>}
      {question.maxSelections && <p className="question-hint">Choose up to {question.maxSelections}.</p>}
      <div className="question-options">{question.options.map((option) => <label key={option}>
        <input type="checkbox" checked={selected.includes(option)} onChange={(event) => onChange(event.target.checked ? [...selected, option] : selected.filter((item) => item !== option))} />
        <span>{option}</span>
      </label>)}</div>
      {error && <p id={`${question.id}-error`} className="question-error" role="alert">{error}</p>}
    </fieldset>;
  }
  if (question.type === "MULTIPLE_CHOICE") {
    return <fieldset className="question-field" aria-describedby={describedBy}>
      <legend>{question.label}{question.required && <span aria-hidden="true"> *</span>}</legend>
      {question.description && <p id={`${question.id}-hint`} className="question-hint">{question.description}</p>}
      <div className="question-options">{question.options.map((option) => <label key={option}>
        <input type="radio" name={`question-${question.id}`} value={option} checked={value === option} onChange={() => onChange(option)} />
        <span>{option}</span>
      </label>)}</div>
      {error && <p id={`${question.id}-error`} className="question-error" role="alert">{error}</p>}
    </fieldset>;
  }
  const multiline = question.type === "PARAGRAPH_TEXT";
  const type = question.inputMode === "email" ? "email" : question.inputMode === "tel" ? "tel" : question.id === "836507955" ? "number" : "text";
  const controlProps = {
    id: `question-${question.id}`, value: typeof value === "string" ? value : "",
    onChange: (event) => onChange(event.target.value), required: question.required,
    maxLength: multiline ? 1500 : 500, autoComplete: question.autoComplete,
    "aria-describedby": describedBy, "aria-invalid": Boolean(error),
    ...(type === "number" ? { min: 1, max: 100, step: 1 } : {}),
  };
  return <div className="question-field">
    <label htmlFor={controlProps.id}>{question.label}{question.required && <span aria-hidden="true"> *</span>}</label>
    {question.description && <p id={`${question.id}-hint`} className="question-hint preserve-lines">{question.description}</p>}
    {multiline ? <textarea {...controlProps} rows={4} /> : <input {...controlProps} type={type} />}
    {error && <p id={`${question.id}-error`} className="question-error" role="alert">{error}</p>}
  </div>;
}

export default function EnquiryForm({ catalogue = { services: [], packages: [] } }) {
  const api = useMemo(() => createBrowserApiClient({
    baseUrl: import.meta.env.DEV ? "" : import.meta.env.PUBLIC_API_BASE_URL || "", credentials: "omit",
  }), []);
  const [entry, setEntry] = useState({ entryType: "general", context: {}, warning: "" });
  const [answers, setAnswers] = useState({});
  const [stepIndex, setStepIndex] = useState(0);
  const [errors, setErrors] = useState({});
  const [ready, setReady] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState("");
  const [resetCount, setResetCount] = useState(0);
  const [consent, setConsent] = useState(false);
  const [website, setWebsite] = useState("");
  const hosted = !import.meta.env.DEV && ["staging", "production"].includes(import.meta.env.PUBLIC_APP_ENV);
  const siteKey = import.meta.env.DEV ? "" : import.meta.env.PUBLIC_TURNSTILE_SITE_KEY || "";
  const [status, setStatus] = useState({ state: "idle", message: "" });
  const operation = useRef(null);
  const pending = useRef(false);

  useEffect(() => {
    setEntry(resolveEntry(catalogue));
    setReady(true);
    const restoreStep = (event) => setStepIndex(Number.isInteger(event.state?.tweEnquiryStep) ? event.state.tweEnquiryStep : 0);
    window.addEventListener("popstate", restoreStep);
    return () => window.removeEventListener("popstate", restoreStep);
  }, [catalogue]);

  const applicable = useMemo(() => applicableQuestionIds(entry.context, answers), [entry, answers]);
  const route = questionnaireRoute(entry.context, answers);
  const steps = useMemo(() => questionnaireSteps
    .filter((step) => step.routes.includes("all") || step.routes.includes(route))
    .map((step) => ({ ...step, questionIds: step.questionIds.filter((id) => applicable.includes(id)) }))
    .filter((step) => step.questionIds.length), [applicable, route]);
  const safeIndex = Math.min(stepIndex, Math.max(steps.length - 1, 0));
  const currentStep = steps[safeIndex];

  useEffect(() => {
    setAnswers((current) => Object.fromEntries(Object.entries(current).filter(([id]) => applicable.includes(id))));
  }, [applicable.join("|")]); // eslint-disable-line react-hooks/exhaustive-deps

  function updateAnswer(id, value) {
    setAnswers((current) => ({ ...current, [id]: value }));
    setErrors((current) => ({ ...current, [id]: "" }));
  }

  function move(next) {
    if (next > safeIndex) {
      const found = Object.fromEntries(currentStep.questionIds.map((id) => [id, questionError(questions[id], answers[id], answers)]).filter(([, message]) => message));
      if (Object.keys(found).length) {
        setErrors(found);
        document.getElementById(`question-${Object.keys(found)[0]}`)?.focus();
        return;
      }
    }
    const target = Math.max(0, Math.min(next, steps.length - 1));
    window.history.pushState({ ...(window.history.state || {}), tweEnquiryStep: target }, "", window.location.href);
    setStepIndex(target);
    document.getElementById("enquiry-step-heading")?.focus();
  }

  async function submit(event) {
    event.preventDefault();
    const allErrors = Object.fromEntries(applicable.map((id) => [id, questionError(questions[id], answers[id], answers)]).filter(([, message]) => message));
    if (Object.keys(allErrors).length || !consent) {
      setErrors(allErrors);
      setStatus({ state: "error", message: !consent ? "Confirm the privacy acknowledgement before sending." : "Review the highlighted questions." });
      return;
    }
    if (pending.current || (hosted && !turnstileToken)) return;
    const body = {
      submissionId: crypto.randomUUID(), turnstileToken,
      questionnaireId: QUESTIONNAIRE_ID, questionnaireVersion: QUESTIONNAIRE_VERSION,
      entryType: entry.entryType, sourcePath: window.location.pathname,
      context: entry.entryType === "general" ? {} : entry.context,
      answers: Object.fromEntries(applicable.map((id) => [id, answers[id]]).filter(([, value]) => !empty(value))),
      contact: { name: answers[contactIds.name], phone: answers[contactIds.phone], email: answers[contactIds.email] },
      consent, website,
    };
    const fingerprint = JSON.stringify({ ...body, submissionId: "", turnstileToken: "" });
    if (!operation.current || operation.current.fingerprint !== fingerprint) operation.current = { fingerprint, id: body.submissionId };
    body.submissionId = operation.current.id;
    pending.current = true;
    setStatus({ state: "sending", message: "Sending your enquiry…" });
    try {
      const data = await api.post("/api/public/enquiries", {
        json: body, responseMode: "data",
        fallbackMessage: "We could not confirm your enquiry. Your details remain here so you can try again.",
      });
      if (data?.status !== "received" || !/^[a-f0-9-]{36}$/i.test(data.inquiryId || "")) throw new Error("The service did not confirm your enquiry. Please try again.");
      setStatus({ state: "success", message: `Your enquiry is received. Reference: ${data.inquiryId.slice(0, 8).toUpperCase()}. The team will be in touch; this is not a booking.` });
      setAnswers({}); setConsent(false); setStepIndex(0); operation.current = null;
    } catch (error) {
      setStatus({ state: "error", message: error.message || "We could not confirm your enquiry. Try again or contact us on WhatsApp." });
    } finally {
      pending.current = false; setTurnstileToken(""); setResetCount((value) => value + 1);
    }
  }

  if (!currentStep) return <AnimatedLoadingState compact title="Preparing the enquiry" message="Loading the form controls." />;
  const disabled = status.state === "sending";
  const contextLabel = entry.context.packageTitle || entry.context.serviceTitle;
  return <form className="public-enquiry-form smart-enquiry-form" onSubmit={submit} aria-busy={disabled}>
    {entry.warning && <InlineNotice tone="warning" title="Enquiry link updated" message={entry.warning} />}
    {contextLabel && <p className="enquiry-context">Enquiring about <strong>{contextLabel}</strong></p>}
    <div className="enquiry-progress" aria-label={`Step ${safeIndex + 1} of ${steps.length}`}><span>Step {safeIndex + 1} of {steps.length}</span><progress value={safeIndex + 1} max={steps.length} /></div>
    <fieldset disabled={!ready || disabled} className="enquiry-step">
      <legend id="enquiry-step-heading" tabIndex="-1">{currentStep.title}</legend>
      {currentStep.questionIds.map((id) => <Question key={id} question={questions[id]} value={answers[id]} onChange={(value) => updateAnswer(id, value)} error={errors[id]} />)}
      {safeIndex === steps.length - 1 && <>
        <div className="enquiry-honeypot" aria-hidden="true"><label>Leave this blank<input name="website" value={website} onChange={(event) => setWebsite(event.target.value)} tabIndex={-1} autoComplete="off" /></label></div>
        <p className="enquiry-privacy-note">We use these contact details and travel preferences only to respond to this enquiry and provide requested services. Do not include passport numbers, document scans, medical records, payment details or passwords.</p>
        <label className="enquiry-consent"><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} required /><span>I agree that Travel With Ease may use these details to respond to my enquiry.</span></label>
        {siteKey && <TurnstileChallenge siteKey={siteKey} resetCount={resetCount} onToken={setTurnstileToken} />}
        {hosted && !siteKey && <p>The form security check needs configuration. You can still enquire using WhatsApp below.</p>}
      </>}
    </fieldset>
    <div className="enquiry-actions">
      <Button type="button" disabled={disabled || safeIndex === 0} onClick={() => move(safeIndex - 1)}>Back</Button>
      {safeIndex < steps.length - 1
        ? <Button type="button" disabled={disabled} onClick={() => move(safeIndex + 1)}>Continue <IconsaxIcon name="ArrowRight4" /></Button>
        : <Button type="submit" disabled={disabled || (hosted && !turnstileToken)}>{disabled ? "Sending enquiry…" : "Send enquiry"} <IconsaxIcon name="ArrowRight4" /></Button>}
    </div>
    {siteKey && safeIndex === steps.length - 1 && <button type="button" className="enquiry-security-retry" onClick={() => setResetCount((value) => value + 1)}>Retry security check</button>}
    {status.message && <p role={status.state === "error" ? "alert" : "status"} aria-live="polite">{status.message}</p>}
    <noscript>Please contact us on WhatsApp to enquire without JavaScript. Nothing has been submitted.</noscript>
    <a href="https://wa.me/233208387020" rel="noreferrer">Prefer WhatsApp? Talk to us directly.</a>
  </form>;
}
