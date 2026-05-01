import useDemoScenario from "../hooks/useDemoScenario.jsx";

export default function Orders() {
  const { scenario } = useDemoScenario();
  const page = scenario.pages.orders;

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
            <div className="table-row table-head is-7">
              {page.table.columns.map((column) => (
                <span key={column}>{column}</span>
              ))}
            </div>
            {page.table.rows.map((order) => (
              <div className="table-row is-7" key={order.id}>
                <span className="table-strong">{order.id}</span>
                <span>{order.customer}</span>
                <span>{order.channel}</span>
                <span>{order.owner}</span>
                <span>{order.due}</span>
                <span className={`status-pill is-${order.statusTone}`}>
                  {order.status}
                </span>
                <span className="table-strong">{order.total}</span>
              </div>
            ))}
          </div>
        </article>

        <div className="stack">
          <article className="panel glass-card">
            <div className="panel-header">
              <div>
                <h3>{page.queueTitle}</h3>
                <p className="muted">{page.queueCopy}</p>
              </div>
            </div>
            <div className="list">
              {page.queue.map((item) => (
                <div className="list-row" key={item.id}>
                  <div className="table-strong">{item.title}</div>
                  <p className="muted">{item.meta}</p>
                  <span className="status-pill is-info">{item.eta}</span>
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
              {page.pipeline.map((stage) => (
                <div className="list-row" key={stage.id}>
                  <div className="table-strong">{stage.label}</div>
                  <p className="muted">
                    {stage.value} active - {stage.detail}
                  </p>
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
