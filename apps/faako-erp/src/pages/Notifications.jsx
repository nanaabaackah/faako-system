const notificationStats = [
  {
    id: "unread",
    label: "Unread alerts",
    value: "6",
    delta: "2 critical",
    tone: "warning"
  },
  {
    id: "tasks",
    label: "Tasks waiting",
    value: "14",
    delta: "Ops and finance",
    tone: "neutral"
  },
  {
    id: "resolved",
    label: "Resolved today",
    value: "21",
    delta: "Since 8:00 AM",
    tone: "positive"
  }
];

const notifications = [
  {
    id: "note-1",
    title: "Low stock: Cold Brew Beans",
    detail: "Inventory dropped below reorder point.",
    time: "5 min ago",
    status: "Critical"
  },
  {
    id: "note-2",
    title: "Invoice overdue: Oceanview Events",
    detail: "Payment is 2 days late.",
    time: "25 min ago",
    status: "Warning"
  },
  {
    id: "note-3",
    title: "Dispatch run ready",
    detail: "Accra Central route is ready to depart.",
    time: "1 hour ago",
    status: "Info"
  },
  {
    id: "note-4",
    title: "New hire approved",
    detail: "Warehouse lead access granted.",
    time: "2 hours ago",
    status: "Resolved"
  }
];

export default function Notifications() {
  return (
    <section className="page">
      <div className="page-header">
        <div>
          <h1>Notifications</h1>
          <p className="muted">Alerts across ops, finance, and people.</p>
        </div>
        <div className="header-actions">
          <button className="button button-primary" type="button">
            Mark all read
          </button>
          <button className="button button-ghost" type="button">
            Manage rules
          </button>
        </div>
      </div>

      <div className="kpi-grid">
        {notificationStats.map((stat) => (
          <article className="panel kpi-card" key={stat.id}>
            <span className="kpi-label">{stat.label}</span>
            <div className="kpi-value">{stat.value}</div>
            <span className={`kpi-delta is-${stat.tone}`}>{stat.delta}</span>
          </article>
        ))}
      </div>

      <div className="panel">
        <div className="panel-header">
          <div>
            <h3>Latest alerts</h3>
            <p className="muted">Most recent system updates.</p>
          </div>
          <div className="segmented">
            <button className="segment is-active" type="button">
              All
            </button>
            <button className="segment" type="button">
              Ops
            </button>
            <button className="segment" type="button">
              Finance
            </button>
            <button className="segment" type="button">
              People
            </button>
          </div>
        </div>
        <div className="list">
          {notifications.map((note) => (
            <div className="list-row" key={note.id}>
              <div className="table-strong">{note.title}</div>
              <p className="muted">{note.detail}</p>
              <div className="pill-group">
                <span
                  className={`status-pill ${
                    note.status === "Critical"
                      ? "is-danger"
                      : note.status === "Warning"
                      ? "is-warning"
                      : note.status === "Resolved"
                      ? "is-success"
                      : "is-info"
                  }`}
                >
                  {note.status}
                </span>
                <span className="status-pill">{note.time}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
