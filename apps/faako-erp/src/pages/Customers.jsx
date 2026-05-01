import useDemoScenario from "../hooks/useDemoScenario.jsx";

export default function Customers() {
  const { scenario } = useDemoScenario();
  const page = scenario.pages.customers;

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
              {page.table.columns.map((column) => (
                <span key={column}>{column}</span>
              ))}
            </div>
            {page.table.rows.map((account) => (
              <div className="table-row is-5" key={account.id}>
                <span className="table-strong">{account.name}</span>
                <span>{account.owner}</span>
                <span>{account.tier}</span>
                <span
                  className={`status-pill ${
                    account.health === "Healthy" ? "is-success" : "is-warning"
                  }`}
                >
                  {account.health}
                </span>
                <span>{account.lastTouch}</span>
              </div>
            ))}
          </div>
        </article>

        <div className="stack">
          <article className="panel glass-card">
            <div className="panel-header">
              <div>
                <h3>{page.signalsTitle}</h3>
                <p className="muted">{page.signalsCopy}</p>
              </div>
            </div>
            <div className="list">
              {page.healthSignals.map((signal) => (
                <div className="list-row" key={signal.id}>
                  <div className="table-strong">{signal.label}</div>
                  <p className="muted">{signal.detail}</p>
                  <span
                    className={`status-pill ${
                      signal.status === "Positive"
                        ? "is-success"
                        : signal.status === "Upcoming"
                        ? "is-info"
                        : "is-warning"
                    }`}
                  >
                    {signal.status}
                  </span>
                </div>
              ))}
            </div>
          </article>

          <article className="panel glass-card">
            <div className="panel-header">
              <div>
                <h3>{page.pipelineTitle}</h3>
                <p className="muted">{page.pipelineCopy}</p>
              </div>
            </div>
            <div className="list">
              {page.pipelineStages.map((stage) => (
                <div className="list-row" key={stage.id}>
                  <div className="table-strong">{stage.label}</div>
                  <p className="muted">{stage.value}</p>
                  <div className="progress">
                    <span style={{ width: `${stage.fill}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}
