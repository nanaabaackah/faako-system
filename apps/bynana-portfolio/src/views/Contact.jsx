import React, { useEffect, useMemo, useState } from 'react';
import Seo from '../components/Seo';
import { useSearchParams } from 'react-router-dom';
import { CalendarTick, DocumentDownload } from 'iconsax-react';
import { HiArrowRight } from 'react-icons/hi2';
import { SiGithub, SiGmail } from 'react-icons/si';
import { BsLinkedin } from 'react-icons/bs';
import { InlineNotice } from '@faako/ui';
import ExploreMore from '../components/ExploreMore';
import '../styles/pages/Contact.css';

const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const LAST_SUBMISSION_KEY = 'bynana-contact-last-submission';
const CONTACT_SUBMIT_ENDPOINT = import.meta.env.VITE_CONTACT_SUBMIT_ENDPOINT || '';
const CONTACT_EMAIL = 'nanaabaackah@gmail.com';
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const contactLinks = [
  {
    href: 'https://dev.nanaabaackah.com/book',
    label: 'Book a session',
    icon: CalendarTick,
  },
  {
    href: 'mailto:nanaabaackah@gmail.com',
    label: 'Email',
    icon: SiGmail,
  },
  {
    href: 'https://www.linkedin.com/in/nana-aba-ackah/',
    label: 'LinkedIn',
    icon: BsLinkedin,
  },
  {
    href: 'https://github.com/nanaabaackah/',
    label: 'GitHub',
    icon: SiGithub,
  },
  {
    href: '/documents/Nana Aba Ackah Resume.pdf',
    label: 'Resume',
    icon: DocumentDownload,
    iconVariant: 'Bold',
  },
];

const contactFocusAreas = [
  'Product strategy',
  'ERP modernization',
  'Internal tools',
  'Frontend systems',
  'Automation',
  'Technical advisory',
];

