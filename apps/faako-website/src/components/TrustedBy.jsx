import { useState } from "react";

const TrustedLogo = ({ logo }) => {
  const [failed, setFailed] = useState(false);
  const isObject = typeof logo === "object" && logo !== null;
  const label = isObject ? logo.name || logo.alt || "" : String(logo);
  const src = isObject ? logo.src : null;

  if (!src || failed) {
    return <span className="trust-logo">{label}</span>;
  }

  return (
    <span className="trust-logo">
      <img
        src={src}
        alt={logo.alt || label}
        loading="lazy"
        onError={() => setFailed(true)}
      />
    </span>
  );
};

export default function TrustedBy({
  eyebrow = "Trusted By",
  title = "Teams who run on Faako",
  lead,
  logos = [],
  className = "trust-strip",
  headerScroll = false,
  ariaLabel = "Trusted by",
}) {
  const headerProps = headerScroll ? { "data-scroll": true } : {};

  return (
    <section className={className}>
      <div className="section-header reveal" {...headerProps}>
        <p className="eyebrow">{eyebrow}</p>
        <h2>{title}</h2>
        {lead ? <p className="lead">{lead}</p> : null}
      </div>
      <div className="trust-logos" aria-label={ariaLabel}>
        {logos.map((logo, index) => {
          const key =
            typeof logo === "string"
              ? logo
              : logo?.name || logo?.alt || logo?.src || `logo-${index}`;
          return <TrustedLogo key={key} logo={logo} />;
        })}
      </div>
    </section>
  );
}
