const reportCards = [
  {
    id: "insights",
    title: "Insights",
    detail: "Margins, sell-through, and capacity signals.",
    status: "Live"
  },
  {
    id: "workflow",
    title: "Workflow",
    detail: "Approvals, tasks, and handoffs across teams.",
    status: "Tracked"
  },
  {
    id: "automation",
    title: "Automation",
    detail: "Triggers and routines keeping ops moving.",
    status: "Running"
  }
];

const reportStats = [
  {
    id: "margin",
    label: "Gross margin",
    value: "42%",
    delta: "+2.1% QoQ",
    tone: "positive"
  },
  {
    id: "sla",
    label: "Fulfillment SLA",
    value: "96%",
    delta: "2 late orders",
    tone: "warning"
  },
  {
    id: "automation",
    label: "Automation coverage",
    value: "78%",
    delta: "12 routines active",
    tone: "positive"
  }
];

const insightTrends = [
  { id: "jan", label: "Jan", value: "$42k", fill: 45 },
  { id: "feb", label: "Feb", value: "$48k", fill: 52 },
  { id: "mar", label: "Mar", value: "$58k", fill: 62 },
  { id: "apr", label: "Apr", value: "$64k", fill: 70 },
  { id: "may", label: "May", value: "$72k", fill: 82 }
];

const workflowSignals = [
  {
    id: "signal-1",
    title: "Purchase approvals",
    detail: "4 awaiting finance review",
    status: "Queued"
  },
  {
    id: "signal-2",
    title: "Dispatch tasks",
    detail: "12 tasks completed today",
    status: "On track"
  },
  {
    id: "signal-3",
    title: "Returns follow-up",
    detail: "3 tickets need closure",
    status: "Attention"
  }
];

const automationRuns = [
  {
    id: "auto-1",
    title: "Low stock reorder",
    detail: "Triggered 2 hours ago",
    status: "Success"
  },
  {
    id: "auto-2",
    title: "Invoice reminders",
    detail: "Scheduled daily at 9:00",
    status: "Active"
  },
  {
    id: "auto-3",
    title: "Shift coverage alert",
    detail: "Last run yesterday",
    status: "Paused"
  }
];

export default function Reports() {
  return (
    <section className="page">
      <div className="page-header">
        <div>
          <h1>Reports</h1>
          <p className="muted">
            Insights, workflow health, and automation coverage in one view.
          </p>
        </div>
        <div className="header-actions">
          <button className="button button-primary" type="button">
            Export report
          </button>
          <button className="button button-ghost" type="button">
            Share snapshot
          </button>
        </div>
      </div>

      <div className="panel-grid">
        {reportCards.map((card) => (
          <article className="panel" key={card.id}>
            <h3>{card.title}</h3>
            <p className="muted">{card.detail}</p>
            <span className="status-pill is-info">{card.status}</span>
          </article>
        ))}
      </div>

      <div className="kpi-grid">
        {reportStats.map((stat) => (
          <article className="panel kpi-card" key={stat.id}>
            <span className="kpi-label">{stat.label}</span>
            <div className="kpi-value">{stat.value}</div>
            <span className={`kpi-delta is-${stat.tone}`}>{stat.delta}</span>
          </article>
        ))}
      </div>

      <div className="page-grid">
        <article className="panel">
          <div className="panel-header">
            <div>
              <h3>Insights snapshot</h3>
              <p className="muted">Revenue trend, last 5 months.</p>
            </div>
          </div>
          <div className="bar-chart">
            {insightTrends.map((item) => (
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
          <article className="panel">
            <div className="panel-header">
              <div>
                <h3>Workflow signals</h3>
                <p className="muted">Tasks and approvals in motion.</p>
              </div>
            </div>
            <div className="list">
              {workflowSignals.map((signal) => (
                <div className="list-row" key={signal.id}>
                  <div className="table-strong">{signal.title}</div>
                  <p className="muted">{signal.detail}</p>
                  <span className="status-pill is-warning">{signal.status}</span>
                </div>
              ))}
            </div>
          </article>

          <article className="panel">
            <div className="panel-header">
              <div>
                <h3>Automation runs</h3>
                <p className="muted">Last activity across rules.</p>
              </div>
            </div>
            <div className="list">
              {automationRuns.map((run) => (
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
