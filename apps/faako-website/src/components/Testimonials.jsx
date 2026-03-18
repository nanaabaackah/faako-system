export default function Testimonials({
  eyebrow = "Client Love",
  title = "Operators feel the difference",
  lead,
  items = [],
  className = "section testimonials",
  headerScroll = false,
  cardScroll = false,
}) {
  const headerProps = headerScroll ? { "data-scroll": true } : {};
  const cardProps = cardScroll ? { "data-scroll": true } : {};
  const cardClassName = `testimonial-card reveal${
    cardScroll ? " scroll-reveal" : ""
  }`;

  return (
    <section className={className}>
      <div className="section-header reveal" {...headerProps}>
        <p className="eyebrow">{eyebrow}</p>
        <h2>{title}</h2>
        {lead ? <p className="lead">{lead}</p> : null}
      </div>
      <div className="testimonial-grid">
        {items.map((item, index) => (
          <article
            key={`${item.author}-${index}`}
            className={cardClassName}
            style={item.delay ? { "--delay": item.delay } : undefined}
            {...cardProps}
          >
            <p>{item.quote}</p>
            <span>{item.author}</span>
          </article>
        ))}
      </div>
    </section>
  );
}
