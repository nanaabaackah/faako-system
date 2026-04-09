import React from "react";
import "./FAQ.css";
import { Link } from "react-router-dom";
import { faqSections } from "/src/content/faqContent";

const FAQ_PHONE_HREF = "tel:+233244238419";
const FAQ_WHATSAPP_URL = "https://wa.me/233244238419";
const FAQ_EMAIL_HREF = "mailto:info@reebspartythemes.com";

const toAnchorId = (value = "") =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

function FAQ() {
  return (
    <div className="faq-page">
      <a href="#main" className="skip-link">
        Skip to main content
      </a>
      <main className="faq-shell faq-plain" id="main" role="main">
        <section className="faq-intro" aria-labelledby="faq-heading">
          <p className="faq-intro-eyebrow">REEBS Party Themes</p>
          <h1 id="faq-heading">Frequently Asked Questions</h1>
          <p className="faq-intro-copy">
            Quick answers on bookings, rentals, delivery, and custom setups. If you want a direct answer
            right away, use one of the contact links below.
          </p>
          <div className="faq-intro-links" role="navigation" aria-label="FAQ quick actions">
            <Link to="/contact">Chat with a planner</Link>
            <Link to="/rentals">View rentals</Link>
            <a href={FAQ_PHONE_HREF}>Call us</a>
            <a href={FAQ_WHATSAPP_URL} target="_blank" rel="noopener noreferrer">
              WhatsApp
            </a>
          </div>
          <p className="faq-intro-note">Fast replies Monday to Saturday, 8:30am to 7:00pm.</p>
        </section>

        <nav className="faq-topic-nav" aria-label="FAQ sections">
          <p className="faq-topic-nav-label">Jump to a topic</p>
          <div className="faq-topic-links">
            {faqSections.map((section) => (
              <a key={section.category} href={`#${toAnchorId(section.category)}`}>
                {section.category}
              </a>
            ))}
          </div>
        </nav>

        <section className="faq-grid" aria-label="Frequently asked questions">
          {faqSections.map((section) => {
            const sectionId = toAnchorId(section.category);

            return (
              <article className="faq-topic" key={section.category} id={sectionId}>
                <div className="faq-topic-head">
                  <p className="faq-topic-kicker">{section.kicker}</p>
                  <h2>{section.category}</h2>
                  <p className="faq-topic-blurb">{section.blurb}</p>
                </div>

                <div className="faq-items" role="list">
                  {section.items.map((item, index) => (
                    <details className="faq-item" key={item.question} open={index === 0}>
                      <summary>
                        <span>{item.question}</span>
                        <span className="faq-chevron" aria-hidden="true">
                          ›
                        </span>
                      </summary>
                      <div className="faq-answer">
                        <p>{item.answer}</p>
                      </div>
                    </details>
                  ))}
                </div>
              </article>
            );
          })}
        </section>

        <section className="faq-contact" aria-labelledby="faq-contact-heading">
          <h2 id="faq-contact-heading">Still need help?</h2>
          <p>
            Share your date, guest count, and venue and we will point you to the right rentals, pricing,
            or setup options.
          </p>
          <div className="faq-contact-links">
            <Link to="/contact">Start a brief</Link>
            <a href={FAQ_EMAIL_HREF}>Email the team</a>
            <a href={FAQ_WHATSAPP_URL} target="_blank" rel="noopener noreferrer">
              WhatsApp
            </a>
          </div>
        </section>
      </main>
    </div>
  );
}

export default FAQ;
