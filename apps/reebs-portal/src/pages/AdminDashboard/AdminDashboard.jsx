import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { SelectField } from "@faako/ui";
import PortalAction from "../../components/PortalAction/PortalAction";
import { useAuth } from "../../components/AuthContext/AuthContext";
import DashboardCollections from "./DashboardCollections";
import DashboardActivity from "./DashboardActivity";
import DashboardSkeleton from "./DashboardSkeleton";
import AdminPageHeader from "../../components/AdminPageHeader/AdminPageHeader";
import AppIcon from "../../components/Icon/Icon";
import {
  faBell,
  faBoxesStacked,
  faCalendarDays,
  faCircleCheck,
  faCloudArrowUp,
  faMoneyCheckDollar,
  faPlus,
  faReceipt,
  faRotateRight,
  faStore,
  faArrowRight,
  faChevronDown,
  faExternalLinkAlt,
} from "../../icons/iconSet";
import useDashboardOverview from "./useDashboardOverview";
import {
  WINDOW_OPTIONS,
  appendHealthSample,
  formatDashboardDateTime,
  formatGhs,
  formatRelativeTime,
  getHealthUptime,
  normalizeHealthStatus,
} from "./dashboardViewModel";
import "./AdminDashboard.css";

const statusLabel = (status) => ({
  operational: "Operational",
  degraded: "Degraded",
  down: "Down",
}[status] || "Degraded");

function StatusPill({ status, children }) {
  return <span className={`reebs-dashboard-status is-${status}`}>{children || statusLabel(status)}</span>;
}

function SummaryCard({ icon, label, value, detail, href, tone = "default" }) {
  return (
    <Link className={`bubble-card reebs-dashboard-summary-card is-${tone}`} to={href}>
      <span className="reebs-dashboard-summary-icon"><AppIcon icon={icon} size={22} /></span>
      <span className="reebs-dashboard-summary-copy">
        <span>{label}</span>
        <strong>{value}</strong>
        <small>{detail}</small>
      </span>
      <span className="reebs-dashboard-card-action" aria-hidden="true"><AppIcon icon={faArrowRight} size={20} /></span>
    </Link>
  );
}

function HealthRow({ service, status, samples, description }) {
  const uptime = getHealthUptime(samples);
  const visibleSamples = samples.length ? samples : [status];
  return (
    <div className="reebs-health-row">
      <div className="reebs-health-service">
        <strong>{service}</strong>
        <span>{description}</span>
      </div>
      <StatusPill status={status} />
      <div
        className="reebs-health-segments"
        role="img"
        aria-label={`${service}: ${statusLabel(status)}. ${visibleSamples.length} session check${visibleSamples.length === 1 ? "" : "s"}.`}
      >
        {visibleSamples.map((sample, index) => (
          <span key={`${service}-${index}`} className={`is-${sample}`} title={statusLabel(sample)} />
        ))}
      </div>
      <span className="reebs-health-uptime">
        <strong>{uptime === null ? "Current" : `${uptime}%`}</strong>
        <small>{uptime === null ? "check" : "checks healthy"}</small>
      </span>
    </div>
  );
}

function SystemHealth({ detailed }) {
  const [health, setHealth] = useState({
    loading: true,
    checkedAt: null,
    error: "",
    rows: [],
    history: {},
  });

  const loadHealth = useCallback(async () => {
    const browserStatus = typeof navigator !== "undefined" && navigator.onLine ? "operational" : "down";
    try {
      const response = await fetch("/api/health", { cache: "no-store" });
      const payload = await response.json();
      const apiStatus = response.ok ? normalizeHealthStatus(payload.status) : "down";
      const databaseStatus = normalizeHealthStatus(payload?.dependencies?.database);
      const rows = [
        { id: "portal", service: "REEBS Portal", status: browserStatus, description: "This browser connection" },
        { id: "api", service: "REEBS API", status: apiStatus, description: "Operational API requests" },
        { id: "database", service: "Database", status: databaseStatus, description: "Data readiness" },
      ];
      setHealth((current) => ({
        loading: false,
        checkedAt: payload.timestamp || new Date().toISOString(),
        error: "",
        rows,
        history: rows.reduce((next, row) => ({
          ...next,
          [row.id]: appendHealthSample(current.history[row.id], row.status),
        }), current.history),
      }));
    } catch {
      const rows = [
        { id: "portal", service: "REEBS Portal", status: browserStatus, description: "This browser connection" },
        { id: "api", service: "REEBS API", status: "down", description: "Operational API requests" },
      ];
      setHealth((current) => ({
        loading: false,
        checkedAt: new Date().toISOString(),
        error: "The latest service check could not be completed.",
        rows,
        history: rows.reduce((next, row) => ({
          ...next,
          [row.id]: appendHealthSample(current.history[row.id], row.status),
        }), current.history),
      }));
    }
  }, []);

  useEffect(() => {
    loadHealth();
  }, [loadHealth]);

  const aggregateStatus = health.rows.some((row) => row.status === "down")
    ? "down"
    : health.rows.some((row) => row.status === "degraded")
      ? "degraded"
      : "operational";

  return (
    <section className="reebs-dashboard-section reebs-dashboard-health" aria-labelledby="dashboard-health-heading">
      <div className="reebs-dashboard-section-head">
        <div>
          <h2 id="dashboard-health-heading">System Health</h2>
          <p>{detailed ? "Latest checks from the existing REEBS health endpoint." : "A simple service-readiness signal for daily work."}</p>
        </div>
        <div className="reebs-dashboard-section-actions">
          {!health.loading && <StatusPill status={aggregateStatus} />}
          <PortalAction icon={faRotateRight} label={health.loading ? "Checking" : "Check now"} onClick={loadHealth} disabled={health.loading} />
        </div>
      </div>
      {health.error && <p className="reebs-dashboard-inline-error" role="status">{health.error}</p>}
      {health.loading ? (
        <div className="reebs-health-loading" aria-label="Checking service health" />
      ) : detailed ? (
        <div className="reebs-health-list">
          {health.rows.map((row) => (
            <HealthRow key={row.id} {...row} samples={health.history[row.id] || []} />
          ))}
        </div>
      ) : (
        <div className="reebs-health-simple" role="status">
          <AppIcon icon={aggregateStatus === "operational" ? faCircleCheck : faCloudArrowUp} size={22} />
          <div>
            <strong>{aggregateStatus === "operational" ? "System operational" : "Service check needs attention"}</strong>
            <span>Last checked {formatRelativeTime(health.checkedAt)}</span>
          </div>
        </div>
      )}
      {health.checkedAt && detailed && (
        <p className="reebs-dashboard-freshness">Session history only · Last checked {formatDashboardDateTime(health.checkedAt)}</p>
      )}
    </section>
  );
}

