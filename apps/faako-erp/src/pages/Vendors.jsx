import useDemoScenario from "../hooks/useDemoScenario.jsx";

export default function Vendors() {
  const { scenario } = useDemoScenario();
  const page = scenario.pages.vendors;

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
            {page.table.rows.map((vendor) => (
              <div className="table-row is-5" key={vendor.id}>
                <span className="table-strong">{vendor.name}</span>
                <span>{vendor.category}</span>
                <span>{vendor.rating}</span>
                <span>{vendor.leadTime}</span>
                <span
                  className={`status-pill ${
                    vendor.status === "Preferred" ? "is-success" : "is-warning"
                  }`}
                >
                  {vendor.status}
                </span>
              </div>
            ))}
          </div>
        </article>

        <div className="stack">
          <article className="panel glass-card">
            <div className="panel-header">
              <div>
                <h3>{page.approvalsTitle}</h3>
                <p className="muted">{page.approvalsCopy}</p>
              </div>
            </div>
            <div className="list">
              {page.approvals.map((item) => (
                <div className="list-row" key={item.id}>
                  <div className="table-strong">{item.title}</div>
                  <p className="muted">{item.detail}</p>
                  <span className="status-pill is-warning">{item.status}</span>
                </div>
              ))}
            </div>
          </article>

          <article className="panel glass-card">
            <div className="panel-header">
              <div>
                <h3>{page.renewalsTitle}</h3>
                <p className="muted">{page.renewalsCopy}</p>
              </div>
            </div>
            <div className="list">
              {page.renewals.map((item) => (
                <div className="list-row" key={item.id}>
                  <div className="table-strong">{item.title}</div>
                  <p className="muted">{item.detail}</p>
                  <span className="status-pill is-info">{item.status}</span>
                </div>
              ))}
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}
