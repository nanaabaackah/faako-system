import { Link } from "react-router-dom";
import "../styles/pages/Legal.css";

const termsSections = [
  {
    id: "terms-acceptance",
    title: "1. Acceptance of terms",
    body: "By using Faako services, you agree to these Terms of Service and related policies listed on this website.",
    items: [
      "If you use services on behalf of an organization, you confirm you are authorized to bind that organization.",
      "If you disagree with these terms, you should discontinue use of the platform.",
    ],
  },
  {
    id: "terms-services",
    title: "2. Services and scope",
    body: "Faako provides websites, dashboards, business features, integrations, and support based on agreed proposals.",
    items: [
      "Delivery scope, milestones, and timelines are defined in each engagement.",
      "Changes outside approved scope may require revised pricing and schedules.",
    ],
  },
  {
    id: "terms-accounts",
    title: "3. Accounts and access",
    body: "You are responsible for keeping your login details safe, account details accurate, and account use authorized.",
    items: [
      "Notify us promptly if you suspect unauthorized account access.",
      "We may suspend access temporarily to protect systems and data security.",
    ],
  },
  {
    id: "terms-billing",
    title: "4. Billing and payments",
    body: "Fees, billing cycles, and payment terms follow your accepted proposal or plan.",
    items: [
      "Invoices are payable according to the due date stated on the invoice.",
      "Late or missed payments may pause delivery, support, or platform access.",
    ],
  },
  {
    id: "terms-use",
    title: "5. Acceptable use",
    body: "You agree not to misuse services, attempt unauthorized access, or disrupt service reliability.",
    items: [
      "No reverse engineering, scraping, or abuse of platform resources.",
      "No unlawful, deceptive, harmful, or infringing content submission.",
    ],
  },
  {
    id: "terms-ip",
    title: "6. Intellectual property",
    body: "Unless agreed otherwise in writing, Faako keeps rights to its internal tools and platform components used to deliver services.",
    items: [
      "You retain ownership of your submitted business content and data.",
      "Deliverables may include licensed third-party components with separate terms.",
    ],
  },
  {
    id: "terms-liability",
    title: "7. Warranties and liability",
    body: "Services are provided as-is and as-available, with ongoing improvements and reasonable operational care.",
    items: [
      "Faako is not liable for indirect, incidental, or consequential damages.",
      "Liability limits apply to the maximum extent permitted by applicable law.",
    ],
  },
  {
    id: "terms-termination",
    title: "8. Suspension and termination",
    body: "Either party may end services according to contract terms, including material breach or prolonged non-payment.",
    items: [
      "Upon termination, access may be removed after a defined transition period.",
      "Outstanding fees and legal obligations remain enforceable.",
    ],
  },
  {
    id: "terms-updates",
    title: "9. Changes to these terms",
    body: "We may update these terms when legal, operational, or product changes require it. Updates are posted on this page with a revised date.",
  },
];

export default function Terms() {
  return (
    <section className="page terms-page legal-page">
      <div className="terms-shell">
        <header className="terms-hero">
          <div className="terms-hero-copy reveal" data-scroll style={{ "--delay": "0ms" }}>
            <p className="eyebrow">Terms of Service</p>
            <h1>Clear standards for using Faako products and services.</h1>
            <p className="lead">
              These terms explain service boundaries, account responsibilities,
              delivery expectations, and key legal protections for both sides.
            </p>
            <div className="terms-meta">
              <span>Effective date: February 11, 2026</span>
              <span>Last updated: February 11, 2026</span>
              <span>Applies to: Web, business systems, advisory, and support services</span>
            </div>
          </div>

          <aside className="terms-hero-panel reveal" data-scroll style={{ "--delay": "120ms" }}>
            <h2>At a glance</h2>
            <ul className="terms-glance-list">
              <li>
                <strong>Scope-driven delivery</strong>
                <span>Timelines and milestones follow your approved proposal.</span>
              </li>
              <li>
                <strong>Secure account use</strong>
                <span>You are responsible for login safety and account access control.</span>
              </li>
              <li>
                <strong>Fair service protection</strong>
                <span>Service protection and legal rules apply to all users.</span>
              </li>
            </ul>
          </aside>
        </header>

        <div className="terms-layout">
          <aside className="terms-nav card reveal" data-scroll style={{ "--delay": "80ms" }}>
            <h3>Sections</h3>
            {termsSections.map((section) => (
              <a key={section.id} href={`#${section.id}`}>
                {section.title}
              </a>
            ))}
            <a href="#terms-contact">10. Contact</a>
          </aside>

          <article className="terms-content">
            {termsSections.map((section, index) => (
              <section
                key={section.id}
                id={section.id}
                className="terms-section card reveal"
                data-scroll
                style={{ "--delay": `${120 + index * 50}ms` }}
              >
                <h2>{section.title}</h2>
                <p>{section.body}</p>
                {section.items ? (
                  <ul className="terms-list">
                    {section.items.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                ) : null}
              </section>
            ))}

            <section
              id="terms-contact"
              className="terms-section card reveal"
              data-scroll
              style={{ "--delay": "620ms" }}
            >
              <h2>10. Contact</h2>
              <p>
                Questions about these terms can be sent to{" "}
                <a href="mailto:legal@faako.nanaabaackah.com">
                  legal@faako.nanaabaackah.com
                </a>
                .
              </p>
              <p>
                For data handling details, read our{" "}
                <Link to="/privacy" className="text-link">
                  Privacy Policy
                </Link>
                .
              </p>
            </section>
          </article>
        </div>

        <footer className="terms-footer-note card reveal" data-scroll style={{ "--delay": "680ms" }}>
          <span>
            These terms are written to be clear and practical for real project delivery.
          </span>
          <Link to="/contact" className="button button-ghost">
            Contact support
          </Link>
        </footer>
      </div>
    </section>
  );
}