function AdminDashboard() {
  const [windowKey, setWindowKey] = useState("30d");
  const [healthVisible, setHealthVisible] = useState(false);
  const { data, loading, refreshing, error, reload } = useDashboardOverview(windowKey);
  const { user } = useAuth();

  useEffect(() => {
    document.body.classList.add("admin-theme", "reebs-dashboard-theme");
    return () => document.body.classList.remove("admin-theme", "reebs-dashboard-theme");
  }, []);

  const permissions = data?.permissions || {};
  const summary = data?.summary || {};
  const unavailable = data?.unavailable || [];
  const hasAttention = Boolean(data?.attention?.length);
  const creation = permissions.canWriteBookings
    ? { href: "/admin/bookings?action=create", label: "New Booking" }
    : permissions.canWriteOrders ? { href: "/admin/orders/new", label: "New Order" } : null;
  const name = user?.firstName || user?.fullName?.split(" ")[0];
  const currentPeriod = data?.period;

  return (
    <main className="reebs-dashboard-page">
      <AdminPageHeader
        className="reebs-dashboard-header"
        copyClassName="reebs-dashboard-header-copy"
        actionsClassName="admin-header-actions reebs-dashboard-header-actions"
        title={name ? `Welcome back, ${name}` : "Dashboard"}
        subtitle="Dashboard"
        actions={<>
          <SelectField fieldClassName="reebs-dashboard-window" ariaLabel="Summary period" value={windowKey} onChangeValue={setWindowKey} options={WINDOW_OPTIONS} />
          <PortalAction icon={faRotateRight} label={refreshing ? "Refreshing dashboard" : "Refresh dashboard"} onClick={reload} disabled={loading || refreshing} />
          {creation && <PortalAction className="admin-primary reebs-dashboard-create" to={creation.href} action="add" icon={faPlus} label={creation.label} />}
        </>}
      />

      {error && <div className={`reebs-dashboard-error ${data ? "is-stale" : ""}`} role="alert">
        <div><strong>{data ? "Showing the last successful dashboard" : "Dashboard unavailable"}</strong><span>{error}</span>
          {currentPeriod && <span>Displayed period: {currentPeriod.label}</span>}
        </div><PortalAction icon={faRotateRight} label="Try again" onClick={reload} />
      </div>}
      {(loading || refreshing) && data && <p role="status" className="reebs-dashboard-freshness">Updating dashboard. Displayed period: {currentPeriod.label}.</p>}
      {loading && !data ? <DashboardSkeleton /> : data ? <>
        {unavailable.length > 0 && <div className="reebs-dashboard-error" role="status">
          <div><strong>Some sections could not be loaded</strong><span>Unavailable: {unavailable.join(", ")}. Missing figures are not treated as zero.</span></div>
          <PortalAction icon={faRotateRight} label="Retry sections" onClick={reload} />
        </div>}
        <div className={`reebs-dashboard-main-grid ${permissions.canReadFinancials ? "" : "is-operational"}`}>
          <div className="reebs-dashboard-supporting">
            {summary.bookings && <SummaryCard icon={faCalendarDays} label="Bookings in period" value={summary.bookings.inWindow} detail={`Events in ${currentPeriod.label.toLowerCase()}; cancelled excluded`} href="/admin/bookings" />}
            {summary.orders && <SummaryCard icon={faReceipt} label="Open orders" value={summary.orders.open} detail="Awaiting fulfilment · current workload" href="/admin/orders?status=open" />}
            {!permissions.canReadBookings && summary.inventory && <SummaryCard icon={faBoxesStacked} label="Core stock alerts" value={summary.inventory.lowStock + summary.inventory.unavailable} detail="Current low or unavailable stock" href="/admin/inventory?stock=low&reorder=1" />}
          </div>
          {permissions.canReadFinancials && <DashboardCollections payments={summary.payments} period={currentPeriod} unavailable={unavailable.includes("payments")} onRetry={reload} />}
          <div className="reebs-dashboard-financial">
            {summary.payments && <SummaryCard icon={faMoneyCheckDollar} label="Payments received" value={formatGhs(summary.payments.receivedInWindowCents)} detail={currentPeriod.label + " · Core cash receipts"} href="/admin/payments" tone="finance" />}
            {permissions.canReadFinancials && summary.orders && <SummaryCard icon={faMoneyCheckDollar} label="Outstanding balance" value={formatGhs(summary.orders.outstandingCents)} detail="Current unpaid Core orders only" href="/admin/orders?paymentStatus=unpaid" />}
          </div>
        </div>

        <div className="reebs-dashboard-lower-grid">
          <div className="reebs-dashboard-activity-stack">
            <DashboardActivity key={currentPeriod.key} activity={data.activity || []} incomplete={unavailable.some((name) => name.endsWith("activity"))} />
            {(summary.bookings || summary.delivery || summary.inventory) && <section className="glass-card reebs-dashboard-section" aria-labelledby="dashboard-operations-heading">
              <div className="reebs-dashboard-section-head"><div><h2 id="dashboard-operations-heading">Operational snapshot</h2><p>Today’s schedule and current Core stock. Water excluded.</p></div></div>
              <dl className="reebs-dashboard-operations">
                {summary.bookings && <div><dt>Events today</dt><dd>{summary.bookings.today}</dd><dd><PortalAction to="/admin/bookings" action="view" icon={faArrowRight} label="View bookings" /></dd></div>}
                {summary.delivery && <div><dt>Deliveries today</dt><dd>{summary.delivery.today}</dd><dd><PortalAction to="/admin/delivery" action="view" icon={faArrowRight} label="View deliveries" /></dd></div>}
                {summary.inventory && <div><dt>Low-stock products</dt><dd>{summary.inventory.lowStock}</dd><dd><PortalAction to="/admin/inventory?stock=low&reorder=1" action="view" icon={faArrowRight} label="View low-stock products" /></dd></div>}
              </dl>
            </section>}
          </div>
          <section className="glass-card reebs-dashboard-section reebs-dashboard-attention" aria-labelledby="dashboard-attention-heading">
            <div className="reebs-dashboard-section-head"><div><h2 id="dashboard-attention-heading">Needs attention</h2><p>Current Operations</p></div></div>
            {hasAttention ? <div className="reebs-dashboard-alert-list">{data.attention.map((item) => (
              <article className={`reebs-dashboard-alert is-${item.severity}`} key={item.id}>
                <span className="reebs-dashboard-alert-icon"><AppIcon icon={faBell} size={20} /></span>
                <div className="reebs-dashboard-alert-copy"><div><strong>{item.label}</strong><span>{item.count}</span></div><p>{item.detail}</p></div>
                {item.action && <PortalAction to={item.action.href} action="open" icon={faExternalLinkAlt} label={item.action.label} />}
              </article>
            ))}</div> : <p className="reebs-dashboard-empty">{unavailable.length ? "Attention checks are incomplete. Retry the unavailable sections." : "No urgent actions."}</p>}
          </section>
        </div>

        <aside className="reebs-dashboard-water-boundary" aria-label="Water business boundary">
          <div><AppIcon icon={faStore} size={22} /><div><strong>Water remains separate</strong><span>No Water sales, revenue, costs, customers or profit are included above.</span></div></div>
          {permissions.canReadWater && <PortalAction to="/admin/water" action="open" icon={faExternalLinkAlt} label="Open Water Business" />}
        </aside>
        <details className="glass-card reebs-dashboard-service-details" onToggle={(event) => setHealthVisible(event.currentTarget.open)}>
          <summary><span className="reebs-dashboard-health-toggle-copy"><AppIcon icon={faCloudArrowUp} size={20} aria-hidden="true" /><span>System health</span></span><AppIcon className="reebs-dashboard-health-chevron" icon={faChevronDown} size={20} aria-hidden="true" /></summary>
          {healthVisible && <SystemHealth detailed={permissions.canViewSystemHealthDetail} />}
        </details>
        <p className="reebs-dashboard-freshness reebs-dashboard-page-freshness">Data generated {formatDashboardDateTime(data.generatedAt)} · Manual refresh · Stale after 5 minutes</p>
      </> : null}
    </main>
  );
}

export default AdminDashboard;
