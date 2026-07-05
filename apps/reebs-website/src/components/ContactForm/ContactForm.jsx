import React, { useEffect, useMemo, useState } from 'react';
import { DateField, SelectField } from "@faako/ui";
import { useLocation } from 'react-router-dom';
import {
  clearExpiringDraft,
  loadExpiringDraft,
  saveExpiringDraft,
} from '/src/utils/formDrafts';

const CONTACT_DRAFT_KEY = "contactFormDraft";
const MAX_NAME_LENGTH = 80;
const MAX_EMAIL_LENGTH = 120;
const MAX_PHONE_LENGTH = 25;
const MAX_LOCATION_LENGTH = 120;
const MAX_MESSAGE_LENGTH = 1500;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^\+?[0-9][0-9\s().-]{6,}$/;

const createInitialValues = (prefillEmail = "") => ({
  name: "",
  email: prefillEmail,
  phone: "",
  topic: "",
  eventDate: "",
  location: "",
  message: "",
  botField: "",
});

const clampValue = (value, maxLength) => String(value || "").slice(0, maxLength);

const isReasonableName = (value) => {
  const normalized = String(value || "").trim();
  return normalized.length >= 2 && /[A-Za-z]/.test(normalized) && !/[@:/\\]/.test(normalized);
};

const validateContactForm = (values) => {
  const errors = {};
  if (!isReasonableName(values.name)) errors.name = "Enter your full name.";
  if (!EMAIL_PATTERN.test(String(values.email || "").trim().toLowerCase())) {
    errors.email = "Enter a valid email address.";
  }
  if (!PHONE_PATTERN.test(String(values.phone || "").trim())) {
    errors.phone = "Enter a valid phone or WhatsApp number.";
  }
  if (!values.topic) errors.topic = "Choose the service you need.";
  if (!values.eventDate) errors.eventDate = "Choose the event date.";
  if (String(values.message || "").trim().length < 12) {
    errors.message = "Tell us a little more about the event.";
  }
  return errors;
};

function RequiredMark() {
  return (
    <>
      <span className="form-required-mark" aria-hidden="true">*</span>
      <span className="sr-only">required</span>
    </>
  );
}

