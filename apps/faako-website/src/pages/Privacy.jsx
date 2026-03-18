import { Link } from "react-router-dom";
import "../styles/pages/Legal.css";

const dataGroups = [
  {
    title: "Information you provide",
    items: [
      "Name, work email, phone number, company, and role.",
      "Project details, planning notes, and uploaded files.",
      "Billing and invoicing details submitted for contracts.",
      "Messages sent through support and contact forms.",
    ],
  },
  {
    title: "Information collected automatically",
    items: [
      "Device, browser, and operating system metadata.",
      "Usage events, log files, and diagnostics.",
      "Approximate location derived from IP address.",
      "Cookie and tracker preferences saved on your device.",
    ],
  },
];

const processingRows = [
  {
    purpose: "Deliver projects and configured features",
    basis: "Contract performance",
    retention: "Project lifecycle and support window",
  },
  {
    purpose: "Account management and customer support",
    basis: "Contract performance and legitimate interests",
    retention: "Up to 36 months after the last activity",
  },
  {
    purpose: "Security monitoring, fraud prevention, and abuse detection",
    basis: "Legitimate interests and legal obligations",
    retention: "6 to 24 months depending on risk logs",
  },
  {
    purpose: "Service analytics and performance improvement",
    basis: "Legitimate interests and consent (where required)",
    retention: "Up to 24 months in grouped form",
  },
  {
    purpose: "Accounting, tax, and compliance records",
    basis: "Legal obligation",
    retention: "As required by applicable law",
  },
];

const userRights = [
  {
    title: "Access",
    detail: "Ask for a copy of the personal data we hold about you.",
  },
  {
    title: "Correction",
    detail: "Request updates to inaccurate or incomplete information.",
  },
  {
    title: "Deletion",
    detail: "Request deletion when data is no longer needed or legally required.",
  },
  {
    title: "Restriction",
    detail: "Ask us to limit processing in specific circumstances.",
  },
  {
    title: "Objection",
    detail: "Object to processing based on legitimate interests.",
  },
  {
    title: "Portability",
    detail: "Receive your data in a structured, machine-readable format.",
  },
];

