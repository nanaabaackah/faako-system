import React from "react";
import "./FAQ.css";
import { Link } from "react-router-dom";

const FAQ_PHONE_HREF = "tel:+233244238419";
const FAQ_WHATSAPP_URL = "https://wa.me/233244238419";
const FAQ_EMAIL_HREF = "mailto:info@reebspartythemes.com";

const toAnchorId = (value = "") =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

const faqSections = [
  {
    category: "Planning & booking",
    kicker: "Start here",
    blurb: "What you need to know before locking in a date with REEBS.",
    items: [
      {
        question: "How do I book rentals or a full setup?",
        answer:
          "Reserve rentals online or send us your date, venue, and theme. We confirm availability fast, share a simple quote, and secure your spot once payment is received.",
      },
      {
        question: "How early should I book?",
        answer:
          "Weekends fill up fast. Book rentals 1 to 2 weeks ahead when you can; full styling is best 2 to 4 weeks out. Same-day or next-day requests are possible. Call or WhatsApp to check.",
      },
      {
        question: "Can you help me pick a theme?",
        answer:
          "Absolutely. Tell us the vibe, guest count, and budget. We will suggest rentals, balloons, and decor and can share a mini moodboard so you know exactly what is coming.",
      },
    ],
  },
  {
    category: "Delivery, setup & pickup",
    kicker: "Logistics",
    blurb: "How your items get to you and back home.",
    items: [
      {
        question: "Do you deliver and pick up?",
        answer:
          "Yes. We schedule 1-hour delivery windows across Accra, Tema, and beyond. Pickups are collected the same day or next morning depending on your venue hours.",
      },
      {
        question: "Will your team handle setup?",
        answer:
          "For full styling packages we set up and tear down. Rentals-only orders are drop-off, but we can add setup and strike for an extra fee; just let us know you need it.",
      },
      {
        question: "What happens if plans change?",
        answer:
          "Tell us as soon as you can. We will do our best to adjust to a new address or time; some changes may update your delivery fee or setup window.",
      },
    ],
  },
  {
    category: "Payments & policies",
    kicker: "Details",
    blurb: "How we hold your date and handle changes.",
    items: [
      {
        question: "Do I pay a deposit?",
        answer:
          "Yes, payment secures your inventory and team. The balance, if any, is due before delivery or setup.",
      },
      {
        question: "Can I reschedule or cancel?",
        answer:
          "Reschedules are free when inventory is available. Cancellations may be subject to fees depending on notice and custom items reserved.",
      },
      {
        question: "Is there a security fee?",
        answer:
          "Some items require a refundable security fee. We will flag it on your quote and return it once everything is collected in good condition.",
      },
    ],
  },
  {
    category: "Care & special requests",
    kicker: "Good to know",
    blurb: "Keeping items party-ready and tailored to you.",
    items: [
      {
        question: "How do you clean rentals?",
        answer:
          "Every item is sanitized and checked before it leaves our studio. Bouncy castles are wiped down on-site during setup.",
      },
      {
        question: "Can you do custom balloon colors or backdrops?",
        answer:
          "Yes. Share a moodboard or hex codes and we will match or blend colors. We can also fabricate themed backdrops on request.",
      },
      {
        question: "Do you travel outside Accra and Tema?",
        answer:
          "We do. Travel fees depend on distance, timing, and the crew required. Tell us your venue and we will confirm the best option.",
      },
    ],
  },
];

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
