import React, { useState, type FormEvent } from "react";
import { HiMail, HiPhone, HiLocationMarker, HiClock } from "react-icons/hi";
import { FaWhatsapp } from "react-icons/fa";
import { SelectField } from "@faako/ui";
import Layout from "../../components/Layout";
import useSEOMeta from "../../hooks/useSEOMeta";
import StructuredData from "../../components/StructuredData";
import { productApi } from "../../api/products";
import "../styles/Contact.css";

const CONTACT_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "ContactPage",
  "@id": "https://stroanesolutions.com/contact",
  name: "Contact Stroane",
  description:
    "Get in touch with Stroane for food safety audits, HACCP support, Ghana FDA compliance, and training.",
  url: "https://stroanesolutions.com/contact",
  breadcrumb: {
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: "https://stroanesolutions.com/" },
      { "@type": "ListItem", position: 2, name: "Contact", item: "https://stroanesolutions.com/contact" },
    ],
  },
};

const BUSINESS_TYPES = [
  "Restaurant or caterer",
  "Food manufacturer",
  "Importer / exporter",
  "School or hospital kitchen",
  "Hotel or resort",
  "Other",
];

const Contact: React.FC = () => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [business, setBusiness] = useState(BUSINESS_TYPES[0]);
  const [message, setMessage] = useState("");
  const [website, setWebsite] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [feedback, setFeedback] = useState("");

  useSEOMeta({
    title: "Contact Stroane | Food Safety Ghana",
    description:
      "Contact Stroane for food safety audits, HACCP, Ghana FDA compliance, training, and supplies. Based in Accra, serving food businesses across Ghana.",
    canonical: "https://stroanesolutions.com/contact",
  });

  const mailtoHref = () => {
    const subject = encodeURIComponent(`Enquiry from ${name || "website"}`);
    const body = encodeURIComponent(
      `Name: ${name}\nEmail: ${email}\nPhone: ${phone}\nBusiness type: ${business}\n\nMessage:\n${message}`
    );
    return `mailto:info@stroanesolutions.com?subject=${subject}&body=${body}`;
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setStatus("idle");
    setFeedback("");

    if (!name.trim() || (!email.trim() && !phone.trim()) || !message.trim()) {
      setStatus("error");
      setFeedback("Add your name, an email or phone number, and a short message.");
      return;
    }

    if (website.trim()) {
      setStatus("error");
      setFeedback("The enquiry could not be submitted. Please email Stroane directly.");
      return;
    }

    setSubmitting(true);
    try {
      const response = await productApi.submitInquiry({
        name,
        email,
        phone,
        businessName: business,
        message,
        source: "contact_page",
        website,
      });
      setStatus("success");
      setFeedback(response.inquiry.nextStep);
    } catch (error) {
      setStatus("error");
      setFeedback(
        error instanceof Error
          ? error.message
          : "The enquiry service is unavailable. You can email Stroane directly."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Layout>
      <StructuredData schema={CONTACT_SCHEMA} id="contact-schema" />
      <div className="contact-page">
        <section className="contact-hero">
          <img
            src="/imgs/bg_imgs/about_hero.png"
            alt=""
            aria-hidden="true"
            className="contact-hero__bg"
          />
          <div className="contact-hero__overlay" />
          <div className="contact-hero__content">
            <h1 className="contact-hero__heading">Let&rsquo;s Talk Food Safety</h1>
            <p className="contact-hero__para">
              Tell us about your business and we&rsquo;ll get back within one
              working day with the right advisor and the next step.
            </p>
          </div>
        </section>

        <section className="contact-body">
          <div className="contact-body__inner">
            <form className="contact-form" onSubmit={handleSubmit} noValidate>
              <header className="contact-form__header">
                <span className="contact-kicker">Send a Message</span>
                <h2>Tell us what you need.</h2>
                <p>
                  A short note is enough. We&rsquo;ll reply with availability,
                  pricing, and a recommended starting point.
                </p>
              </header>

              <div className="contact-form__grid">
                <label className="contact-field">
                  <span>Full name</span>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    autoComplete="name"
                    required
                  />
                </label>

                <label className="contact-field">
                  <span>Email</span>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                    required
                  />
                </label>

                <label className="contact-field">
                  <span>Phone</span>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    autoComplete="tel"
                    placeholder="+233…"
                  />
                </label>

                <label className="contact-field">
                  <span>Business type</span>
                  <SelectField
                    value={business}
                    ariaLabel="Business type"
                    onChangeValue={(next) => setBusiness(next as string)}
                    options={BUSINESS_TYPES.map((t) => ({ value: t, label: t }))}
                  />
                </label>
              </div>

              <label className="contact-form__trap" aria-hidden="true">
                <span>Website</span>
                <input
                  type="text"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  autoComplete="off"
                  tabIndex={-1}
                />
              </label>

              <label className="contact-field contact-field--full">
                <span>How can we help?</span>
                <textarea
                  rows={5}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="A short summary of your operation and what you need…"
                  required
                />
              </label>

              {feedback ? (
                <p
                  className={`contact-form__feedback contact-form__feedback--${status}`}
                  role={status === "error" ? "alert" : "status"}
                >
                  {feedback}
                  {status === "error" ? (
                    <>
                      {" "}
                      <a href={mailtoHref()}>Email Stroane instead.</a>
                    </>
                  ) : null}
                </p>
              ) : null}

              <button type="submit" className="contact-form__submit" disabled={submitting}>
                {submitting ? "Sending..." : "Send Message"}
              </button>
              <p className="contact-form__note">
                We&rsquo;ll route your enquiry to the right advisor and reply
                within one working day.
              </p>
            </form>

            <aside className="contact-info">
              <span className="contact-kicker">Direct Channels</span>
              <h2>Or reach us another way.</h2>

              <ul className="contact-info__list">
                <li>
                  <span className="contact-info__icon"><HiMail size={20} /></span>
                  <div>
                    <strong>Email</strong>
                    <a href="mailto:info@stroanesolutions.com">info@stroanesolutions.com</a>
                  </div>
                </li>
                <li>
                  <span className="contact-info__icon"><HiPhone size={20} /></span>
                  <div>
                    <strong>Phone</strong>
                    <a href="tel:+233243316192">+233 24 331 6192</a>
                  </div>
                </li>
                <li>
                  <span className="contact-info__icon"><FaWhatsapp size={20} /></span>
                  <div>
                    <strong>WhatsApp</strong>
                    <a href="https://wa.me/233555744000" target="_blank" rel="noopener noreferrer">
                      Message us on WhatsApp
                    </a>
                  </div>
                </li>
                <li>
                  <span className="contact-info__icon"><HiLocationMarker size={20} /></span>
                  <div>
                    <strong>Office</strong>
                    <span>Accra, Ghana</span>
                  </div>
                </li>
                <li>
                  <span className="contact-info__icon"><HiClock size={20} /></span>
                  <div>
                    <strong>Hours</strong>
                    <span>Mon &ndash; Fri, 9:00 &ndash; 17:00 GMT</span>
                  </div>
                </li>
              </ul>

              <div className="contact-info__panel">
                <strong>Prefer to book directly?</strong>
                <p>
                  Schedule a 45-minute consultation and we&rsquo;ll assess your
                  current setup on the call.
                </p>
                <a
                  href="mailto:info@stroanesolutions.com?subject=Consultation%20booking"
                  className="contact-info__panel-cta"
                >
                  Book a consultation
                </a>
              </div>
            </aside>
          </div>
        </section>
      </div>
    </Layout>
  );
};

export default Contact;
