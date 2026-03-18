const orderStats = [
  {
    id: "today",
    label: "Orders today",
    value: "18",
    delta: "6 awaiting dispatch",
    tone: "neutral"
  },
  {
    id: "on-time",
    label: "On-time rate",
    value: "96%",
    delta: "Last 30 days",
    tone: "positive"
  },
  {
    id: "value",
    label: "Avg order value",
    value: "$420",
    delta: "+8% vs last month",
    tone: "positive"
  }
];

const orders = [
  {
    id: "ORD-2048",
    customer: "Sankofa Bistro",
    channel: "Retail",
    owner: "Ama S.",
    due: "Today 5:00 PM",
    status: "Picking",
    statusTone: "warning",
    total: "$1,240"
  },
  {
    id: "ORD-2049",
    customer: "Lighthouse Hotels",
    channel: "Wholesale",
    owner: "Kojo A.",
    due: "Today 6:30 PM",
    status: "Ready to ship",
    statusTone: "info",
    total: "$3,860"
  },
  {
    id: "ORD-2050",
    customer: "Oceanview Events",
    channel: "Events",
    owner: "Esther B.",
    due: "Tomorrow 10:00 AM",
    status: "Awaiting payment",
    statusTone: "warning",
    total: "$2,140"
  },
  {
    id: "ORD-2051",
    customer: "Greenleaf Catering",
    channel: "Wholesale",
    owner: "Yaw D.",
    due: "Tomorrow 3:00 PM",
    status: "Delivered",
    statusTone: "success",
    total: "$980"
  }
];

const dispatchQueue = [
  {
    id: "dispatch-1",
    title: "Accra Central run",
    meta: "5 stops • 2 drivers • 18 crates",
    eta: "Leaves 3:30 PM"
  },
  {
    id: "dispatch-2",
    title: "Tema warehouses",
    meta: "3 stops • 1 driver • 12 crates",
    eta: "Leaves 4:10 PM"
  },
  {
    id: "dispatch-3",
    title: "Airport pickup",
    meta: "2 stops • 1 driver • 6 crates",
    eta: "Leaves 5:45 PM"
  }
];

const pipeline = [
  {
    id: "stage-1",
    label: "New",
    value: "24",
    detail: "Auto-imported",
    fill: 65
  },
  {
    id: "stage-2",
    label: "In fulfillment",
    value: "12",
    detail: "Picking & packing",
    fill: 40
  },
  {
    id: "stage-3",
    label: "Ready",
    value: "8",
    detail: "Dispatch queue",
    fill: 25
  }
];

export default function Orders() {
  return (
    <section className="page">
      <div className="page-header">
        <div>
          <h1>Orders</h1>
          <p className="muted">Track fulfillment, delivery, and payment status.</p>
        </div>
        <div className="header-actions">
          <button className="button button-primary" type="button">
            Create order
          </button>
          <button className="button button-ghost" type="button">
            Sync marketplace
          </button>
        </div>
      </div>

      <div className="kpi-grid">
        {orderStats.map((stat) => (
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
              <h3>Live orders</h3>
              <p className="muted">Updated every 5 minutes.</p>
            </div>
          </div>
          <div className="data-table">
            <div className="table-row table-head is-7">
              <span>Order</span>
              <span>Customer</span>
              <span>Channel</span>
              <span>Owner</span>
              <span>Due</span>
              <span>Status</span>
              <span>Total</span>
            </div>
            {orders.map((order) => (
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
          <article className="panel">
            <div className="panel-header">
              <div>
                <h3>Dispatch queue</h3>
                <p className="muted">Route plans based on delivery windows.</p>
              </div>
            </div>
            <div className="list">
              {dispatchQueue.map((item) => (
                <div className="list-row" key={item.id}>
                  <div className="table-strong">{item.title}</div>
                  <p className="muted">{item.meta}</p>
                  <span className="status-pill is-info">{item.eta}</span>
                </div>
              ))}
            </div>
          </article>

          <article className="panel">
            <div className="panel-header">
              <div>
                <h3>Fulfillment pipeline</h3>
                <p className="muted">Orders by stage.</p>
              </div>
            </div>
            <div className="list">
              {pipeline.map((stage) => (
                <div className="list-row" key={stage.id}>
                  <div className="table-strong">{stage.label}</div>
                  <p className="muted">
                    {stage.value} orders • {stage.detail}
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
