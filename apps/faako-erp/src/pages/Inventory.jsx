const inventoryStats = [
  {
    id: "skus",
    label: "Active SKUs",
    value: "1,248",
    delta: "+32 this month",
    tone: "positive"
  },
  {
    id: "fill",
    label: "Stock fill rate",
    value: "94%",
    delta: "Goal 96%",
    tone: "warning"
  },
  {
    id: "turn",
    label: "Inventory turns",
    value: "5.8x",
    delta: "Last 90 days",
    tone: "neutral"
  }
];

const lowStock = [
  {
    id: "item-1",
    name: "Cold Brew Beans",
    onHand: "14 kg",
    target: "80 kg",
    fill: 18,
    status: "Reorder"
  },
  {
    id: "item-2",
    name: "Glass Bottles 500ml",
    onHand: "320 units",
    target: "1,200 units",
    fill: 27,
    status: "Critical"
  },
  {
    id: "item-3",
    name: "Matte Labels",
    onHand: "2,100 units",
    target: "3,000 units",
    fill: 70,
    status: "Monitoring"
  }
];

const movements = [
  {
    id: "move-1",
    sku: "CB-550",
    type: "Stock in",
    qty: "+120",
    location: "Accra HQ",
    time: "Today 09:40"
  },
  {
    id: "move-2",
    sku: "BT-200",
    type: "Stock out",
    qty: "-240",
    location: "Tema Hub",
    time: "Today 11:15"
  },
  {
    id: "move-3",
    sku: "LB-022",
    type: "Adjustment",
    qty: "-12",
    location: "Accra HQ",
    time: "Today 1:05"
  }
];

const locations = [
  {
    id: "loc-1",
    name: "Accra HQ",
    detail: "62% of stock • 4,320 units",
    fill: 62
  },
  {
    id: "loc-2",
    name: "Tema Hub",
    detail: "28% of stock • 1,860 units",
    fill: 28
  },
  {
    id: "loc-3",
    name: "Kumasi Depot",
    detail: "10% of stock • 640 units",
    fill: 10
  }
];

export default function Inventory() {
  return (
    <section className="page">
      <div className="page-header">
        <div>
          <h1>Inventory</h1>
          <p className="muted">Monitor stock levels and replenishment signals.</p>
        </div>
        <div className="header-actions">
          <button className="button button-primary" type="button">
            New purchase order
          </button>
          <button className="button button-ghost" type="button">
            Run cycle count
          </button>
        </div>
      </div>

      <div className="kpi-grid">
        {inventoryStats.map((stat) => (
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
              <h3>Low stock watchlist</h3>
              <p className="muted">Items below reorder thresholds.</p>
            </div>
          </div>
          <div className="list">
            {lowStock.map((item) => (
              <div className="list-row" key={item.id}>
                <div className="table-strong">{item.name}</div>
                <p className="muted">
                  {item.onHand} on hand • Target {item.target}
                </p>
                <div className="progress">
                  <span style={{ width: `${item.fill}%` }} />
                </div>
                <span className="status-pill is-warning">{item.status}</span>
              </div>
            ))}
          </div>
        </article>

        <div className="stack">
          <article className="panel">
            <div className="panel-header">
              <div>
                <h3>Stock by location</h3>
                <p className="muted">Distribution across warehouses.</p>
              </div>
            </div>
            <div className="list">
              {locations.map((location) => (
                <div className="list-row" key={location.id}>
                  <div className="table-strong">{location.name}</div>
                  <p className="muted">{location.detail}</p>
                  <div className="progress">
                    <span style={{ width: `${location.fill}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </article>

          <article className="panel">
            <div className="panel-header">
              <div>
                <h3>Recent movements</h3>
                <p className="muted">Latest stock activity.</p>
              </div>
            </div>
            <div className="data-table">
              <div className="table-row table-head is-5">
                <span>SKU</span>
                <span>Type</span>
                <span>Qty</span>
                <span>Location</span>
                <span>Time</span>
              </div>
              {movements.map((move) => (
                <div className="table-row is-5" key={move.id}>
                  <span className="table-strong">{move.sku}</span>
                  <span>{move.type}</span>
                  <span className="table-strong">{move.qty}</span>
                  <span>{move.location}</span>
                  <span>{move.time}</span>
                </div>
              ))}
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}
