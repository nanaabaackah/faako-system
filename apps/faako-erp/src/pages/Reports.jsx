import useDemoScenario from "../hooks/useDemoScenario.jsx";

export default function Reports() {
  const { scenario } = useDemoScenario();
  const page = scenario.pages.reports;

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

      <div className="panel-grid">
        {page.cards.map((card) => (
          <article className="panel bubble-card" key={card.id}>
            <h3>{card.title}</h3>
            <p className="muted">{card.detail}</p>
            <span className="status-pill is-info">{card.status}</span>
          </article>
        ))}
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
              <h3>{page.insightsTitle}</h3>
              <p className="muted">{page.insightsCopy}</p>
            </div>
          </div>
          <div className="bar-chart">
            {page.insightTrends.map((item) => (
              <div className="bar-row" key={item.id}>
                <div className="table-strong">
                  {item.label} <span className="muted">{item.value}</span>
                </div>
                <div className="bar-track">
                  <span className="bar-fill" style={{ width: `${item.fill}%` }} />
                </div>
              </div>
            ))}
          </div>
        </article>

        <div className="stack">
          <article className="panel glass-card">
            <div className="panel-header">
              <div>
                <h3>{page.workflowTitle}</h3>
                <p className="muted">{page.workflowCopy}</p>
              </div>
            </div>
            <div className="list">
              {page.workflowSignals.map((signal) => (
                <div className="list-row" key={signal.id}>
                  <div className="table-strong">{signal.title}</div>
                  <p className="muted">{signal.detail}</p>
                  <span className="status-pill is-warning">{signal.status}</span>
                </div>
              ))}
            </div>
          </article>

          <article className="panel glass-card">
            <div className="panel-header">
              <div>
                <h3>{page.automationTitle}</h3>
                <p className="muted">{page.automationCopy}</p>
              </div>
            </div>
            <div className="list">
              {page.automationRuns.map((run) => (
                <div className="list-row" key={run.id}>
                  <div className="table-strong">{run.title}</div>
                  <p className="muted">{run.detail}</p>
                  <span
                    className={`status-pill ${
                      run.status === "Paused" ? "is-warning" : "is-success"
                    }`}
                  >
                    {run.status}
                  </span>
                </div>
              ))}
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}
