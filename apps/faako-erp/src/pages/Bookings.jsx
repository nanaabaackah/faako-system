const bookingStats = [
  {
    id: "week",
    label: "Bookings this week",
    value: "24",
    delta: "6 awaiting confirmation",
    tone: "warning"
  },
  {
    id: "util",
    label: "Utilization rate",
    value: "88%",
    delta: "Target 90%",
    tone: "neutral"
  },
  {
    id: "prep",
    label: "Prep hours",
    value: "112",
    delta: "Next 7 days",
    tone: "positive"
  }
];

const bookings = [
  {
    id: "BK-2401",
    customer: "Accra Event Rentals",
    date: "Thu 10:00 AM",
    asset: "Premium tent kit",
    status: "Confirmed"
  },
  {
    id: "BK-2402",
    customer: "Sankofa Bistro",
    date: "Thu 2:00 PM",
    asset: "Catering set",
    status: "Pending"
  },
  {
    id: "BK-2403",
    customer: "Lighthouse Hotels",
    date: "Fri 9:00 AM",
    asset: "Cold brew station",
    status: "Confirmed"
  }
];

const resourceBlocks = [
  {
    id: "block-1",
    time: "08:00 - 10:00",
    detail: "Tent kit prep - Accra HQ",
    status: "On track"
  },
  {
    id: "block-2",
    time: "11:00 - 12:30",
    detail: "Catering pack - Tema Hub",
    status: "In progress"
  },
  {
    id: "block-3",
    time: "15:00 - 17:00",
    detail: "Return check-in",
    status: "Scheduled"
  }
];

const crewAssignments = [
  {
    id: "crew-1",
    name: "Kojo A.",
    detail: "Setup lead - Accra",
    status: "Assigned"
  },
  {
    id: "crew-2",
    name: "Ama S.",
    detail: "Dispatch coordinator",
    status: "Assigned"
  },
  {
    id: "crew-3",
    name: "Yaw D.",
    detail: "Field support",
    status: "On call"
  }
];

export default function Bookings() {
  return (
    <section className="page">
      <div className="page-header">
        <div>
          <h1>Bookings</h1>
          <p className="muted">Track rentals, scheduling, and resource usage.</p>
        </div>
        <div className="header-actions">
          <button className="button button-primary" type="button">
            Create booking
          </button>
          <button className="button button-ghost" type="button">
            Check availability
          </button>
        </div>
      </div>

      <div className="kpi-grid">
        {bookingStats.map((stat) => (
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
              <h3>Upcoming bookings</h3>
              <p className="muted">Next 48 hours.</p>
            </div>
          </div>
          <div className="data-table">
            <div className="table-row table-head is-5">
              <span>Booking</span>
              <span>Customer</span>
              <span>Date</span>
              <span>Asset</span>
              <span>Status</span>
            </div>
            {bookings.map((booking) => (
              <div className="table-row is-5" key={booking.id}>
                <span className="table-strong">{booking.id}</span>
                <span>{booking.customer}</span>
                <span>{booking.date}</span>
                <span>{booking.asset}</span>
                <span
                  className={`status-pill ${
                    booking.status === "Confirmed" ? "is-success" : "is-warning"
                  }`}
                >
                  {booking.status}
                </span>
              </div>
            ))}
          </div>
        </article>

        <div className="stack">
          <article className="panel">
            <div className="panel-header">
              <div>
                <h3>Resource blocks</h3>
                <p className="muted">Schedule by time slot.</p>
              </div>
            </div>
            <div className="list">
              {resourceBlocks.map((block) => (
                <div className="list-row" key={block.id}>
                  <div className="table-strong">{block.time}</div>
                  <p className="muted">{block.detail}</p>
                  <span className="status-pill is-info">{block.status}</span>
                </div>
              ))}
            </div>
          </article>

          <article className="panel">
            <div className="panel-header">
              <div>
                <h3>Crew assignments</h3>
                <p className="muted">Shift assignments in progress.</p>
              </div>
            </div>
            <div className="list">
              {crewAssignments.map((crew) => (
                <div className="list-row" key={crew.id}>
                  <div className="table-strong">{crew.name}</div>
                  <p className="muted">{crew.detail}</p>
                  <span className="status-pill is-info">{crew.status}</span>
                </div>
              ))}
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}