export default function Privacy() {
  return (
    <section className="page privacy-page legal-page">
      <div className="privacy-shell">
        <header className="privacy-hero">
          <div className="privacy-hero-copy reveal" data-scroll style={{ "--delay": "0ms" }}>
          <p className="eyebrow">Privacy Policy</p>
          <h1>Your data, handled with clarity and control.</h1>
          <p className="lead">
            This policy explains what information we collect, why we process
            it, the legal basis we use, and how you can exercise your
            rights.
          </p>
            <div className="privacy-meta">
              <span>Effective date: February 11, 2026</span>
              <span>Last updated: February 11, 2026</span>
              <span>Region: Global operations</span>
            </div>
            <div className="privacy-chip-row">
              <span>No personal data sales</span>
              <span>Role-based access controls</span>
              <span>Support for deletion and data export requests</span>
            </div>
          </div>

          <aside className="privacy-hero-panel reveal" data-scroll style={{ "--delay": "120ms" }}>
            <h2>Data controller</h2>
            <p>
              Faako Systems &amp; Consulting is the entity responsible for
              deciding how and why personal data is processed under this policy.
            </p>
            <dl>
              <div>
                <dt>Email</dt>
                <dd>
                  <a href="mailto:privacy@faako.nanaabaackah.com">
                    privacy@faako.nanaabaackah.com
                  </a>
                </dd>
              </div>
              <div>
                <dt>Support</dt>
                <dd>Monday to Friday, 9:00 AM to 6:00 PM GMT</dd>
              </div>
              <div>
                <dt>Primary location</dt>
                <dd>Accra, Ghana</dd>
              </div>
            </dl>
          </aside>
        </header>

        <div className="privacy-layout">
          <aside className="privacy-nav card reveal" data-scroll style={{ "--delay": "80ms" }}>
            <h3>Sections</h3>
            <a href="#privacy-summary">1. Summary</a>
            <a href="#privacy-collect">2. Data we collect</a>
            <a href="#privacy-purpose">3. Purpose and legal basis</a>
            <a href="#privacy-sharing">4. Sharing and transfers</a>
            <a href="#privacy-cookies">5. Cookies and trackers</a>
            <a href="#privacy-retention">6. Retention</a>
            <a href="#privacy-rights">7. Your rights</a>
            <a href="#privacy-security">8. Security controls</a>
            <a href="#privacy-updates">9. Policy updates</a>
            <a href="#privacy-contact">10. Contact</a>
          </aside>

          <article className="privacy-content">
            <section
              id="privacy-summary"
              className="privacy-section card reveal"
              data-scroll
              style={{ "--delay": "120ms" }}
            >
              <h2>1. In short</h2>
              <p>
                We collect only data that is relevant to service delivery,
                account management, support, security, and legal compliance. We
                do not sell personal data to third parties.
              </p>
              <ul className="privacy-list">
                <li>We process data using clear legal grounds.</li>
                <li>We limit access to authorized personnel and vendors.</li>
                <li>You can request access, correction, deletion, or export.</li>
              </ul>
            </section>

            <section
              id="privacy-collect"
              className="privacy-section card reveal"
              data-scroll
              style={{ "--delay": "170ms" }}
            >
              <h2>2. Categories of personal data</h2>
              <p>
                The exact data processed depends on the services you use and
                how you interact with our website and support channels.
              </p>
              <div className="privacy-data-grid">
                {dataGroups.map((group) => (
                  <article key={group.title} className="privacy-data-card">
                    <h3>{group.title}</h3>
                    <ul className="privacy-list">
                      {group.items.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </article>
                ))}
              </div>
            </section>

            <section
              id="privacy-purpose"
              className="privacy-section card reveal"
              data-scroll
              style={{ "--delay": "220ms" }}
            >
              <h2>3. Purpose and legal basis</h2>
              <p>
                We process personal data only when there is a defined purpose
                and an appropriate legal basis under applicable privacy law.
              </p>
              <div className="privacy-table-wrap">
                <table className="privacy-table">
                  <thead>
                    <tr>
                      <th scope="col">Processing purpose</th>
                      <th scope="col">Legal basis</th>
                      <th scope="col">Retention snapshot</th>
                    </tr>
                  </thead>
                  <tbody>
                    {processingRows.map((row) => (
                      <tr key={row.purpose}>
                        <td>{row.purpose}</td>
                        <td>{row.basis}</td>
                        <td>{row.retention}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section
              id="privacy-sharing"
              className="privacy-section card reveal"
              data-scroll
              style={{ "--delay": "270ms" }}
            >
              <h2>4. Sharing and international transfers</h2>
              <p>
                We share data only with service providers that help us operate
                infrastructure, communications, analytics, billing, and support.
              </p>
              <ul className="privacy-list">
                <li>All providers are contractually bound to protect data.</li>
                <li>Access is limited to data required for their service scope.</li>
                <li>
                  Cross-border transfers use contractual and organizational
                  safeguards.
                </li>
              </ul>
            </section>

            <section
              id="privacy-cookies"
              className="privacy-section card reveal"
              data-scroll
              style={{ "--delay": "320ms" }}
            >
              <h2>5. Cookies and tracking technologies</h2>
              <p>
                We use essential cookies for security and session continuity,
                and optional analytics cookies to improve site performance.
              </p>
              <ul className="privacy-list">
                <li>
                  Essential cookies cannot be disabled because they are required
                  for core functionality.
                </li>
                <li>
                  Optional analytics preferences can be changed at any time.
                </li>
                <li>
                  Browser-level controls can also be used to block or clear
                  cookies.
                </li>
              </ul>
            </section>

            <section
              id="privacy-retention"
              className="privacy-section card reveal"
              data-scroll
              style={{ "--delay": "370ms" }}
            >
              <h2>6. Data retention</h2>
              <p>
                We retain data only for the period necessary to fulfill the
                processing purpose, then securely delete or anonymize it unless
                longer retention is required by law.
              </p>
              <p>
                Retention periods vary by category, such as support logs,
                security events, project files, and financial records.
              </p>
            </section>

            <section
              id="privacy-rights"
              className="privacy-section card reveal"
              data-scroll
              style={{ "--delay": "420ms" }}
            >
              <h2>7. Your rights</h2>
              <p>
                Depending on your location, you may exercise the following
                rights regarding your personal data:
              </p>
              <div className="privacy-rights-grid">
                {userRights.map((right) => (
                  <article key={right.title} className="privacy-right-item">
                    <strong>{right.title}</strong>
                    <span>{right.detail}</span>
                  </article>
                ))}
              </div>
            </section>

            <section
              id="privacy-security"
              className="privacy-section card reveal"
              data-scroll
              style={{ "--delay": "470ms" }}
            >
              <h2>8. Security controls</h2>
              <p>
                We maintain administrative, technical, and operational controls
                that help protect data from unauthorized access, misuse, and
                loss.
              </p>
              <ul className="privacy-list">
                <li>Role-based access, credential controls, and monitoring.</li>
                <li>Encrypted transport for data in transit.</li>
                <li>Security reviews and incident response procedures.</li>
              </ul>
            </section>

            <section
              id="privacy-updates"
              className="privacy-section card reveal"
              data-scroll
              style={{ "--delay": "520ms" }}
            >
              <h2>9. Policy updates</h2>
              <p>
                We may update this policy to reflect service, regulatory, or
                operational changes. Updated versions are posted on this page
                with a revised date.
              </p>
            </section>

            <section
              id="privacy-contact"
              className="privacy-section card reveal"
              data-scroll
              style={{ "--delay": "570ms" }}
            >
              <h2>10. Contact and requests</h2>
              <p>
                To submit a privacy request, email{" "}
                <a href="mailto:privacy@faako.nanaabaackah.com">
                  privacy@faako.nanaabaackah.com
                </a>{" "}
                with the subject line <strong>Privacy Request</strong>.
              </p>
              <p>
                You can also review our{" "}
                <Link to="/terms" className="text-link">
                  Terms of Service
                </Link>{" "}
                for related legal terms.
              </p>
            </section>
          </article>
        </div>
      </div>
    </section>
  );
}
