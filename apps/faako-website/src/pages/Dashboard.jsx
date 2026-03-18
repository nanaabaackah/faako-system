import { useMemo } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faGaugeHigh,
  faFileInvoiceDollar,
  faBoxesStacked,
  faUserTie,
  faLayerGroup,
  faCircleCheck,
  faChartLine,
  faChartPie,
  faReceipt,
  faWallet,
  faClock,
  faUserShield,
} from "@fortawesome/free-solid-svg-icons";
import PrimaryButton from "../components/PrimaryButton.jsx";
import "../styles/pages/Dashboard.css";

const coreModules = [
  {
    id: "inventory",
    name: "Inventory",
    description: "Serialized items, warehouses, and stock movement tracking.",
    icon: faBoxesStacked,
    tag: "Core",
  },
  {
    id: "accounting",
    name: "Accounting",
    description: "General ledger, reconciliations, and closing.",
    icon: faChartPie,
    tag: "Core",
  },
  {
    id: "invoicing",
    name: "Invoicing",
    description: "Billing schedules, deposits, and payment tracking.",
    icon: faFileInvoiceDollar,
    tag: "Core",
  },
  {
    id: "hr",
    name: "HR",
    description: "Hiring, training, and team performance records.",
    icon: faUserTie,
    tag: "Core",
  },
  {
    id: "users",
    name: "Users",
    description: "Roles, permissions, and access control.",
    icon: faUserShield,
    tag: "Core",
  },
];

const addOnModules = [
  { id: "website", name: "Website" },
  { id: "crm", name: "CRM" },
  { id: "orders", name: "Orders" },
  { id: "bookings", name: "Bookings" },
  { id: "scheduler", name: "Scheduler" },
  { id: "directory", name: "Directory" },
  { id: "expenses", name: "Expenses" },
  { id: "vendors", name: "Vendors" },
  { id: "maintenance", name: "Maintenance" },
  { id: "delivery", name: "Delivery" },
  { id: "documents", name: "Documents" },
  { id: "timesheets", name: "Timesheets" },
  { id: "marketing", name: "Marketing" },
  { id: "settings", name: "Settings" },
  { id: "template-mode", name: "Template Mode" },
  { id: "procurement", name: "Procurement" },
  { id: "asset-management", name: "Asset Management" },
  { id: "integrations", name: "Integrations" },
  { id: "support-desk", name: "Support Desk" },
  { id: "compliance", name: "Compliance" },
  { id: "analytics", name: "Analytics" },
];

const dashboardMetrics = [
  {
    label: "Revenue tracked",
    value: "GHS 284,500",
    change: "+12.4% vs last month",
    icon: faChartLine,
  },
  {
    label: "Open invoices",
    value: "GHS 42,800",
    change: "18 invoices awaiting payment",
    icon: faReceipt,
  },
  {
    label: "Operating cash",
    value: "GHS 96,200",
    change: "Covers 4.2 months",
    icon: faWallet,
  },
  {
    label: "Delivery cycle",
    value: "2.6 days",
    change: "On-time rate 94%",
    icon: faClock,
  },
];

const rolloutTimeline = [
  {
    title: "Discovery complete",
    detail: "Workflow mapping signed off by leadership and ops.",
  },
  {
    title: "Build in progress",
    detail: "Core modules are active in staging and awaiting user review.",
  },
  {
    title: "Team onboarding",
    detail: "Role-based training sessions are scheduled for launch week.",
  },
];

