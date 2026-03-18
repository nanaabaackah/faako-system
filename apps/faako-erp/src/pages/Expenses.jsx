const expenseStats = [
  {
    id: "submitted",
    label: "Submitted this week",
    value: "46",
    delta: "12 pending approval",
    tone: "warning"
  },
  {
    id: "approved",
    label: "Approved",
    value: "34",
    delta: "GHS 22,400",
    tone: "positive"
  },
  {
    id: "policy",
    label: "Policy compliance",
    value: "98%",
    delta: "1 exception",
    tone: "neutral"
  }
];

const expenses = [
  {
    id: "EXP-1402",
    category: "Logistics",
    submittedBy: "Kojo A.",
    amount: "GHS 420",
    status: "Pending"
  },
  {
    id: "EXP-1403",
    category: "Supplies",
    submittedBy: "Ama S.",
    amount: "GHS 180",
    status: "Approved"
  },
  {
    id: "EXP-1404",
    category: "Fuel",
    submittedBy: "Yaw D.",
    amount: "GHS 260",
    status: "Flagged"
  }
];

const policyAlerts = [
  {
    id: "alert-1",
    title: "Fuel expense above limit",
    detail: "EXP-1404 requires manager review",
    status: "Flagged"
  },
  {
    id: "alert-2",
    title: "Missing receipt",
    detail: "EXP-1398 needs attachment",
    status: "Pending"
  }
];

const cardLimits = [
  {
    id: "card-1",
    title: "Operations card",
    detail: "GHS 8,000 / 10,000 used",
    fill: 80
  },
  {
    id: "card-2",
    title: "Fleet card",
    detail: "GHS 3,200 / 6,000 used",
    fill: 54
  },
  {
    id: "card-3",
    title: "Marketing card",
    detail: "GHS 1,100 / 4,000 used",
    fill: 28
  }
];

export default function Expenses() {
  return (
    <section className="page">
      <div className="page-header">
        <div>
          <h1>Expenses</h1>
          <p className="muted">Track spend, approvals, and policy compliance.</p>
        </div>
        <div className="header-actions">
          <button className="button button-primary" type="button">
            Submit expense
          </button>
          <button className="button button-ghost" type="button">
            Export ledger
          </button>
        </div>
      </div>

      <div className="kpi-grid">
        {expenseStats.map((stat) => (
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
              <h3>Recent submissions</h3>
              <p className="muted">Latest expenses in the queue.</p>
            </div>
          </div>
          <div className="data-table">
            <div className="table-row table-head is-5">
              <span>Expense</span>
              <span>Category</span>
              <span>Submitted by</span>
              <span>Amount</span>
              <span>Status</span>
            </div>
            {expenses.map((expense) => (
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
          <article className="panel">
            <div className="panel-header">
              <div>
                <h3>Policy alerts</h3>
                <p className="muted">Items needing attention.</p>
              </div>
            </div>
            <div className="list">
              {policyAlerts.map((alert) => (
                <div className="list-row" key={alert.id}>
                  <div className="table-strong">{alert.title}</div>
                  <p className="muted">{alert.detail}</p>
                  <span className="status-pill is-danger">{alert.status}</span>
                </div>
              ))}
            </div>
          </article>

          <article className="panel">
            <div className="panel-header">
              <div>
                <h3>Card spend limits</h3>
                <p className="muted">Usage across virtual cards.</p>
              </div>
            </div>
            <div className="list">
              {cardLimits.map((card) => (
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
