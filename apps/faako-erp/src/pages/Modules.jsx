import { Link } from "react-router-dom";
import {
  demoJourneys,
  featuredDemoModules,
  sharedUiShowcase,
} from "../data/demoModules.js";

export default function Modules() {
  return (
    <section className="page">
      <div className="page-header">
        <div>
          <h1>Modules</h1>
          <p className="muted">
            This demo is set up to show the shared shell and the most important
            ERP workflows working together.
          </p>
        </div>
        <div className="header-actions">
          <Link className="button button-primary" to="/orders">
            Open live workflow
          </Link>
          <Link className="button button-ghost" to="/">
            Back to dashboard
          </Link>
        </div>
      </div>

      <div className="spotlight-grid">
        {sharedUiShowcase.map((item) => (
          <article className="panel bubble-card spotlight-card" key={item.id}>
            <p className="eyebrow">Shared UI</p>
            <h3>{item.title}</h3>
            <p className="muted">{item.detail}</p>
          </article>
        ))}
      </div>

      <div className="module-grid">
        {featuredDemoModules.map((module) => (
          <article className="panel glass-card module-card" key={module.id}>
            <div className="module-card__header">
              <div>
                <p className="eyebrow">Important module</p>
                <h3>{module.title}</h3>
              </div>
              <span className={`status-pill is-${module.tone}`}>{module.status}</span>
            </div>
            <p className="muted">{module.summary}</p>
            <div className="pill-group">
              {module.tags.map((tag) => (
                <span className="status-pill" key={tag}>
                  {tag}
                </span>
              ))}
            </div>
            <div className="module-card__meta">
              <div className="table-strong">{module.metric}</div>
              <p className="muted">{module.outcome}</p>
            </div>
            <Link className="button button-primary module-card__link" to={module.path}>
              Open module
            </Link>
          </article>
        ))}
      </div>

      <div className="workflow-grid">
        {demoJourneys.map((journey) => (
          <article className="panel glass-card workflow-card" key={journey.id}>
            <p className="eyebrow">Demo story</p>
            <h3>{journey.title}</h3>
            <p className="muted">{journey.summary}</p>
            <div className="pill-group">
              {journey.modules.map((module) => (
                <span className="status-pill" key={module}>
                  {module}
                </span>
              ))}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
