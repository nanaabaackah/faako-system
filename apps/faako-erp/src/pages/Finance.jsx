const financeStats = [
  {
    id: "revenue",
    label: "Monthly revenue",
    value: "$128,400",
    delta: "+12.4% vs last month",
    tone: "positive"
  },
  {
    id: "margin",
    label: "Gross margin",
    value: "42%",
    delta: "+2.1% QoQ",
    tone: "positive"
  },
  {
    id: "outstanding",
    label: "Outstanding invoices",
    value: "$18,200",
    delta: "6 invoices due",
    tone: "warning"
  },
  {
    id: "runway",
    label: "Cash runway",
    value: "8.5 months",
    delta: "Target 12 months",
    tone: "neutral"
  }
];

const transactions = [
  {
    id: "TX-9131",
    name: "Lighthouse Hotels",
    type: "Invoice paid",
    amount: "+$3,240",
    date: "Today 9:22"
  },
  {
    id: "TX-9132",
    name: "SunGrow Farms",
    type: "Vendor payout",
    amount: "-$1,180",
    date: "Today 11:05"
  },
  {
    id: "TX-9133",
    name: "Sankofa Bistro",
    type: "Invoice issued",
    amount: "+$1,240",
    date: "Today 1:40"
  }
];

const invoices = [
  {
    id: "INV-3302",
    customer: "Oceanview Events",
    due: "Today",
    amount: "$2,140",
    status: "Overdue"
  },
  {
    id: "INV-3303",
    customer: "Accra Event Rentals",
    due: "Tomorrow",
    amount: "$1,850",
    status: "Due soon"
  },
  {
    id: "INV-3304",
    customer: "Greenleaf Catering",
    due: "Fri",
    amount: "$980",
    status: "Scheduled"
  }
];

const revenueMix = [
  {
    id: "mix-1",
    label: "Wholesale",
    value: "$74,200",
    fill: 58
  },
  {
    id: "mix-2",
    label: "Events",
    value: "$31,800",
    fill: 25
  },
  {
    id: "mix-3",
    label: "Retail",
    value: "$22,400",
    fill: 17
  }
];

export default function Finance() {
  return (
    <section className="page">
      <div className="page-header">
        <div>
          <h1>Finance</h1>
          <p className="muted">Track cash flow, invoices, and profitability.</p>
        </div>
        <div className="header-actions">
          <button className="button button-primary" type="button">
            Run month-end
          </button>
          <button className="button button-ghost" type="button">
            Export statements
          </button>
        </div>
      </div>

      <div className="kpi-grid">
        {financeStats.map((stat) => (
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
              <h3>Recent transactions</h3>
              <p className="muted">Synced from banking feed.</p>
            </div>
          </div>
          <div className="data-table">
            <div className="table-row table-head is-5">
              <span>Ref</span>
              <span>Name</span>
              <span>Type</span>
              <span>Amount</span>
              <span>Date</span>
            </div>
            {transactions.map((tx) => (
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
          <article className="panel">
            <div className="panel-header">
              <div>
                <h3>Invoices due</h3>
                <p className="muted">Payment follow-ups for finance.</p>
              </div>
            </div>
            <div className="list">
              {invoices.map((invoice) => (
                <div className="list-row" key={invoice.id}>
                  <div className="table-strong">{invoice.customer}</div>
                  <p className="muted">
                    {invoice.id} • {invoice.due}
                  </p>
                  <div className="table-strong">{invoice.amount}</div>
                  <span className="status-pill is-warning">{invoice.status}</span>
                </div>
              ))}
            </div>
          </article>

          <article className="panel">
            <div className="panel-header">
              <div>
                <h3>Revenue mix</h3>
                <p className="muted">Current month breakdown.</p>
              </div>
            </div>
            <div className="list">
              {revenueMix.map((mix) => (
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
