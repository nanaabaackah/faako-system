import React from "react";

const DEFAULT_CONTACT_LINKS = [
  {
    href: "mailto:info@reebspartythemes.com",
    label: "info@reebspartythemes.com",
  },
  {
    href: "https://wa.me/233244238419",
    label: "WhatsApp: +233 244 238 419",
    external: true,
  },
  {
    href: "tel:+233244238419",
    label: "+233 24 423 8419",
  },
];

function LegalDocumentPage({
  title,
  lastUpdated,
  intro,
  marketNote,
  sections = [],
  contactHeading = "Questions about this document?",
  contactBody = "Contact REEBS and we will clarify the policy that applies to your booking or order.",
  contactLinks = DEFAULT_CONTACT_LINKS,
}) {
  return (
    <main className="legal-page" role="main" id="main">
      <div className="legal-shell">
        <header className="legal-header">
          <p className="legal-eyebrow">REEBS Party Themes</p>
          <h1>{title}</h1>
          <p className="legal-updated">Last updated: {lastUpdated}</p>
          <p className="legal-intro">{intro}</p>
          {marketNote ? <p className="legal-market-note">{marketNote}</p> : null}
        </header>

        <nav className="legal-toc" aria-label={`${title} contents`}>
          <p className="legal-toc-label">Contents</p>
          <ol className="legal-toc-list">
            {sections.map((section, index) => (
              <li key={section.id}>
                <a href={`#${section.id}`}>
                  {section.label || `${index + 1}.`} {section.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="legal-content">
          {sections.map((section, index) => (
            <section
              key={section.id}
              id={section.id}
              className="legal-section"
              aria-labelledby={`${section.id}-heading`}
            >
              <p className="legal-section-label">{section.label || `${index + 1}.`}</p>
              <h2 id={`${section.id}-heading`}>{section.title}</h2>
              {section.summary ? (
                <p className="legal-section-summary">{section.summary}</p>
              ) : null}
              {Array.isArray(section.paragraphs)
                ? section.paragraphs.map((paragraph) => (
                    <p key={paragraph}>{paragraph}</p>
                  ))
                : null}
              {Array.isArray(section.items) && section.items.length ? (
                <ul>
                  {section.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              ) : null}
            </section>
          ))}
        </div>

        <section className="legal-contact" aria-labelledby="legal-contact-heading">
          <h2 id="legal-contact-heading">{contactHeading}</h2>
          <p>{contactBody}</p>
          <div className="legal-contact-links">
            {contactLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                target={link.external ? "_blank" : undefined}
                rel={link.external ? "noopener noreferrer" : undefined}
              >
                {link.label}
              </a>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}

export default LegalDocumentPage;
