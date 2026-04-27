import useDemoScenario from "../hooks/useDemoScenario.jsx";

export default function Finance() {
  const { scenario } = useDemoScenario();
  const page = scenario.pages.finance;

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
            {page.table.rows.map((tx) => (
              <div className="table-row is-5" key={tx.id}>
                <span className="table-strong">{tx.id}</span>
                <span>{tx.name}</span>
                <span>{tx.type}</span>
                <span className="table-strong">{tx.amount}</span>
                <span>{tx.date}</span>
              </div>
            ))}
          </div>
        </article>

        <div className="stack">
          <article className="panel glass-card">
            <div className="panel-header">
              <div>
                <h3>{page.invoicesTitle}</h3>
                <p className="muted">{page.invoicesCopy}</p>
              </div>
            </div>
            <div className="list">
              {page.invoices.map((invoice) => (
                <div className="list-row" key={invoice.id}>
                  <div className="table-strong">{invoice.customer}</div>
                  <p className="muted">
                    {invoice.id} &bull; {invoice.due}
                  </p>
                  <div className="table-strong">{invoice.amount}</div>
                  <span className="status-pill is-warning">{invoice.status}</span>
                </div>
              ))}
            </div>
          </article>

          <article className="panel glass-card">
            <div className="panel-header">
              <div>
                <h3>{page.mixTitle}</h3>
                <p className="muted">{page.mixCopy}</p>
              </div>
            </div>
            <div className="list">
              {page.revenueMix.map((mix) => (
                <div className="list-row" key={mix.id}>
                  <div className="table-strong">{mix.label}</div>
                  <p className="muted">{mix.value}</p>
                  <div className="progress">
                    <span style={{ width: `${mix.fill}%` }} />
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