const normalizeTag = (value = '') =>
  value
    .replace(/[-_]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const getLastSubmission = () => {
  if (typeof window === 'undefined') return 0;
  const stored = Number(window.localStorage.getItem(LAST_SUBMISSION_KEY));
  return Number.isFinite(stored) ? stored : 0;
};

const openMailDraft = ({ name, email, subject, message }) => {
  const body = [
    message,
    '',
    `Name: ${name}`,
    `Email: ${email}`,
  ].join('\n');
  const mailto = new URL(`mailto:${CONTACT_EMAIL}`);
  mailto.searchParams.set('subject', subject);
  mailto.searchParams.set('body', body);
  window.location.href = mailto.toString();
};

const buildInitialFormState = (subjectTag) => ({
  name: '',
  email: '',
  subject: subjectTag ? `[${subjectTag}] ` : '',
  message: '',
});

const isReasonableName = (value) => {
  const normalized = String(value || '').trim();
  return normalized.length >= 2 && /\p{L}/u.test(normalized) && !/[@:/\\]/.test(normalized);
};

const validateContactForm = (values) => {
  const errors = {};
  if (!isReasonableName(values.name)) errors.name = 'Enter your name.';
  if (!EMAIL_PATTERN.test(String(values.email || '').trim().toLowerCase())) {
    errors.email = 'Enter a valid email address.';
  }
  if (String(values.subject || '').trim().length < 3) {
    errors.subject = 'Add a short subject.';
  }
  if (String(values.message || '').trim().length < 12) {
    errors.message = 'Tell me a little more about the project.';
  }
  return errors;
};

function RequiredMark() {
  return (
    <>
      <span className="contact-form__required" aria-hidden="true">*</span>
      <span className="sr-only">required</span>
    </>
  );
}

const ContactForm = ({
  formState,
  onChange,
  onSubmit,
  isSubmitting,
  status,
  subjectTag,
  onReset,
  fieldErrors = {},
}) => {
  if (status.state === 'success') {
    return (
      <div className="contact-card contact-confirmation ui-panel" role="status" aria-live="polite">
        <h3>{status.title || 'Message sent'}</h3>
        <p>{status.message}</p>
        <button type="button" className="ui-button" onClick={onReset}>
          Send another note
        </button>
      </div>
    );
  }

  return (
    <form
      name="contact"
      method="POST"
      className="contact-card contact-form ui-panel"
	      aria-labelledby="contact-form-heading"
	      onSubmit={onSubmit}
	      noValidate
	    >
      <input type="hidden" name="form-name" value="contact" />
      <input type="hidden" name="subjectTag" value={subjectTag} />
      <p className="contact-form__honeypot" aria-hidden="true">
        <label htmlFor="bot-field">Leave this field empty</label>
        <input id="bot-field" name="bot-field" tabIndex="-1" autoComplete="off" />
      </p>

      <div className="contact-form__row">
        <label className={`contact-form__field ${fieldErrors.name ? 'is-error' : ''}`} htmlFor="fname">
          <span>Name <RequiredMark /></span>
          <input
            type="text"
            id="fname"
            name="name"
            autoComplete="name"
            placeholder="Your name"
            value={formState.name}
            onChange={onChange}
            maxLength="120"
            required
            aria-invalid={fieldErrors.name ? 'true' : undefined}
            aria-describedby={fieldErrors.name ? 'fname-error' : undefined}
          />
          {fieldErrors.name ? <span className="contact-form__field-error" id="fname-error">{fieldErrors.name}</span> : null}
        </label>

        <label className={`contact-form__field ${fieldErrors.email ? 'is-error' : ''}`} htmlFor="email">
          <span>Email <RequiredMark /></span>
          <input
            type="email"
            id="email"
            name="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={formState.email}
            onChange={onChange}
            maxLength="254"
            required
            aria-invalid={fieldErrors.email ? 'true' : undefined}
            aria-describedby={fieldErrors.email ? 'email-error' : undefined}
          />
          {fieldErrors.email ? <span className="contact-form__field-error" id="email-error">{fieldErrors.email}</span> : null}
        </label>
      </div>

      <label className={`contact-form__field ${fieldErrors.subject ? 'is-error' : ''}`} htmlFor="subject">
        <span>Subject <RequiredMark /></span>
        <input
          type="text"
          id="subject"
          name="subject"
          placeholder="What would you like to discuss?"
          value={formState.subject}
          onChange={onChange}
          maxLength="160"
          required
          aria-invalid={fieldErrors.subject ? 'true' : undefined}
          aria-describedby={fieldErrors.subject ? 'subject-error' : undefined}
        />
        {fieldErrors.subject ? <span className="contact-form__field-error" id="subject-error">{fieldErrors.subject}</span> : null}
        {subjectTag && <span className="contact-form__hint">Tag: {subjectTag}</span>}
      </label>

      <label className={`contact-form__field ${fieldErrors.message ? 'is-error' : ''}`} htmlFor="message">
        <span>Message <RequiredMark /></span>
        <textarea
          id="message"
          name="message"
          rows="7"
          placeholder="Tell me about your project, timeline, and goals."
          value={formState.message}
          onChange={onChange}
          maxLength="4000"
          required
          aria-invalid={fieldErrors.message ? 'true' : undefined}
          aria-describedby={fieldErrors.message ? 'message-error' : undefined}
        ></textarea>
        {fieldErrors.message ? <span className="contact-form__field-error" id="message-error">{fieldErrors.message}</span> : null}
      </label>

      {status.state === 'error' && (
        <InlineNotice
          compact
          dismissible={false}
          tone="error"
          title="Message not sent"
          message={status.message}
        />
      )}

      <div className="contact-form__actions">
        <button type="submit" className="ui-button ui-button--primary" disabled={isSubmitting}>
          {isSubmitting ? 'Sending...' : 'Send message'}
        </button>
      </div>
      <p className="contact-form__privacy-note">
        By sending this enquiry, you agree that I may use the details provided to respond.
        See the <a href="/privacy">privacy policy</a>.
      </p>
    </form>
  );
};

const ContactContent = ({
  formState,
  onFormChange,
  onFormSubmit,
  isSubmitting,
  status,
  subjectTag,
  onReset,
  fieldErrors,
}) => {
  const localTime = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Africa/Accra',
    timeZoneName: 'short',
  }).format(new Date());

  return (
    <div className="contact-shell">
      <header className="contact-hero">
        <div className="contact-hero__copy" data-scroll-reveal="fadeInUp">
          <p className="contact-hero__eyebrow">[Contact]</p>
          <h1>Designing useful digital experiences starts with a clear conversation.</h1>
          <p className="contact-hero__summary">
            Reach out for product engineering support, ERP modernization, internal tooling, and cross-functional
            delivery. I usually respond within one business day.
          </p>
          <div className="contact-hero__actions">
            <a
              className="ui-button ui-button--primary"
              href="https://dev.nanaabaackah.com/book"
              target="_blank"
              rel="noreferrer noopener"
            >
              Book working session <HiArrowRight size={16} aria-hidden="true" />
            </a>
            <a className="ui-button" href="mailto:nanaabaackah@gmail.com">
              Send email
            </a>
          </div>
        </div>

        <aside className="contact-hero__panel ui-panel" data-scroll-reveal="fadeInRight">
          <p className="contact-hero__panel-label">Current availability</p>
          <h2>Open for new projects from next month</h2>
          <dl className="contact-hero__meta">
            <div>
              <dt>Timezone</dt>
              <dd>GMT (Accra)</dd>
            </div>
            <div>
              <dt>Local time</dt>
              <dd suppressHydrationWarning>{localTime}</dd>
            </div>
            <div>
              <dt>Response</dt>
              <dd>&lt; 1 business day</dd>
            </div>
          </dl>
          {contactFocusAreas.map((item) => (
          <span className="contact-strip__item" key={item}>
            {item}
          </span>
        ))}
        </aside>
      </header>

      <section className="contact-main" aria-labelledby="contact-form-heading">
        <aside className="contact-main__meta">
          <div className="contact-section__header" data-scroll-reveal="fadeInUp">
            <h2 id="contact-links-heading">Ways to connect</h2>
            <p>Choose the channel that works best for you.</p>
          </div>

          <div className="contact-links-grid">
            {contactLinks.map(({ href, label, icon, iconVariant }) => {
              const opensNewTab =
                href.startsWith('http') || href.startsWith('mailto:') || href.toLowerCase().endsWith('.pdf');

              return (
                <a
                  key={label}
                  className="contact-link ui-panel"
                  href={href}
                  target={opensNewTab ? '_blank' : undefined}
                  rel={opensNewTab ? 'noreferrer noopener' : undefined}
                  data-scroll-reveal="fadeInUp"
                >
                  <div className="contact-link__icon" aria-hidden="true">
                    {React.createElement(icon, {
                      size: 18,
                      ...(iconVariant ? { variant: iconVariant } : {}),
                      'aria-hidden': 'true',
                    })}
                  </div>
                  <span>{label}</span>
                </a>
              );
            })}
          </div>
        </aside>

        <div className="contact-main__form">
          <div className="contact-section__header" data-scroll-reveal="fadeInUp">
            <h2 id="contact-form-heading">Tell me about your project</h2>
            <p>Include goals, timeline, and constraints. I&apos;ll send practical next steps.</p>
          </div>

          <div className="contact-form-grid">

            <ContactForm
              formState={formState}
              onChange={onFormChange}
              onSubmit={onFormSubmit}
              isSubmitting={isSubmitting}
	              status={status}
	              subjectTag={subjectTag}
	              onReset={onReset}
	              fieldErrors={fieldErrors}
	            />
          </div>
        </div>
      </section>
    </div>
  );
};

