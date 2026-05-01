import useDemoScenario from "../hooks/useDemoScenario.jsx";

export default function Settings() {
  const { scenario } = useDemoScenario();
  const page = scenario.pages.settings;

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

      <div className="page-grid">
        <article className="panel glass-card">
          <div className="panel-header">
            <div>
              <h3>{page.profileTitle}</h3>
              <p className="muted">{page.profileCopy}</p>
            </div>
          </div>
          <div className="list">
            {page.profileItems.map((item) => (
              <div className="list-row" key={item.id}>
                <div className="table-strong">{item.title}</div>
                <p className="muted">{item.detail}</p>
              </div>
            ))}
          </div>
        </article>

        <div className="stack">
          <article className="panel glass-card">
            <div className="panel-header">
              <div>
                <h3>{page.rolesTitle}</h3>
                <p className="muted">{page.rolesCopy}</p>
              </div>
            </div>
            <div className="list">
              {page.roles.map((role) => (
                <div className="list-row" key={role.id}>
                  <div className="table-strong">{role.title}</div>
                  <p className="muted">{role.detail}</p>
                  <div className="pill-group">
                    {role.permissions.map((perm) => (
                      <span className="status-pill" key={perm}>
                        {perm}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </article>

          <article className="panel glass-card">
            <div className="panel-header">
              <div>
                <h3>{page.securityTitle}</h3>
                <p className="muted">{page.securityCopy}</p>
              </div>
            </div>
            <div className="list">
              {page.securityItems.map((item) => (
                <div className="list-row" key={item.id}>
                  <div className="table-strong">{item.title}</div>
                  <p className="muted">{item.detail}</p>
                </div>
              ))}
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}
