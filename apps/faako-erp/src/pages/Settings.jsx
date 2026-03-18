const roles = [
  {
    id: "role-1",
    title: "Ops Lead",
    detail: "Manage orders, inventory, and dispatch.",
    permissions: ["Orders", "Inventory", "Bookings"]
  },
  {
    id: "role-2",
    title: "Finance Manager",
    detail: "Approve spend and manage invoicing.",
    permissions: ["Finance", "Expenses", "Reports"]
  },
  {
    id: "role-3",
    title: "People Ops",
    detail: "Manage roster, hiring, and training.",
    permissions: ["People", "Directory", "Settings"]
  }
];

const securityItems = [
  {
    id: "security-1",
    title: "Multi-factor required",
    detail: "Enabled for admin and finance roles."
  },
  {
    id: "security-2",
    title: "Data exports",
    detail: "Weekly exports sent to analytics inbox."
  },
  {
    id: "security-3",
    title: "Audit log retention",
    detail: "180 days of activity logs stored."
  }
];

export default function Settings() {
  return (
    <section className="page">
      <div className="page-header">
        <div>
          <h1>Settings</h1>
          <p className="muted">Configure branding, data exports, and roles.</p>
        </div>
        <div className="header-actions">
          <button className="button button-primary" type="button">
            Save changes
          </button>
          <button className="button button-ghost" type="button">
            View audit log
          </button>
        </div>
      </div>

      <div className="page-grid">
        <article className="panel">
          <div className="panel-header">
            <div>
              <h3>Workspace profile</h3>
              <p className="muted">Default settings for the demo tenant.</p>
            </div>
          </div>
          <div className="list">
            <div className="list-row">
              <div className="table-strong">Workspace name</div>
              <p className="muted">Faako Foods - Accra HQ</p>
            </div>
            <div className="list-row">
              <div className="table-strong">Primary currency</div>
              <p className="muted">GHS (multi-currency enabled)</p>
            </div>
            <div className="list-row">
              <div className="table-strong">Working hours</div>
              <p className="muted">08:00 - 18:00, Mon to Sat</p>
            </div>
          </div>
        </article>

        <div className="stack">
          <article className="panel">
            <div className="panel-header">
              <div>
                <h3>Roles and permissions</h3>
                <p className="muted">Default access groups in the demo.</p>
              </div>
            </div>
            <div className="list">
              {roles.map((role) => (
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

          <article className="panel">
            <div className="panel-header">
              <div>
                <h3>Security and data</h3>
                <p className="muted">Controls and exports overview.</p>
              </div>
            </div>
            <div className="list">
              {securityItems.map((item) => (
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