export default function Dashboard() {
  const configStorageKey = "faako-config";

  const storedConfig = useMemo(() => {
    if (typeof window === "undefined") {
      return null;
    }
    try {
      return JSON.parse(window.localStorage.getItem(configStorageKey) || "");
    } catch (error) {
      return null;
    }
  }, []);

  const configuredModuleIds = useMemo(() => {
    if (storedConfig?.modules?.length) {
      return storedConfig.modules;
    }
    return [...coreModules.map((module) => module.id), "crm", "analytics"];
  }, [storedConfig]);

  const configuredAddOns = useMemo(() => {
    const addOnSet = new Set(addOnModules.map((module) => module.id));
    return configuredModuleIds.filter((id) => addOnSet.has(id));
  }, [configuredModuleIds]);

  const moduleLabelMap = useMemo(() => {
    const entries = [...coreModules, ...addOnModules].map((module) => [
      module.id,
      module.name,
    ]);
    return new Map(entries);
  }, []);

  return (
    <section className="page dashboard dashboard-page">
      <div className="app-shell dashboard-shell">
        <aside className="dashboard-sidebar card reveal" data-scroll style={{ "--delay": "0ms" }}>
          <div className="dashboard-brand">
            <p className="eyebrow">Faako Workspace</p>
            <h2>Dashboard</h2>
            <p className="muted">
              Your unified operations overview for Finance, Ops, and Talent.
            </p>
          </div>

          <nav className="dashboard-nav">
            <div className="dashboard-nav-group">
              <p className="eyebrow">Backbone</p>
              <button className="dashboard-link is-active" type="button">
                <FontAwesomeIcon icon={faGaugeHigh} />
                Overview
              </button>
              <button className="dashboard-link" type="button">
                <FontAwesomeIcon icon={faFileInvoiceDollar} />
                Finance
              </button>
              <button className="dashboard-link" type="button">
                <FontAwesomeIcon icon={faBoxesStacked} />
                Operations
              </button>
              <button className="dashboard-link" type="button">
                <FontAwesomeIcon icon={faUserTie} />
                Talent
              </button>
            </div>

            <div className="dashboard-nav-group">
              <p className="eyebrow">Configured Modules</p>
              {configuredAddOns.length ? (
                configuredAddOns.map((id) => (
                  <button key={id} className="dashboard-link" type="button">
                    <FontAwesomeIcon icon={faLayerGroup} />
                    {moduleLabelMap.get(id) || id}
                  </button>
                ))
              ) : (
                <p className="muted">No add-ons selected yet.</p>
              )}
            </div>
          </nav>

          <div className="dashboard-sidebar-footer">
            <div className="dashboard-highlight">
              <FontAwesomeIcon icon={faCircleCheck} />
              Implementation status: Mapping & onboarding
            </div>
            <PrimaryButton to="/configure">Update modules</PrimaryButton>
          </div>
        </aside>

        <main className="dashboard-main">
          <header className="dashboard-hero reveal" data-scroll style={{ "--delay": "80ms" }}>
            <div>
              <p className="eyebrow">Dashboard</p>
              <h1>Single Source of Truth</h1>
              <p className="lead">
                Monitor performance across Finance, Operations, and Talent while
                activating the modules that power your workflows.
              </p>
            </div>
            <div className="dashboard-actions">
              <PrimaryButton to="/contact">Book a review</PrimaryButton>
              <button className="button button-ghost" type="button">
                Export snapshot
              </button>
            </div>
          </header>

          <section className="dashboard-metrics">
            {dashboardMetrics.map((metric) => (
              <article key={metric.label} className="card reveal" data-scroll>
                <div className="dashboard-metric-header">
                  <span>{metric.label}</span>
                  <FontAwesomeIcon icon={metric.icon} />
                </div>
                <h3>{metric.value}</h3>
                <p className="muted">{metric.change}</p>
              </article>
            ))}
          </section>

          <section className="dashboard-section">
            <div className="section-header reveal" data-scroll style={{ "--delay": "120ms" }}>
              <p className="eyebrow">Rollout Timeline</p>
              <h2>Where your project currently stands.</h2>
              <p className="lead">
                This timeline helps your team align implementation checkpoints before launch.
              </p>
            </div>
            <div className="dashboard-timeline">
              {rolloutTimeline.map((item, index) => (
                <article
                  key={item.title}
                  className="dashboard-timeline-item card reveal"
                  data-scroll
                  style={{ "--delay": `${140 + index * 70}ms` }}
                >
                  <span className="dashboard-timeline-index">{`0${index + 1}`}</span>
                  <div>
                    <h3>{item.title}</h3>
                    <p className="muted">{item.detail}</p>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="dashboard-section">
            <div className="section-header reveal" data-scroll style={{ "--delay": "100ms" }}>
              <p className="eyebrow">Backbone Health</p>
              <h2>Finance, Ops, and Talent in sync.</h2>
              <p className="lead">
                Each pillar stays aligned to the same real-time data stream.
              </p>
            </div>
            <div className="dashboard-grid">
              {coreModules.map((module) => (
                <article key={module.id} className="module-card reveal" data-scroll>
                  <div className="module-card-header">
                    <FontAwesomeIcon icon={module.icon} />
                    <span className="module-pill-tag">{module.tag}</span>
                  </div>
                  <h3>{module.name}</h3>
                  <p className="muted">{module.description}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="dashboard-section">
            <div className="section-header reveal" data-scroll style={{ "--delay": "0ms" }}>
              <p className="eyebrow">Active Modules</p>
              <h2>What is turned on for this workspace.</h2>
              <p className="lead">
                Your team only sees the tools selected during configuration.
              </p>
            </div>
            <div className="dashboard-module-grid">
              {configuredModuleIds.map((id) => (
                <article key={id} className="dashboard-module-card card reveal" data-scroll>
                  <div className="dashboard-module-header">
                    <FontAwesomeIcon icon={faCircleCheck} />
                    <span>{moduleLabelMap.get(id) || id}</span>
                  </div>
                  <p className="muted">
                    Active in your workspace and ready for onboarding.
                  </p>
                </article>
              ))}
            </div>
          </section>
        </main>
      </div>
    </section>
  );
}
