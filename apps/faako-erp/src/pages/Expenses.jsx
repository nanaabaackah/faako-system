import useDemoScenario from "../hooks/useDemoScenario.jsx";

export default function Expenses() {
  const { scenario } = useDemoScenario();
  const page = scenario.pages.expenses;

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
            {page.table.rows.map((expense) => (
              <div className="table-row is-5" key={expense.id}>
                <span className="table-strong">{expense.id}</span>
                <span>{expense.category}</span>
                <span>{expense.submittedBy}</span>
                <span className="table-strong">{expense.amount}</span>
                <span
                  className={`status-pill ${
                    expense.status === "Approved"
                      ? "is-success"
                      : expense.status === "Flagged"
                      ? "is-danger"
                      : "is-warning"
                  }`}
                >
                  {expense.status}
                </span>
              </div>
            ))}
          </div>
        </article>

        <div className="stack">
          <article className="panel glass-card">
            <div className="panel-header">
              <div>
                <h3>{page.alertsTitle}</h3>
                <p className="muted">{page.alertsCopy}</p>
              </div>
            </div>
            <div className="list">
              {page.policyAlerts.map((alert) => (
                <div className="list-row" key={alert.id}>
                  <div className="table-strong">{alert.title}</div>
                  <p className="muted">{alert.detail}</p>
                  <span className="status-pill is-danger">{alert.status}</span>
                </div>
              ))}
            </div>
          </article>

          <article className="panel glass-card">
            <div className="panel-header">
              <div>
                <h3>{page.limitsTitle}</h3>
                <p className="muted">{page.limitsCopy}</p>
              </div>
            </div>
            <div className="list">
              {page.cardLimits.map((card) => (
                <div className="list-row" key={card.id}>
                  <div className="table-strong">{card.title}</div>
                  <p className="muted">{card.detail}</p>
                  <div className="progress">
                    <span style={{ width: `${card.fill}%` }} />
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
