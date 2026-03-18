const peopleStats = [
  {
    id: "headcount",
    label: "Headcount",
    value: "48",
    delta: "+3 this quarter",
    tone: "positive"
  },
  {
    id: "open",
    label: "Open roles",
    value: "4",
    delta: "2 awaiting approval",
    tone: "warning"
  },
  {
    id: "hours",
    label: "Hours logged",
    value: "1,420",
    delta: "Last 14 days",
    tone: "neutral"
  }
];

const teamRoster = [
  {
    id: "team-1",
    name: "Ama Serwaa",
    role: "Operations Lead",
    location: "Accra HQ",
    status: "Active"
  },
  {
    id: "team-2",
    name: "Kojo Asante",
    role: "Warehouse Supervisor",
    location: "Tema Hub",
    status: "Active"
  },
  {
    id: "team-3",
    name: "Efua Mensah",
    role: "Finance Manager",
    location: "Accra HQ",
    status: "On leave"
  },
  {
    id: "team-4",
    name: "Yaw Darko",
    role: "Fleet Coordinator",
    location: "Accra HQ",
    status: "Active"
  }
];

const timeOff = [
  {
    id: "leave-1",
    name: "Efua Mensah",
    detail: "Annual leave",
    dates: "Jun 12 - Jun 16"
  },
  {
    id: "leave-2",
    name: "Sena Boateng",
    detail: "Training",
    dates: "Jun 18 - Jun 19"
  },
  {
    id: "leave-3",
    name: "Kweku Owusu",
    detail: "Sick leave",
    dates: "Jun 20"
  }
];

const hiring = [
  {
    id: "hire-1",
    role: "Customer Success Lead",
    stage: "Offer",
    owner: "HR"
  },
  {
    id: "hire-2",
    role: "Inventory Analyst",
    stage: "Interview",
    owner: "Ops"
  },
  {
    id: "hire-3",
    role: "Dispatch Coordinator",
    stage: "Screening",
    owner: "Ops"
  }
];

export default function People() {
  return (
    <section className="page">
      <div className="page-header">
        <div>
          <h1>People</h1>
          <p className="muted">Track headcount, time off, and hiring.</p>
        </div>
        <div className="header-actions">
          <button className="button button-primary" type="button">
            Add team member
          </button>
          <button className="button button-ghost" type="button">
            Request headcount
          </button>
        </div>
      </div>

      <div className="kpi-grid">
        {peopleStats.map((stat) => (
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
              <h3>Team roster</h3>
              <p className="muted">Active members across locations.</p>
            </div>
          </div>
          <div className="list">
            {teamRoster.map((person) => (
              <div className="list-row" key={person.id}>
                <div className="table-strong">{person.name}</div>
                <p className="muted">
                  {person.role} • {person.location}
                </p>
                <span
                  className={`status-pill ${
                    person.status === "On leave" ? "is-warning" : "is-success"
                  }`}
                >
                  {person.status}
                </span>
              </div>
            ))}
          </div>
        </article>

        <div className="stack">
          <article className="panel">
            <div className="panel-header">
              <div>
                <h3>Time off calendar</h3>
                <p className="muted">Upcoming leaves and training.</p>
              </div>
            </div>
            <div className="list">
              {timeOff.map((entry) => (
                <div className="list-row" key={entry.id}>
                  <div className="table-strong">{entry.name}</div>
                  <p className="muted">{entry.detail}</p>
                  <span className="status-pill is-info">{entry.dates}</span>
                </div>
              ))}
            </div>
          </article>

          <article className="panel">
            <div className="panel-header">
              <div>
                <h3>Hiring pipeline</h3>
                <p className="muted">Roles in progress.</p>
              </div>
            </div>
            <div className="list">
              {hiring.map((role) => (
                <div className="list-row" key={role.id}>
                  <div className="table-strong">{role.role}</div>
                  <p className="muted">Owner: {role.owner}</p>
                  <span className="status-pill is-info">{role.stage}</span>
                </div>
              ))}
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}
