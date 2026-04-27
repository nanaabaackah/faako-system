import useDemoScenario from "../hooks/useDemoScenario.jsx";

export default function Modules() {
  const { scenario } = useDemoScenario();
  const { modules } = scenario;
  const page = scenario.pages.modulesPage;

  return (
    <section className="page">
      <div className="page-header">
        <div>
          <h1>{page.title}</h1>
          <p className="muted">{page.description}</p>
        </div>
        <div className="header-actions">
          <a className="button button-primary" href="/orders">
            {page.primaryActionLabel}
          </a>
          <a className="button button-ghost" href="/">
            {page.secondaryActionLabel}
          </a>
        </div>
      </div>

      <div className="spotlight-grid">
        {modules.sharedUiShowcase.map((item) => (
          <article className="panel bubble-card spotlight-card" key={item.id}>
            <p className="eyebrow">{page.workspaceTitle}</p>
            <h3>{item.title}</h3>
            <p className="muted">{item.detail}</p>
          </article>
        ))}
      </div>

      <div className="module-grid">
        {modules.featuredModules.map((module) => (
          <article className="panel glass-card bubble-card module-card" key={module.id}>
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
            <a className="button button-primary module-card__link" href={module.path}>
              Open module
            </a>
          </article>
        ))}
      </div>

      <div className="workflow-grid">
        {modules.journeys.map((journey) => (
          <article className="panel glass-card bubble-card workflow-card" key={journey.id}>
            <p className="eyebrow">{page.journeyEyebrow}</p>
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
