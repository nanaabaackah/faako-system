import useDemoScenario from "../hooks/useDemoScenario.jsx";

export default function Inventory() {
  const { scenario } = useDemoScenario();
  const page = scenario.pages.inventory;

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
              <h3>{page.watchlistTitle}</h3>
              <p className="muted">{page.watchlistCopy}</p>
            </div>
          </div>
          <div className="list">
            {page.watchlist.map((item) => (
              <div className="list-row" key={item.id}>
                <div className="table-strong">{item.name}</div>
                <p className="muted">
                  {item.onHand} on hand &bull; Target {item.target}
                </p>
                <div className="progress">
                  <span style={{ width: `${item.fill}%` }} />
                </div>
                <span className="status-pill is-warning">{item.status}</span>
              </div>
            ))}
          </div>
        </article>

        <div className="stack">
          <article className="panel glass-card">
            <div className="panel-header">
              <div>
                <h3>{page.locationsTitle}</h3>
                <p className="muted">{page.locationsCopy}</p>
              </div>
            </div>
            <div className="list">
              {page.locations.map((location) => (
                <div className="list-row" key={location.id}>
                  <div className="table-strong">{location.name}</div>
                  <p className="muted">{location.detail}</p>
                  <div className="progress">
                    <span style={{ width: `${location.fill}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </article>

          <article className="panel glass-card">
            <div className="panel-header">
              <div>
                <h3>{page.movementsTitle}</h3>
                <p className="muted">{page.movementsCopy}</p>
              </div>
            </div>
            <div className="data-table">
              <div className="table-row table-head is-5">
                {page.movementColumns.map((col) => (
                  <span key={col}>{col}</span>
                ))}
              </div>
              {page.movements.map((move) => (
                <div className="table-row is-5" key={move.id}>
                  <span className="table-strong">{move.sku}</span>
                  <span>{move.type}</span>
                  <span className="table-strong">{move.qty}</span>
                  <span>{move.location}</span>
                  <span>{move.time}</span>
                </div>
              ))}
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}
