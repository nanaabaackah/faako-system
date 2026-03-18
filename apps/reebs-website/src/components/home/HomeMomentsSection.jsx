import { REAL_PARTY_MOMENTS } from "/src/components/home/homeContent";

function HomeMomentsSection() {
  return (
    <section className="home-flow home-flow--moments">
      <div className="container">
        <div className="section-header">
          <h2 className="section-title">What Clients Say After The Event</h2>
          <p className="section-description">
            Quick notes from families and teams who have booked with REEBS.
          </p>
        </div>

        <ul className="moments-list" role="list">
          {REAL_PARTY_MOMENTS.map((moment) => (
            <li key={`${moment.name}-${moment.event}`} className="moment-row">
              <p className="moment-quote">“{moment.quote}”</p>
              <p className="moment-meta">{moment.name} · {moment.event}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export default HomeMomentsSection;
