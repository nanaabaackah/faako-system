import React, { useEffect, useMemo, useState } from 'react';
import Seo from '../components/Seo';
import { useSearchParams } from 'react-router-dom';
import { CalendarTick, DocumentDownload } from 'iconsax-react';
import { HiArrowRight } from 'react-icons/hi2';
import { SiGithub, SiGmail } from 'react-icons/si';
import { BsLinkedin } from 'react-icons/bs';
import ExploreMore from '../components/ExploreMore';
import '../styles/pages/Contact.css';

const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const LAST_SUBMISSION_KEY = 'bynana-contact-last-submission';
const CONTACT_SUBMIT_ENDPOINT = import.meta.env.VITE_CONTACT_SUBMIT_ENDPOINT || '';
const CONTACT_EMAIL = 'nanaabaackah@gmail.com';

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

const ContactForm = ({
  formState,
  onChange,
  onSubmit,
  isSubmitting,
  status,
  subjectTag,
  onReset,
}) => {
  if (status.state === 'success') {
    return (
      <div className="contact-card contact-confirmation ui-panel" role="status" aria-live="polite">
        <h3>Message sent</h3>
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
    >
      <input type="hidden" name="form-name" value="contact" />
      <input type="hidden" name="subjectTag" value={subjectTag} />
      <p className="sr-only">
        <label htmlFor="bot-field">Do not fill this out if you are human</label>
        <input id="bot-field" name="bot-field" />
      </p>

      <div className="contact-form__row">
        <label className="contact-form__field" htmlFor="fname">
          <span>Name</span>
          <input
            type="text"
            id="fname"
            name="name"
            autoComplete="name"
            placeholder="Your name"
            value={formState.name}
            onChange={onChange}
            required
          />
        </label>

        <label className="contact-form__field" htmlFor="email">
          <span>Email</span>
          <input
            type="email"
            id="email"
            name="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={formState.email}
            onChange={onChange}
            required
          />
        </label>
      </div>

      <label className="contact-form__field" htmlFor="subject">
        <span>Subject</span>
        <input
          type="text"
          id="subject"
          name="subject"
          placeholder="What would you like to discuss?"
          value={formState.subject}
          onChange={onChange}
          required
        />
        {subjectTag && <span className="contact-form__hint">Tag: {subjectTag}</span>}
      </label>

      <label className="contact-form__field" htmlFor="message">
        <span>Message</span>
        <textarea
          id="message"
          name="message"
          rows="7"
          placeholder="Tell me about your project, timeline, and goals."
          value={formState.message}
          onChange={onChange}
          required
        ></textarea>
      </label>

      {status.state === 'error' && (
        <p className="contact-form__status contact-form__status--error" role="alert">
          {status.message}
        </p>
      )}

      <div className="contact-form__actions">
        <button type="submit" className="ui-button ui-button--primary" disabled={isSubmitting}>
          {isSubmitting ? 'Sending...' : 'Send message'}
        </button>
      </div>
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
      <header className="contact-hero" role="banner">
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
              <dd>{localTime}</dd>
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

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormState((prev) => ({ ...prev, [name]: value }));
  };

  const resetForm = () => {
    setFormState(buildInitialFormState(subjectTag));
    setFormStatus({ state: 'idle', message: '' });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (isSubmitting) return;

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
      const formData = new FormData(event.target);
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
        const responsePayload = await response.json().catch(() => null);

        if (!response.ok) {
          throw new Error(responsePayload?.error || 'Unable to send your message. Please try again.');
        }
      }

      try {
        window.localStorage.setItem(LAST_SUBMISSION_KEY, String(now));
      } catch {
        // Ignore storage errors.
      }

      setFormStatus({
        state: 'success',
        message: CONTACT_SUBMIT_ENDPOINT
          ? "Thanks! Your note is on its way. I'll reply within one business day."
          : "Your email draft is ready. Send it from your mail app and I'll reply within one business day.",
      });
      setFormState(buildInitialFormState(subjectTag));
    } catch (error) {
      setFormStatus({
        state: 'error',
        message: error.message || 'Unable to send your message. Please try again.',
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
        />

      </WrapperTag>
    </>
  );
}

export default Contact;
