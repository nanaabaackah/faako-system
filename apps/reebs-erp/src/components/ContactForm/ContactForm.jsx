import React, { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  clearExpiringDraft,
  loadExpiringDraft,
  saveExpiringDraft,
} from '/src/utils/formDrafts';

const FORM_NAME = "contact";
const CONTACT_DRAFT_KEY = "contactFormDraft";
const MAX_NAME_LENGTH = 80;
const MAX_EMAIL_LENGTH = 120;
const MAX_PHONE_LENGTH = 25;
const MAX_LOCATION_LENGTH = 120;
const MAX_MESSAGE_LENGTH = 1500;

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

const encodeFormData = (values) =>
  new URLSearchParams(
    Object.entries(values).reduce((payload, [key, value]) => {
      payload[key] = typeof value === "string" ? value : String(value ?? "");
      return payload;
    }, {})
  ).toString();

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
    setFormValues((prev) => ({ ...prev, [field]: nextValue }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const form = event.currentTarget;

    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    if (formValues.botField.trim()) {
      setSubmitError("");
      setSubmitSuccess("Thanks. We will review your message shortly.");
      clearExpiringDraft(CONTACT_DRAFT_KEY);
      return;
    }

    const payload = {
      "form-name": FORM_NAME,
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
      const response = await fetch("/", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: encodeFormData(payload),
      });

      if (!response.ok) {
        throw new Error("We could not send your planning brief right now. Please try again or contact us on WhatsApp.");
      }

      setFormValues(createInitialValues(prefillEmail));
      setSubmitSuccess("Your planning brief was sent. We will reply within one business day.");
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
      name={FORM_NAME}
      method="POST"
      action="/contact"
      data-netlify="true"
      netlify-honeypot="bot-field"
      acceptCharset="UTF-8"
      onSubmit={handleSubmit}
      aria-busy={submitting}
    >
      <input type="hidden" name="form-name" value={FORM_NAME} />
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
          <div className="form-group">
            <label htmlFor="contact-name">Name</label>
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
            />
          </div>
          <div className="form-group">
            <label htmlFor="contact-email">Email</label>
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
            />
          </div>
          <div className="form-group">
            <label htmlFor="contact-phone">Phone number</label>
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
              aria-describedby="contact-phone-hint"
              required
            />
            <small className="hint" id="contact-phone-hint">WhatsApp or mobile preferred.</small>
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
          <div className="form-group">
            <label htmlFor="contact-topic">What do you need?</label>
            <select id="contact-topic" name="topic" value={formValues.topic} onChange={updateField("topic")} required>
              <option value="" disabled>Select a service</option>
              <option value="rentals">Party rentals</option>
              <option value="full-setup">Full setup / styling</option>
              <option value="balloons">Balloons &amp; backdrops</option>
              <option value="shop">Party supplies box</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div className="form-group">
            <label htmlFor="contact-event-date">Event date</label>
            <input
              id="contact-event-date"
              type="date"
              name="eventDate"
              min={today}
              value={formValues.eventDate}
              onChange={updateField("eventDate")}
              required
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
          <div className="form-group full-width">
            <label htmlFor="contact-message">Tell us more</label>
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
            />
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