function Contact({ embedded = false, sectionId }) {
  const [searchParams] = useSearchParams();
  const WrapperTag = embedded ? 'section' : 'main';

  const subjectTag = useMemo(() => {
    const rawTag =
      searchParams.get('topic') || searchParams.get('from') || searchParams.get('subject') || '';
    return normalizeTag(rawTag);
  }, [searchParams]);

  const [formState, setFormState] = useState(() => buildInitialFormState(subjectTag));
  const [formStatus, setFormStatus] = useState({ state: 'idle', message: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const hasUnsavedChanges = useMemo(
    () =>
      formStatus.state !== 'success'
      && Object.entries(formState).some(
        ([field, value]) =>
          String(value || '').trim()
          && !(field === 'subject' && value === (subjectTag ? `[${subjectTag}] ` : '')),
      ),
    [formState, formStatus.state, subjectTag],
  );

  useEffect(() => {
    if (!subjectTag) return;

    setFormState((prev) => {
      const trimmed = prev.subject.trim();
      if (!trimmed || trimmed.startsWith('[')) {
        return { ...prev, subject: `[${subjectTag}] ` };
      }
      return prev;
    });
  }, [subjectTag]);

  useEffect(() => {
    if (!hasUnsavedChanges || isSubmitting) return undefined;

    const warnBeforeUnload = (event) => {
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', warnBeforeUnload);
    return () => window.removeEventListener('beforeunload', warnBeforeUnload);
  }, [hasUnsavedChanges, isSubmitting]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFieldErrors((current) => {
      if (!current[name]) return current;
      const next = { ...current };
      delete next[name];
      return next;
    });
    setFormState((prev) => ({ ...prev, [name]: value }));
  };

  const resetForm = () => {
    setFormState(buildInitialFormState(subjectTag));
    setFormStatus({ state: 'idle', message: '' });
    setFieldErrors({});
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (isSubmitting) return;
    const formElement = event.currentTarget;

    const nextFieldErrors = validateContactForm(formState);
    if (Object.keys(nextFieldErrors).length) {
      setFieldErrors(nextFieldErrors);
      setFormStatus({
        state: 'error',
        message: 'Please review the highlighted fields.',
      });
      window.requestAnimationFrame(() => {
        formElement.querySelector('[aria-invalid="true"]')?.focus();
      });
      return;
    }

    const lastSubmission = getLastSubmission();
    const now = Date.now();

    if (lastSubmission && now - lastSubmission < RATE_LIMIT_WINDOW_MS) {
      const waitSeconds = Math.ceil((RATE_LIMIT_WINDOW_MS - (now - lastSubmission)) / 1000);
      setFormStatus({
        state: 'error',
        message: `Please wait ${waitSeconds} seconds before sending another message.`,
      });
      return;
    }

    setIsSubmitting(true);
    setFormStatus({ state: 'idle', message: '' });

    try {
      const formData = new FormData(formElement);
      const botField = String(formData.get('bot-field') || '').trim();
      const trimmedSubject = formState.subject.trim();
      const subjectPrefix = subjectTag ? `[${subjectTag}]` : '';
      const subjectLine =
        subjectTag && !trimmedSubject.startsWith(subjectPrefix)
          ? `${subjectPrefix} ${trimmedSubject}`.trim()
          : trimmedSubject;

      const payload = {
        name: formState.name,
        email: formState.email,
        subject: subjectLine,
        message: formState.message,
        subjectTag,
        botField,
      };

      if (!CONTACT_SUBMIT_ENDPOINT) {
        openMailDraft(payload);
      } else {
        const response = await fetch(CONTACT_SUBMIT_ENDPOINT, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify(payload),
        });
        if (!response.ok) throw new Error('contact_submission_failed');
      }

      try {
        window.localStorage.setItem(LAST_SUBMISSION_KEY, String(now));
      } catch {
        // Ignore storage errors.
      }

      setFormStatus({
        state: 'success',
        title: CONTACT_SUBMIT_ENDPOINT ? 'Message sent' : 'Email draft opened',
        message: CONTACT_SUBMIT_ENDPOINT
          ? "Thanks! Your note is on its way. I'll reply within one business day."
          : "Your email draft is ready. Send it from your mail app and I'll reply within one business day.",
	      });
	      setFormState(buildInitialFormState(subjectTag));
	      setFieldErrors({});
    } catch {
      setFormStatus({
        state: 'error',
        message: 'Unable to send your message. Please try again.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <WrapperTag
        id={sectionId || (!embedded ? 'main-content' : undefined)}
        tabIndex={!embedded ? '-1' : undefined}
      className="contact-page"
      >
        {!embedded && (
          <Seo
            title="Contact | By Nana"
            description="Get in touch with Nana Aba for project work, collaboration, or speaking requests."
            path="/contact"
          />
        )}

        <ContactContent
          formState={formState}
          onFormChange={handleChange}
          onFormSubmit={handleSubmit}
          isSubmitting={isSubmitting}
          status={formStatus}
          subjectTag={subjectTag}
          onReset={resetForm}
          fieldErrors={fieldErrors}
        />

      </WrapperTag>
    </>
  );
}

export default Contact;
