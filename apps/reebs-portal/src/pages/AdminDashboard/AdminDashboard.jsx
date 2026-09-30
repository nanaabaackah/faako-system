import React, { useCallback, useEffect, useState } from "react";
import { AnimatedLoadingState } from "@faako/ui";
import { Link } from "react-router-dom";
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
  faTruck,
  faUserPlus,
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

const HEALTH_REFRESH_MS = 120_000;

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
      <span className="reebs-dashboard-card-action" aria-hidden="true">View</span>
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
        <small>{uptime === null ? "check" : "session uptime"}</small>
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
        { id: "database", service: "Database", status: databaseStatus, description: "Core data readiness" },
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
    const timer = window.setInterval(loadHealth, HEALTH_REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [loadHealth]);

  const aggregateStatus = health.rows.some((row) => row.status === "down")
    ? "down"
    : health.rows.some((row) => row.status === "degraded")
      ? "degraded"
      : "operational";

  return (
    <section className="glass-card reebs-dashboard-section reebs-dashboard-health" aria-labelledby="dashboard-health-heading">
      <div className="reebs-dashboard-section-head">
        <div>
          <h2 id="dashboard-health-heading">System Health</h2>
          <p>{detailed ? "Latest checks from the existing REEBS health endpoint." : "A simple service-readiness signal for daily work."}</p>
        </div>
        <div className="reebs-dashboard-section-actions">
          {!health.loading && <StatusPill status={aggregateStatus} />}
          <button type="button" className="reebs-dashboard-icon-button" onClick={loadHealth} disabled={health.loading}>
            <AppIcon icon={faRotateRight} size={18} />
            <span>{health.loading ? "Checking" : "Check now"}</span>
          </button>
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
  const [windowKey, setWindowKey] = useState("today");
  const { data, loading, refreshing, error, reload } = useDashboardOverview(windowKey);

  useEffect(() => {
    document.body.classList.add("admin-theme", "reebs-dashboard-theme");
    return () => document.body.classList.remove("admin-theme", "reebs-dashboard-theme");
  }, []);

  const permissions = data?.permissions || {};
  const summary = data?.summary || {};
  const quickActions = [
    permissions.canWriteBookings && { label: "New Booking", href: "/admin/bookings?action=create", icon: faCalendarDays },
    permissions.canWriteOrders && { label: "New Order", href: "/admin/orders/new", icon: faReceipt },
    permissions.canWriteCustomers && { label: "Add Customer", href: "/admin/directory?tab=customers&action=create", icon: faUserPlus },
    permissions.canWriteOrders && permissions.canReadFinancials && { label: "Record Payment", href: "/admin/orders?paymentStatus=unpaid", icon: faMoneyCheckDollar },
    permissions.canReadInventory && !permissions.canWriteOrders && { label: "Review Stock", href: "/admin/inventory?stock=low", icon: faBoxesStacked },
  ].filter(Boolean).slice(0, 4);

  const hasAttention = Boolean(data?.attention?.length);

  return (
    <main className="reebs-dashboard-page">
      <AdminPageHeader
        className="reebs-dashboard-header"
        copyClassName="reebs-dashboard-header-copy"
        actionsClassName="admin-header-actions reebs-dashboard-header-actions"
        title="Dashboard"
        subtitle="See what needs attention across rentals, orders, stock, payments and delivery."
        actions={(
          <>
          <label className="reebs-dashboard-window">
            <span>Summary period</span>
            <select value={windowKey} onChange={(event) => setWindowKey(event.target.value)}>
              {WINDOW_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
          <button type="button" className="reebs-dashboard-refresh" onClick={reload} disabled={loading || refreshing}>
            <AppIcon icon={faRotateRight} size={18} />
            <span>{refreshing ? "Refreshing" : "Refresh"}</span>
          </button>
          </>
        )}
      />

      {error && (
        <div className={`reebs-dashboard-error ${data ? "is-stale" : ""}`} role="alert">
          <div>
            <strong>{data ? "Showing the last successful dashboard" : "Dashboard unavailable"}</strong>
            <span>{error}</span>
          </div>
          <button type="button" onClick={reload}>Try again</button>
        </div>
      )}

      {loading && !data ? (
        <AnimatedLoadingState
          page
          embedded
          variant="dashboard"
          title="Loading Core operations"
        />
      ) : data ? (
        <>
        <section className="glass-card reebs-dashboard-section" aria-labelledby="dashboard-summary-heading">
            <div className="reebs-dashboard-section-head">
              <div>
                <h2 id="dashboard-summary-heading">Operational Summary</h2>
                <p>{data.period.label} · REEBS Core only</p>
              </div>
            </div>
            <div className="reebs-dashboard-summary-grid">
              {summary.bookings && <SummaryCard icon={faCalendarDays} label="Bookings today" value={summary.bookings.today} detail={`${summary.bookings.awaitingConfirmation} awaiting confirmation`} href="/admin/bookings?timing=today" />}
              {summary.bookings && <SummaryCard icon={faCalendarDays} label="Upcoming bookings" value={summary.bookings.upcoming} detail="Starting in the next 7 days" href="/admin/bookings?timing=next7" />}
              {summary.orders && <SummaryCard icon={faReceipt} label="Open orders" value={summary.orders.open} detail={`${summary.orders.inWindow} in ${data.period.label.toLowerCase()}`} href="/admin/orders?status=open" />}
              {summary.payments && <SummaryCard icon={faMoneyCheckDollar} label="Payments received" value={formatGhs(summary.payments.receivedInWindowCents)} detail={`${summary.payments.mobileMoneyPayments} Mobile Money payment${summary.payments.mobileMoneyPayments === 1 ? "" : "s"}`} href="/admin/accounting" tone="finance" />}
              {summary.payments && summary.orders && <SummaryCard icon={faMoneyCheckDollar} label="Outstanding payments" value={formatGhs(summary.orders.outstandingCents)} detail={`${summary.orders.awaitingPayment} orders need payment`} href="/admin/orders?paymentStatus=unpaid" />}
              {summary.inventory && <SummaryCard icon={faBoxesStacked} label="Low stock" value={summary.inventory.lowStock} detail="Core products at reorder level" href="/admin/inventory?stock=low&reorder=1" />}
              {summary.inventory && <SummaryCard icon={faBoxesStacked} label="Unavailable stock" value={summary.inventory.unavailable} detail="Core products currently unavailable" href="/admin/inventory?stock=out" />}
              {summary.delivery && <SummaryCard icon={faTruck} label="Deliveries today" value={summary.delivery.today} detail={`${summary.delivery.pending} pending`} href="/admin/delivery" />}
            </div>
          </section>

          <section className="glass-card reebs-dashboard-section reebs-dashboard-attention" aria-labelledby="dashboard-attention-heading">
            <div className="reebs-dashboard-section-head">
              <div>
                <h2 id="dashboard-attention-heading">Immediate Attention</h2>
                <p>Prioritised from live Core records. Counts are never hardcoded.</p>
              </div>
              <span className={`reebs-dashboard-attention-total ${hasAttention ? "has-items" : ""}`}>
                {hasAttention ? `${data.attention.length} action group${data.attention.length === 1 ? "" : "s"}` : "All clear"}
              </span>
            </div>
            {hasAttention ? (
              <div className="reebs-dashboard-alert-list">
                {data.attention.map((item) => (
                  <article className={`reebs-dashboard-alert is-${item.severity}`} key={item.id}>
                    <span className="reebs-dashboard-alert-icon"><AppIcon icon={faBell} size={20} /></span>
                    <div className="reebs-dashboard-alert-copy">
                      <div><strong>{item.label}</strong><span>{item.count}</span></div>
                      <p>{item.detail}</p>
                    </div>
                    {item.action && <Link to={item.action.href}>{item.action.label}</Link>}
                  </article>
                ))}
              </div>
            ) : (
              <div className="reebs-dashboard-clear-state">
                <AppIcon icon={faCircleCheck} size={26} />
                <div><strong>No urgent Core actions</strong><span>New operational issues will appear here.</span></div>
              </div>
            )}
          </section>

          <section className="glass-card reebs-dashboard-section reebs-dashboard-quick" aria-labelledby="dashboard-actions-heading">
            <div className="reebs-dashboard-section-head">
              <div>
                <h2 id="dashboard-actions-heading">Quick Actions</h2>
                <p>Only actions available to your role are shown.</p>
              </div>
            </div>
            <div className="reebs-dashboard-action-grid">
              {quickActions.map((action) => (
                <Link className="bubble-card" key={action.label} to={action.href}>
                  <span><AppIcon icon={action.icon} size={20} /></span>
                  <strong>{action.label}</strong>
                  <AppIcon icon={faPlus} size={17} />
                </Link>
              ))}
            </div>
          </section>

          <section className="glass-card reebs-dashboard-section reebs-dashboard-activity" aria-labelledby="dashboard-activity-heading">
            <div className="reebs-dashboard-section-head">
              <div>
                <h2 id="dashboard-activity-heading">Recent Activity</h2>
                <p>Permission-filtered updates without private customer or cost details.</p>
              </div>
            </div>
            {data.activity.length ? (
              <ol className="reebs-dashboard-activity-list">
                {data.activity.map((item) => (
                  <li key={item.id}>
                    <span className={`reebs-dashboard-activity-mark is-${item.kind}`} aria-hidden="true" />
                    <div>
                      <strong>{item.summary}</strong>
                      <span>{item.reference || item.kind} · {formatRelativeTime(item.createdAt)}</span>
                    </div>
                    <Link to={item.href}>Open<span className="sr-only"> {item.reference}</span></Link>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="reebs-dashboard-empty">No recent Core activity is available for your role.</p>
            )}
          </section>

          <SystemHealth detailed={permissions.canViewSystemHealthDetail} />

          <aside className="glass-card reebs-dashboard-water-boundary" aria-label="Water business boundary">
            <div>
              <AppIcon icon={faStore} size={22} />
              <div>
                <strong>Water remains separate</strong>
                <span>No Water sales, revenue, costs, customers or profit are included above.</span>
              </div>
            </div>
            {permissions.canReadWater && <Link to="/admin/water">Open Water Business</Link>}
          </aside>

          <p className="reebs-dashboard-freshness reebs-dashboard-page-freshness">
            Core data generated {formatDashboardDateTime(data.generatedAt)} · Manual refresh · Stale after 5 minutes
          </p>
        </>
      ) : null}
    </main>
  );
}

export default AdminDashboard;
