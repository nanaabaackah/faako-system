import { useState } from "react";

const kpis = [
  {
    id: "revenue",
    label: "Monthly revenue",
    value: "$128,400",
    delta: "+12.4% vs last month",
    tone: "positive"
  },
  {
    id: "orders",
    label: "Open orders",
    value: "42",
    delta: "8 due today",
    tone: "neutral"
  },
  {
    id: "inventory",
    label: "Inventory health",
    value: "92%",
    delta: "3 items below par",
    tone: "warning"
  },
  {
    id: "cash",
    label: "Cash on hand",
    value: "$54,200",
    delta: "+$6,500 this week",
    tone: "positive"
  }
];

const orderSets = {
  today: [
    {
      id: "ORD-2043",
      customer: "Accra Event Rentals",
      owner: "Ama S.",
      due: "Today 4:00 PM",
      status: "Picking",
      total: "$1,850"
    },
    {
      id: "ORD-2044",
      customer: "Sankofa Bistro",
      owner: "Kojo A.",
      due: "Today 6:30 PM",
      status: "Quality check",
      total: "$920"
    },
    {
      id: "ORD-2045",
      customer: "Lighthouse Hotels",
      owner: "Esther B.",
      due: "Tomorrow 9:00 AM",
      status: "Awaiting payment",
      total: "$3,240"
    }
  ],
  week: [
    {
      id: "ORD-2036",
      customer: "Oceanview Events",
      owner: "Kweku A.",
      due: "Thu 11:00 AM",
      status: "Ready to ship",
      total: "$2,750"
    },
    {
      id: "ORD-2039",
      customer: "The Cedar Room",
      owner: "Ama S.",
      due: "Fri 2:00 PM",
      status: "Picking",
      total: "$1,120"
    },
    {
      id: "ORD-2041",
      customer: "Greenleaf Catering",
      owner: "Yaw D.",
      due: "Sat 8:00 AM",
      status: "Awaiting payment",
      total: "$2,980"
    }
  ]
};

const inventoryWatchlist = [
  {
    id: "cold-brew",
    item: "Cold Brew Beans",
    onHand: "14 kg",
    target: "80 kg",
    fill: 18,
    status: "Reorder"
  },
  {
    id: "bottles",
    item: "Glass Bottles 500ml",
    onHand: "320 units",
    target: "1,200 units",
    fill: 27,
    status: "Critical"
  },
  {
    id: "labels",
    item: "Brand Labels (Matte)",
    onHand: "2,100 units",
    target: "3,000 units",
    fill: 70,
    status: "Monitoring"
  }
];

const schedule = [
  {
    id: "shift-1",
    time: "08:00",
    title: "Receiving & QA",
    team: "Ama, Kojo, Sena",
    status: "On track"
  },
  {
    id: "shift-2",
    time: "10:30",
    title: "Production Run: Citrus",
    team: "Yaw, Efua, Linda",
    status: "In progress"
  },
  {
    id: "shift-3",
    time: "14:00",
    title: "Dispatch: Accra",
    team: "Kweku, Mensah",
    status: "Scheduled"
  }
];

const approvals = [
  {
    id: "approval-1",
    title: "Vendor invoice: SunGrow Farms",
    meta: "GHS 6,400 • Due in 2 hrs",
    priority: "Urgent"
  },
  {
    id: "approval-2",
    title: "New hire access: Warehouse lead",
    meta: "Request by HR • 5 modules",
    priority: "Normal"
  },
  {
    id: "approval-3",
    title: "Marketing spend: Q2 campaign",
    meta: "USD 2,100 • Finance review",
    priority: "Normal"
  }
];

const cashflow = [
  { id: "receivables", label: "Accounts receivable", value: "$18,200", fill: 62 },
  { id: "payables", label: "Accounts payable", value: "$9,450", fill: 38 },
  { id: "subscriptions", label: "Recurring costs", value: "$3,280", fill: 22 }
];

export default function Dashboard() {
  const [ordersView, setOrdersView] = useState("today");
  const orders = orderSets[ordersView];

  return (
    <section className="page dashboard">
      <div className="panel dashboard-hero">
        <div>
          <p className="eyebrow">Operations overview</p>
          <h1>Faako Foods — Accra HQ</h1>
          <p className="muted">
            Wednesday, 12 June • 14 workflows running • Demo environment
          </p>
        </div>
        <div className="hero-actions">
          <button className="button button-primary" type="button">
            New order
          </button>
          <button className="button button-ghost" type="button">
            Export report
          </button>
        </div>
      </div>

      <div className="kpi-grid">
        {kpis.map((kpi) => (
          <article className="panel kpi-card" key={kpi.id}>
            <span className="kpi-label">{kpi.label}</span>
            <div className="kpi-value">{kpi.value}</div>
            <span className={`kpi-delta is-${kpi.tone}`}>{kpi.delta}</span>
          </article>
        ))}
      </div>

      <div className="dashboard-grid">
        <article className="panel panel-span-2">
          <div className="panel-header">
            <div>
              <h3>Active orders</h3>
              <p className="muted">Syncing across sales, delivery, and finance.</p>
            </div>
            <div className="segmented">
              <button
                className={`segment ${ordersView === "today" ? "is-active" : ""}`}
                type="button"
                onClick={() => setOrdersView("today")}
              >
                Today
              </button>
              <button
                className={`segment ${ordersView === "week" ? "is-active" : ""}`}
                type="button"
                onClick={() => setOrdersView("week")}
              >
                This week
              </button>
            </div>
          </div>
          <div className="data-table">
            <div className="table-row table-head">
              <span>Order</span>
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

        <article className="panel">
          <div className="panel-header">
            <div>
              <h3>Inventory watchlist</h3>
              <p className="muted">Auto-replenish suggestions from history.</p>
            </div>
          </div>
          <div className="stack">
            {inventoryWatchlist.map((item) => (
              <div className="stack-row" key={item.id}>
                <div>
                  <div className="table-strong">{item.item}</div>
                  <p className="muted">
                    {item.onHand} on hand • Target {item.target}
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

        <article className="panel">
          <div className="panel-header">
            <div>
              <h3>Team schedule</h3>
              <p className="muted">Live coverage across shifts.</p>
            </div>
          </div>
          <div className="timeline">
            {schedule.map((shift) => (
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

        <article className="panel">
          <div className="panel-header">
            <div>
              <h3>Approvals queue</h3>
              <p className="muted">Pending decisions tied to workflow rules.</p>
            </div>
          </div>
          <div className="stack">
            {approvals.map((item) => (
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

        <article className="panel">
          <div className="panel-header">
            <div>
              <h3>Cash flow snapshot</h3>
              <p className="muted">Rolling 30-day balance outlook.</p>
            </div>
          </div>
          <div className="stack">
            {cashflow.map((item) => (
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
    </section>
  );
}
