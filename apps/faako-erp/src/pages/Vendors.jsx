const vendorStats = [
  {
    id: "active",
    label: "Active vendors",
    value: "32",
    delta: "4 new this quarter",
    tone: "positive"
  },
  {
    id: "lead",
    label: "Avg lead time",
    value: "6.2 days",
    delta: "Target 5 days",
    tone: "warning"
  },
  {
    id: "on-time",
    label: "On-time rate",
    value: "93%",
    delta: "Last 60 days",
    tone: "positive"
  }
];

const vendors = [
  {
    id: "VND-022",
    name: "SunGrow Farms",
    category: "Produce",
    rating: "4.8",
    leadTime: "5 days",
    status: "Preferred"
  },
  {
    id: "VND-031",
    name: "Cocoa Supply Co",
    category: "Ingredients",
    rating: "4.5",
    leadTime: "7 days",
    status: "Approved"
  },
  {
    id: "VND-045",
    name: "Kumasi Packaging",
    category: "Packaging",
    rating: "4.1",
    leadTime: "4 days",
    status: "Review"
  }
];

const approvals = [
  {
    id: "po-1",
    title: "PO-8890 - SunGrow Farms",
    detail: "GHS 6,400 - awaiting finance",
    status: "Pending"
  },
  {
    id: "po-2",
    title: "PO-8891 - Cocoa Supply Co",
    detail: "GHS 3,250 - awaiting ops",
    status: "Pending"
  }
];

const renewals = [
  {
    id: "renew-1",
    title: "Citrus concentrate contract",
    detail: "Renews in 14 days",
    status: "Upcoming"
  },
  {
    id: "renew-2",
    title: "Label printing agreement",
    detail: "Renews in 21 days",
    status: "Upcoming"
  }
];

export default function Vendors() {
  return (
    <section className="page">
      <div className="page-header">
        <div>
          <h1>Vendors</h1>
          <p className="muted">Manage supplier performance and approvals.</p>
        </div>
        <div className="header-actions">
          <button className="button button-primary" type="button">
            Add vendor
          </button>
          <button className="button button-ghost" type="button">
            Create PO
          </button>
        </div>
      </div>

      <div className="kpi-grid">
        {vendorStats.map((stat) => (
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
              <h3>Vendor list</h3>
              <p className="muted">Top suppliers by spend.</p>
            </div>
          </div>
          <div className="data-table">
            <div className="table-row table-head is-5">
              <span>Vendor</span>
              <span>Category</span>
              <span>Rating</span>
              <span>Lead time</span>
              <span>Status</span>
            </div>
            {vendors.map((vendor) => (
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
          <article className="panel">
            <div className="panel-header">
              <div>
                <h3>Purchase approvals</h3>
                <p className="muted">Pending approvals for finance.</p>
              </div>
            </div>
            <div className="list">
              {approvals.map((item) => (
                <div className="list-row" key={item.id}>
                  <div className="table-strong">{item.title}</div>
                  <p className="muted">{item.detail}</p>
                  <span className="status-pill is-warning">{item.status}</span>
                </div>
              ))}
            </div>
          </article>

          <article className="panel">
            <div className="panel-header">
              <div>
                <h3>Contract renewals</h3>
                <p className="muted">Upcoming vendor renewals.</p>
              </div>
            </div>
            <div className="list">
              {renewals.map((item) => (
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
