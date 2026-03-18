export default function FaqSection({
  eyebrow = "FAQ",
  title = "Quick answers before you start",
  lead,
  items = [],
  className = "faq-section",
  headerScroll = false,
}) {
  const headerProps = headerScroll ? { "data-scroll": true } : {};

  return (
    <section className={className}>
      <div className="section-header reveal" {...headerProps}>
        <p className="eyebrow">{eyebrow}</p>
        <h2>{title}</h2>
        {lead ? <p className="lead">{lead}</p> : null}
      </div>
      <div className="faq-grid">
        {items.map((item, index) => (
          <details key={`${item.question}-${index}`} className="faq-item" open={item.open}>
            <summary>{item.question}</summary>
            <p>{item.answer}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
