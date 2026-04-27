import useDemoScenario from "../hooks/useDemoScenario.jsx";

export default function People() {
  const { scenario } = useDemoScenario();
  const page = scenario.pages.people;

  return (
    <section className="page">
      <div className="page-header">
        <div>
          <h1>{page.title}</h1>
          <p className="muted">{page.description}</p>
        </div>
        <div className="header-actions">
          <button className="button button-primary" type="button">
            {page.actions.primary}
          </button>
          <button className="button button-ghost" type="button">
            {page.actions.secondary}
          </button>
        </div>
      </div>

      <div className="kpi-grid">
        {page.stats.map((stat) => (
          <article className="panel kpi-card bubble-card" key={stat.id}>
            <span className="kpi-label">{stat.label}</span>
            <div className="kpi-value">{stat.value}</div>
            <span className={`kpi-delta is-${stat.tone}`}>{stat.delta}</span>
          </article>
        ))}
      </div>

      <div className="page-grid">
        <article className="panel glass-card">
          <div className="panel-header">
            <div>
              <h3>{page.rosterTitle}</h3>
              <p className="muted">{page.rosterCopy}</p>
            </div>
          </div>
          <div className="list">
            {page.roster.map((person) => (
              <div className="list-row" key={person.id}>
                <div className="table-strong">{person.name}</div>
                <p className="muted">
                  {person.role} &bull; {person.location}
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
          <article className="panel glass-card">
            <div className="panel-header">
              <div>
                <h3>{page.timeOffTitle}</h3>
                <p className="muted">{page.timeOffCopy}</p>
              </div>
            </div>
            <div className="list">
              {page.timeOff.map((entry) => (
                <div className="list-row" key={entry.id}>
                  <div className="table-strong">{entry.name}</div>
                  <p className="muted">{entry.detail}</p>
                  <span className="status-pill is-info">{entry.dates}</span>
                </div>
              ))}
            </div>
          </article>

          <article className="panel glass-card">
            <div className="panel-header">
              <div>
                <h3>{page.hiringTitle}</h3>
                <p className="muted">{page.hiringCopy}</p>
              </div>
            </div>
            <div className="list">
              {page.hiring.map((role) => (
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
