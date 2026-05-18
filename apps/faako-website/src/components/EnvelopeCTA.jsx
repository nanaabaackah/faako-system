import { Link } from "react-router-dom";
import { ArrowRight, Chart, Box, Calendar, Card } from "iconsax-react";
import "../styles/components/EnvelopeCTA.css";

const previewItems = [
  {
    icon: Box,
    label: "Inventory",
    value: "248 items",
  },
  {
    icon: Calendar,
    label: "Bookings",
    value: "12 active",
  },
  {
    icon: Card,
    label: "Payments",
    value: "82% paid",
  },
  {
    icon: Chart,
    label: "Reports",
    value: "Ready",
  },
];

export default function EnvelopeCTA({
  eyebrow = "Your workflow. Always clear.",
  title = "Build a system your business can actually use",
  text = "Start with the tools your team needs today and grow from there.",
  primaryLabel = "Request Demo",
  primaryTo = "/contact",
  secondaryLabel = "View Solutions",
  secondaryTo = "/solutions",
}) {
  return (
    <section className="envelope-cta" aria-labelledby="envelope-cta-title">
      <div className="envelope-cta__stage">
        <div className="envelope-cta__visual envelope-cta__visual--one" aria-hidden="true">
          <span>Stock</span>
          <strong>96%</strong>
          <small>accuracy</small>
        </div>

        <div className="envelope-cta__visual envelope-cta__visual--two" aria-hidden="true">
          <span>Today</span>
          <strong>36</strong>
          <small>orders logged</small>
        </div>

        <div className="envelope-cta__visual envelope-cta__visual--three" aria-hidden="true">
          <span>Team</span>
          <strong>89%</strong>
          <small>usage</small>
        </div>

        <div className="envelope-cta__card">
          <p className="envelope-cta__eyebrow">{eyebrow}</p>

          <h2 id="envelope-cta-title">{title}</h2>

          <p className="envelope-cta__text">{text}</p>

          <div className="envelope-cta__actions">
            <Link className="button button-primary" to={primaryTo}>
              {primaryLabel}
              <ArrowRight size="18" aria-hidden="true" />
            </Link>

            <Link className="button button-ghost" to={secondaryTo}>
              {secondaryLabel}
            </Link>
          </div>
        </div>

        <div className="envelope-cta__preview" aria-hidden="true">
          {previewItems.map((item) => {
            const Icon = item.icon;

            return (
              <article key={item.label}>
                <Icon size="20" />
                <div>
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}