import { useState } from "react";
import useDemoScenario from "../hooks/useDemoScenario.jsx";

export default function Dashboard() {
  const { scenario } = useDemoScenario();
  const page = scenario.pages.dashboard;
  const [ordersView, setOrdersView] = useState("today");
  const orders = page.orderSets[ordersView];
  const dateLabel = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date());

  return (
    <section className="page dashboard">
      <div className="panel glass-card dashboard-hero">
        <div>
          <p className="eyebrow">{page.heroEyebrow}</p>
          <h1>{page.heroTitle}</h1>
          <p className="muted">
            {dateLabel} &bull; {page.heroMeta}
          </p>
        </div>
        <div className="hero-actions">
          <a className="button button-primary" href="/modules">
            {page.primaryActionLabel}
          </a>
          <a className="button button-ghost" href="/reports">
            {page.secondaryActionLabel}
          </a>
        </div>
      </div>

      <div className="kpi-grid">
        {page.kpis.map((kpi) => (
          <article className="panel kpi-card bubble-card" key={kpi.id}>
            <span className="kpi-label">{kpi.label}</span>
            <div className="kpi-value">{kpi.value}</div>
            <span className={`kpi-delta is-${kpi.tone}`}>{kpi.delta}</span>
          </article>
        ))}
      </div>

      <section className="panel glass-card">
        <div className="panel-header">
          <div>
            <h3>{page.modulesTitle}</h3>
            <p className="muted">{page.modulesCopy}</p>
          </div>
          <a className="button button-ghost" href="/modules">
            See all modules
          </a>
        </div>
        <div className="quick-access-grid">
          {scenario.modules.featuredModules.slice(0, 6).map((module) => (
            <a className="module-card quick-access-card bubble-card" href={module.path} key={module.id}>
              <span className="eyebrow">{module.metric}</span>
              <div className="table-strong">{module.title}</div>
              <p className="muted">{module.summary}</p>
              <span className={`status-pill is-${module.tone}`}>{module.status}</span>
            </a>
          ))}
        </div>
      </section>

      <div className="dashboard-grid">
        <article className="panel glass-card panel-span-2">
          <div className="panel-header">
            <div>
              <h3>{page.ordersTitle}</h3>
              <p className="muted">{page.ordersCopy}</p>
            </div>
            <div className="segmented">
              <button
                className={`segment ${ordersView === "today" ? "is-active" : ""}`}
                type="button"
                onClick={() => setOrdersView("today")}
              >
                {page.ordersViewLabels.today}
              </button>
              <button
                className={`segment ${ordersView === "week" ? "is-active" : ""}`}
                type="button"
                onClick={() => setOrdersView("week")}
              >
                {page.ordersViewLabels.week}
              </button>
            </div>
          </div>
          <div className="data-table">
            <div className="table-row table-head">
              <span>Ref</span>
              <span>Customer</span>
              <span>Owner</span>
              <span>Due</span>
              <span>Status</span>
              <span>Total</span>
            </div>
            {orders.map((order) => (
              <div className="table-row" key={order.id}>
                <span className="table-strong">{order.id}</span>
                <span>{order.customer}</span>
                <span>{order.owner}</span>
                <span>{order.due}</span>
                <span className="status-pill">{order.status}</span>
                <span className="table-strong">{order.total}</span>
              </div>
            ))}
          </div>
        </article>

        <article className="panel glass-card">
          <div className="panel-header">
            <div>
              <h3>{page.inventoryTitle}</h3>
              <p className="muted">{page.inventoryCopy}</p>
            </div>
          </div>
          <div className="stack">
            {page.inventoryWatchlist.map((item) => (
              <div className="stack-row" key={item.id}>
                <div>
                  <div className="table-strong">{item.item}</div>
                  <p className="muted">
                    {item.onHand} on hand &bull; Target {item.target}
                  </p>
                </div>
                <div className="progress">
                  <span style={{ width: `${item.fill}%` }} />
                </div>
                <span className="status-pill is-warning">{item.status}</span>
              </div>
            ))}
          </div>
        </article>

        <article className="panel glass-card">
          <div className="panel-header">
            <div>
              <h3>{page.scheduleTitle}</h3>
              <p className="muted">{page.scheduleCopy}</p>
            </div>
          </div>
          <div className="timeline">
            {page.schedule.map((shift) => (
              <div className="timeline-row" key={shift.id}>
                <span className="timeline-time">{shift.time}</span>
                <div>
                  <div className="table-strong">{shift.title}</div>
                  <p className="muted">{shift.team}</p>
                </div>
                <span className="status-pill">{shift.status}</span>
              </div>
            ))}
          </div>
        </article>

        <article className="panel glass-card">
          <div className="panel-header">
            <div>
              <h3>{page.approvalsTitle}</h3>
              <p className="muted">{page.approvalsCopy}</p>
            </div>
          </div>
          <div className="stack">
            {page.approvals.map((item) => (
              <div className="stack-row" key={item.id}>
                <div>
                  <div className="table-strong">{item.title}</div>
                  <p className="muted">{item.meta}</p>
                </div>
                <span
                  className={`priority ${item.priority === "Urgent" ? "is-urgent" : "is-normal"}`}
                >
                  {item.priority}
                </span>
              </div>
            ))}
          </div>
        </article>

        <article className="panel glass-card">
          <div className="panel-header">
            <div>
              <h3>{page.cashflowTitle}</h3>
              <p className="muted">{page.cashflowCopy}</p>
            </div>
          </div>
          <div className="stack">
            {page.cashflow.map((item) => (
              <div className="stack-row" key={item.id}>
                <div>
                  <div className="table-strong">{item.label}</div>
                  <p className="muted">{item.value}</p>
                </div>
                <div className="progress">
                  <span style={{ width: `${item.fill}%` }} />
                </div>
              </div>
            ))}
          </div>
        </article>
      </div>

      <section className="workflow-grid">
        {scenario.modules.journeys.map((journey) => (
          <article className="panel glass-card bubble-card workflow-card" key={journey.id}>
            <p className="eyebrow">Connected workflow</p>
            <h3>{journey.title}</h3>
            <p className="muted">{journey.summary}</p>
            <div className="pill-group">
              {journey.modules.map((module) => (
                <span className="status-pill" key={module}>
                  {module}
                </span>
              ))}
            </div>
          </article>
        ))}
      </section>
    </section>
  );
}
