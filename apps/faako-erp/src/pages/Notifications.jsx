import { useState } from "react";
import useDemoScenario from "../hooks/useDemoScenario.jsx";

export default function Notifications() {
  const { scenario } = useDemoScenario();
  const page = scenario.pages.notifications;
  const [activeFilter, setActiveFilter] = useState(page.filters[0]);

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

      <div className="panel glass-card">
        <div className="panel-header">
          <div>
            <h3>{page.listTitle}</h3>
            <p className="muted">{page.listCopy}</p>
          </div>
          <div className="segmented">
            {page.filters.map((filter) => (
              <button
                key={filter}
                className={`segment ${activeFilter === filter ? "is-active" : ""}`}
                type="button"
                onClick={() => setActiveFilter(filter)}
              >
                {filter}
              </button>
            ))}
          </div>
        </div>
        <div className="list">
          {page.items.map((note) => (
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