function ContactForm() {
  const location = useLocation();
  const prefillEmail = useMemo(() => {
    const nextEmail = typeof location.state?.leadEmail === "string" ? location.state.leadEmail.trim() : "";
    return clampValue(nextEmail, MAX_EMAIL_LENGTH);
  }, [location.state]);

  const [formValues, setFormValues] = useState(() => createInitialValues(prefillEmail));
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submitSuccess, setSubmitSuccess] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});

  useEffect(() => {
    const savedDraft = loadExpiringDraft(CONTACT_DRAFT_KEY);
    if (!savedDraft || typeof savedDraft !== "object") return;

    setFormValues((prev) => ({
      ...prev,
      ...savedDraft,
      email: savedDraft.email || prev.email,
    }));
  }, []);

  useEffect(() => {
    if (!prefillEmail) return;
    setFormValues((prev) =>
      prev.email.trim() || prev.email === prefillEmail ? prev : { ...prev, email: prefillEmail }
    );
  }, [prefillEmail]);

  useEffect(() => {
    if (submitting || submitSuccess) return;
    saveExpiringDraft(CONTACT_DRAFT_KEY, formValues);
  }, [formValues, submitting, submitSuccess]);

  const today = useMemo(() => {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    return now.toISOString().slice(0, 10);
  }, []);

  const updateField = (field, maxLength = null) => (event) => {
    const nextValue = maxLength ? clampValue(event.target.value, maxLength) : event.target.value;
    if (submitError) setSubmitError("");
    if (submitSuccess) setSubmitSuccess("");
    setFieldErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
    setFormValues((prev) => ({ ...prev, [field]: nextValue }));
  };

  const fieldError = (field) => fieldErrors[field] || "";

  const handleSubmit = async (event) => {
    event.preventDefault();
    const nextFieldErrors = validateContactForm(formValues);
    if (Object.keys(nextFieldErrors).length) {
      setFieldErrors(nextFieldErrors);
      setSubmitError(Object.values(nextFieldErrors)[0]);
      return;
    }

    if (formValues.botField.trim()) {
      setSubmitError("");
      setSubmitSuccess("Thanks. We will review your message shortly.");
      clearExpiringDraft(CONTACT_DRAFT_KEY);
      return;
    }

    const payload = {
      "bot-field": formValues.botField,
      name: formValues.name.trim(),
      email: formValues.email.trim(),
      phone: formValues.phone.trim(),
      topic: formValues.topic,
      eventDate: formValues.eventDate,
      location: formValues.location.trim(),
      message: formValues.message.trim(),
    };

    setSubmitting(true);
    setSubmitError("");
    setSubmitSuccess("");

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      const responseBody = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          responseBody?.error
            || "We could not send your planning brief right now. Please try again or contact us on WhatsApp."
        );
      }

      setFormValues(createInitialValues(prefillEmail));
      setFieldErrors({});
      setSubmitSuccess(
        responseBody?.requestId
          ? `Your planning brief was saved as request #${responseBody.requestId}. We will reply within one business day.`
          : responseBody?.message || "Your planning brief was sent. We will reply within one business day."
      );
      clearExpiringDraft(CONTACT_DRAFT_KEY);
    } catch (error) {
      setSubmitError(error?.message || "We could not send your planning brief right now.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form
      className="contact-form form-shell"
      name="contact"
      method="POST"
      acceptCharset="UTF-8"
      onSubmit={handleSubmit}
      aria-busy={submitting}
      noValidate
    >
      <p className="hidden">
        <label>
          Do not fill this out: <input name="bot-field" value={formValues.botField} onChange={updateField("botField", 200)} />
        </label>
      </p>

      <div className="form-overview">
        <div className="form-overview-copy">
          <p className="form-kicker">Quick brief</p>
          <h4>Share the essentials</h4>
          <p className="contact-form-note">We reply within one business day with availability and options.</p>
        </div>
        <div className="form-overview-metrics" aria-label="What to include">
          <span>Theme</span>
          <span>Date</span>
          <span>Guest count</span>
          <span>Budget</span>
        </div>
      </div>

      <section className="form-section" aria-labelledby="contact-form-contact-heading">
        <div className="form-section-head">
          <p className="form-section-kicker">01</p>
          <h4 id="contact-form-contact-heading">How we can reach you</h4>
          <p>Share the best contact details so we can reply with the right options quickly.</p>
        </div>
        <div className="contact-form-grid form-section-grid">
          <div className={`form-group ${fieldError("name") ? "is-error" : ""}`}>
            <label htmlFor="contact-name">Name <RequiredMark /></label>
            <input
              id="contact-name"
              type="text"
              name="name"
              autoComplete="name"
              placeholder="Your full name"
              value={formValues.name}
              onChange={updateField("name", MAX_NAME_LENGTH)}
              minLength={2}
              maxLength={MAX_NAME_LENGTH}
              required
              aria-invalid={fieldError("name") ? "true" : undefined}
              aria-describedby={fieldError("name") ? "contact-name-error" : undefined}
            />
            {fieldError("name") ? <small className="form-field-error" id="contact-name-error">{fieldError("name")}</small> : null}
          </div>
          <div className={`form-group ${fieldError("email") ? "is-error" : ""}`}>
            <label htmlFor="contact-email">Email <RequiredMark /></label>
            <input
              id="contact-email"
              type="email"
              name="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={formValues.email}
              onChange={updateField("email", MAX_EMAIL_LENGTH)}
              maxLength={MAX_EMAIL_LENGTH}
              required
              aria-invalid={fieldError("email") ? "true" : undefined}
              aria-describedby={fieldError("email") ? "contact-email-error" : undefined}
            />
            {fieldError("email") ? <small className="form-field-error" id="contact-email-error">{fieldError("email")}</small> : null}
          </div>
          <div className={`form-group ${fieldError("phone") ? "is-error" : ""}`}>
            <label htmlFor="contact-phone">Phone number <RequiredMark /></label>
            <input
              id="contact-phone"
              type="tel"
              name="phone"
              inputMode="tel"
              autoComplete="tel"
              placeholder="+233 24 423 8419"
              pattern={"^[0-9+\\-()\\s]{7,}$"}
              value={formValues.phone}
              onChange={updateField("phone", MAX_PHONE_LENGTH)}
              maxLength={MAX_PHONE_LENGTH}
              aria-invalid={fieldError("phone") ? "true" : undefined}
              aria-describedby={fieldError("phone") ? "contact-phone-error contact-phone-hint" : "contact-phone-hint"}
              required
            />
            <small className="hint" id="contact-phone-hint">WhatsApp or mobile preferred.</small>
            {fieldError("phone") ? <small className="form-field-error" id="contact-phone-error">{fieldError("phone")}</small> : null}
          </div>
        </div>
      </section>

      <section className="form-section" aria-labelledby="contact-form-event-heading">
        <div className="form-section-head">
          <p className="form-section-kicker">02</p>
          <h4 id="contact-form-event-heading">Event snapshot</h4>
          <p>Give us the service, date, and location so we can match availability properly.</p>
        </div>
        <div className="contact-form-grid form-section-grid">
          <div className={`form-group ${fieldError("topic") ? "is-error" : ""}`}>
            <label htmlFor="contact-topic-trigger">What do you need? <RequiredMark /></label>
            <SelectField id="contact-topic" name="topic" value={formValues.topic} onChange={updateField("topic")} required error={fieldError("topic")}>
              <option value="" disabled>Select a service</option>
              <option value="rentals">Party rentals</option>
              <option value="full-setup">Full setup / styling</option>
              <option value="balloons">Balloons &amp; backdrops</option>
              <option value="shop">Party supplies box</option>
              <option value="other">Other</option>
            </SelectField>
          </div>
          <div className={`form-group ${fieldError("eventDate") ? "is-error" : ""}`}>
            <label htmlFor="contact-event-date-trigger">Event date <RequiredMark /></label>
            <DateField
              id="contact-event-date"
              name="eventDate"
              min={today}
              value={formValues.eventDate}
              onChange={updateField("eventDate")}
              required
              error={fieldError("eventDate")}
            />
          </div>
          <div className="form-group">
            <label htmlFor="contact-location">Location / venue</label>
            <input
              id="contact-location"
              type="text"
              name="location"
              placeholder="Neighborhood or venue"
              autoComplete="address-level2"
              value={formValues.location}
              onChange={updateField("location", MAX_LOCATION_LENGTH)}
              maxLength={MAX_LOCATION_LENGTH}
            />
          </div>
        </div>
      </section>

      <section className="form-section" aria-labelledby="contact-form-brief-heading">
        <div className="form-section-head">
          <p className="form-section-kicker">03</p>
          <h4 id="contact-form-brief-heading">Your brief</h4>
          <p>Tell us the vibe, headcount, and must-haves so we can respond with focused options.</p>
        </div>
        <div className="contact-form-grid form-section-grid">
          <div className={`form-group full-width ${fieldError("message") ? "is-error" : ""}`}>
            <label htmlFor="contact-message">Tell us more <RequiredMark /></label>
            <textarea
              id="contact-message"
              name="message"
              rows="5"
              placeholder="Theme, guest count, budget range, must-haves..."
              value={formValues.message}
              onChange={updateField("message", MAX_MESSAGE_LENGTH)}
              maxLength={MAX_MESSAGE_LENGTH}
              minLength={12}
              required
              aria-invalid={fieldError("message") ? "true" : undefined}
              aria-describedby={fieldError("message") ? "contact-message-error" : undefined}
            />
            {fieldError("message") ? <small className="form-field-error" id="contact-message-error">{fieldError("message")}</small> : null}
          </div>
        </div>
      </section>

      <div className="form-footer">
        <small className="hint">Need it fast? Call or WhatsApp for same-day options.</small>
        <button type="submit" className="btn btn-primary" disabled={submitting}>
          {submitting ? "Sending..." : "Send planning brief"}
        </button>
      </div>
      {submitError ? <p className="form-error" role="alert">{submitError}</p> : null}
      {submitSuccess ? (
        <p className="form-success" role="status" aria-live="polite">
          {submitSuccess}
        </p>
      ) : null}
    </form>
  );
}

export default ContactForm;
