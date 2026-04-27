import useDemoScenario from "../hooks/useDemoScenario.jsx";

export default function Bookings() {
  const { scenario } = useDemoScenario();
  const page = scenario.pages.bookings;

  return (
    <section className="page">
      <div className="page-header">
        <div>
          <h1>{page.title}</h1>
          <p className="muted">{page.description}</p>
        </div>
        <div className="header-actions">
          <button className="button button-primary" type="button">
            {page.actions.primary}
          </button>
          <button className="button button-ghost" type="button">
            {page.actions.secondary}
          </button>
        </div>
      </div>

      <div className="kpi-grid">
        {page.stats.map((stat) => (
          <article className="panel kpi-card bubble-card" key={stat.id}>
            <span className="kpi-label">{stat.label}</span>
            <div className="kpi-value">{stat.value}</div>
            <span className={`kpi-delta is-${stat.tone}`}>{stat.delta}</span>
          </article>
        ))}
      </div>

      <div className="page-grid">
        <article className="panel glass-card">
          <div className="panel-header">
            <div>
              <h3>{page.table.title}</h3>
              <p className="muted">{page.table.description}</p>
            </div>
          </div>
          <div className="data-table">
            <div className="table-row table-head is-5">
              {page.table.columns.map((col) => (
                <span key={col}>{col}</span>
              ))}
            </div>
            {page.table.rows.map((booking) => (
              <div className="table-row is-5" key={booking.id}>
                <span className="table-strong">{booking.id}</span>
                <span>{booking.customer}</span>
                <span>{booking.date}</span>
                <span>{booking.asset}</span>
                <span
                  className={`status-pill ${
                    booking.status === "Confirmed" ? "is-success" : "is-warning"
                  }`}
                >
                  {booking.status}
                </span>
              </div>
            ))}
          </div>
        </article>

        <div className="stack">
          <article className="panel glass-card">
            <div className="panel-header">
              <div>
                <h3>{page.resourcesTitle}</h3>
                <p className="muted">{page.resourcesCopy}</p>
              </div>
            </div>
            <div className="list">
              {page.resourceBlocks.map((block) => (
                <div className="list-row" key={block.id}>
                  <div className="table-strong">{block.time}</div>
                  <p className="muted">{block.detail}</p>
                  <span className="status-pill is-info">{block.status}</span>
                </div>
              ))}
            </div>
          </article>

          <article className="panel glass-card">
            <div className="panel-header">
              <div>
                <h3>{page.crewTitle}</h3>
                <p className="muted">{page.crewCopy}</p>
              </div>
            </div>
            <div className="list">
              {page.crewAssignments.map((crew) => (
                <div className="list-row" key={crew.id}>
                  <div className="table-strong">{crew.name}</div>
                  <p className="muted">{crew.detail}</p>
                  <span className="status-pill is-info">{crew.status}</span>
                </div>
              ))}
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}
