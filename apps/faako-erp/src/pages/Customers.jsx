const customerStats = [
  {
    id: "accounts",
    label: "Active accounts",
    value: "128",
    delta: "+9 this quarter",
    tone: "positive"
  },
  {
    id: "pipeline",
    label: "Expansion pipeline",
    value: "$48,000",
    delta: "12 opportunities",
    tone: "neutral"
  },
  {
    id: "nps",
    label: "NPS score",
    value: "56",
    delta: "Surveyed last week",
    tone: "positive"
  }
];

const accounts = [
  {
    id: "ACC-402",
    name: "Lighthouse Hotels",
    owner: "Ama S.",
    tier: "Enterprise",
    health: "Healthy",
    lastTouch: "Today"
  },
  {
    id: "ACC-421",
    name: "Oceanview Events",
    owner: "Kojo A.",
    tier: "Mid-market",
    health: "Watch",
    lastTouch: "Yesterday"
  },
  {
    id: "ACC-433",
    name: "Greenleaf Catering",
    owner: "Esther B.",
    tier: "Growth",
    health: "Healthy",
    lastTouch: "2 days ago"
  }
];

const healthSignals = [
  {
    id: "signal-1",
    label: "High intent",
    detail: "14 accounts requested new quotes",
    status: "Positive"
  },
  {
    id: "signal-2",
    label: "Usage drop",
    detail: "6 accounts below 50% volume",
    status: "At risk"
  },
  {
    id: "signal-3",
    label: "Renewals",
    detail: "4 contracts renew this month",
    status: "Upcoming"
  }
];

const pipelineStages = [
  {
    id: "stage-1",
    label: "Discovery",
    value: "$18,500",
    fill: 55
  },
  {
    id: "stage-2",
    label: "Proposal",
    value: "$21,000",
    fill: 38
  },
  {
    id: "stage-3",
    label: "Negotiation",
    value: "$8,500",
    fill: 20
  }
];

export default function Customers() {
  return (
    <section className="page">
      <div className="page-header">
        <div>
          <h1>Customers</h1>
          <p className="muted">Monitor account health and growth signals.</p>
        </div>
        <div className="header-actions">
          <button className="button button-primary" type="button">
            Add account
          </button>
          <button className="button button-ghost" type="button">
            Launch survey
          </button>
        </div>
      </div>

      <div className="kpi-grid">
        {customerStats.map((stat) => (
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
              <h3>Key accounts</h3>
              <p className="muted">Highest ARR customers.</p>
            </div>
          </div>
          <div className="data-table">
            <div className="table-row table-head is-5">
              <span>Account</span>
              <span>Owner</span>
              <span>Tier</span>
              <span>Health</span>
              <span>Last touch</span>
            </div>
            {accounts.map((account) => (
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
          <article className="panel">
            <div className="panel-header">
              <div>
                <h3>Health signals</h3>
                <p className="muted">Auto-detected insights.</p>
              </div>
            </div>
            <div className="list">
              {healthSignals.map((signal) => (
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

          <article className="panel">
            <div className="panel-header">
              <div>
                <h3>Expansion pipeline</h3>
                <p className="muted">Active opportunities.</p>
              </div>
            </div>
            <div className="list">
              {pipelineStages.map((stage) => (
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
