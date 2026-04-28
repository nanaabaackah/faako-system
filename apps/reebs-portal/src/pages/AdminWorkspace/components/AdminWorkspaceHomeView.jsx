import React from "react";
import { EmptyState, InlineNotice } from "@faako/ui";
import { AppIcon } from "/src/components/Icon/Icon";
import { faArrowRight, faMinus, faPlus, faRotateRight } from "/src/icons/iconSet";

function PanelShell({ title, subtitle, actions = null, className = "", children }) {
  return (
    <div className={`glass-card aw-panel${className ? ` ${className}` : ""}`}>
      <div className="aw-panel-header">
        <div>
          <h2>{title}</h2>
          {subtitle ? <p className="aw-muted">{subtitle}</p> : null}
        </div>
        {actions}
      </div>
      {children}
    </div>
  );
}


function SummaryCard({ card, onNavigate }) {
  const handleClick = card.onClick || (card.path ? () => onNavigate(card.path) : undefined);
  return (
    <button
      type="button"
      className={`bubble-card aw-home-summary-card aw-home-summary-card--link${card.isActive ? " is-active" : ""}`}
      onClick={handleClick}
      aria-pressed={typeof card.isActive === "boolean" ? card.isActive : undefined}
    >
      <p className="aw-home-kpi-label">{card.label}</p>
      <strong>{card.value}</strong>
      <span>{card.meta}</span>
    </button>
  );
}

function StoreModeHero({ storeModePath, onNavigate }) {
  return (
    <section className="aw-staff-hero">
      <div className="aw-staff-hero-actions">
        <button
          type="button"
          className="aw-primary-btn aw-staff-hero-btn"
          onClick={() => onNavigate(storeModePath)}
          aria-label="Store Mode"
        >
          <AppIcon icon={faArrowRight} />
        </button>
        <span className="aw-staff-hero-cta-label">Store Mode</span>
      </div>
    </section>
  );
}

function SearchResultRow({ title, meta, onClick }) {
  return (
    <button type="button" className="aw-home-search-result" onClick={onClick}>
      <div className="aw-home-search-result-copy">
        <strong>{title}</strong>
        <p>{meta}</p>
      </div>
      <span className="aw-home-search-result-arrow" aria-hidden="true">
        <AppIcon icon={faArrowRight} />
      </span>
    </button>
  );
}

function AssignedWorkPanel({
  workflowError,
  myWorkCards = [],
  assignedWorkItems = [],
  isAssignedWorkListVisible,
  workflowLoading,
  assignedWorkFilter,
  expandedAssignedWorkKey,
  onToggleAssignedWorkItem,
  onNavigate,
  formatDate,
}) {
  const emptyTitle =
    assignedWorkFilter === "my-bookings"
      ? "No bookings in this view."
      : assignedWorkFilter === "my-today"
        ? "Nothing due today."
        : assignedWorkFilter === "my-overdue"
          ? "No overdue work right now."
          : "No orders in this view.";

  const emptyCopy =
    assignedWorkFilter === "my-bookings"
      ? "Bookings assigned to you will show here."
      : assignedWorkFilter === "my-today"
        ? "Orders and bookings due today will show here."
        : assignedWorkFilter === "my-overdue"
          ? "Any overdue order or booking assigned to you will show here first."
          : "Orders assigned to you will show here.";

  return (
    <PanelShell title="Assigned Work">
      {workflowError && <InlineNotice tone="error" compact message={workflowError} />}
      <div className="aw-home-summary-grid">
        {myWorkCards.map((card) => (
          <SummaryCard key={card.key} card={card} onNavigate={onNavigate} />
        ))}
      </div>
      {!isAssignedWorkListVisible ? null : workflowLoading && !assignedWorkItems.length ? (
        <p className="aw-muted">Loading assigned work...</p>
      ) : isAssignedWorkListVisible && assignedWorkItems.length ? (
        <ul className="aw-home-list aw-home-list--work">
          {assignedWorkItems.map((item) => {
            const isExpanded = expandedAssignedWorkKey === item.key;
            const detailId = `assigned-work-${item.key}`;
            const timingLabel = item.overdue
              ? `Due ${formatDate(item.when)}`
              : item.dueToday
                ? `Due today • ${formatDate(item.when)}`
                : `Due ${formatDate(item.when)}`;

            return (
              <li key={item.key}>
                <div className={`aw-home-work-item${isExpanded ? " is-expanded" : ""}`}>
                  <button
                    type="button"
                    className="aw-home-work-toggle"
                    aria-expanded={isExpanded}
                    aria-controls={detailId}
                    onClick={() => onToggleAssignedWorkItem(item.key)}
                  >
                    <div className="aw-home-work-summary">
                      <span className={`aw-home-list-badge${item.overdue ? " is-critical" : item.dueToday ? " is-today" : ""}`}>
                        {item.overdue ? "Overdue" : item.dueToday ? "Today" : item.type}
                      </span>
                      <div className="aw-home-work-copy">
                        <strong>{item.title}</strong>
                        <span>{timingLabel}</span>
                      </div>
                    </div>
                    <span className="aw-home-work-toggle-icon" aria-hidden="true">
                      <AppIcon icon={isExpanded ? faMinus : faPlus} />
                    </span>
                  </button>
                  {isExpanded && (
                    <div id={detailId} className="aw-home-work-body">
                      <p>{item.subtitle}</p>
                      <div className="aw-home-work-actions">
                        <span className="aw-home-work-date">{formatDate(item.when)}</span>
                        <button
                          type="button"
                          className="aw-link-btn"
                          onClick={() => onNavigate(item.path)}
                        >
                          Open task
                          <AppIcon icon={faArrowRight} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      ) : isAssignedWorkListVisible ? (
        <EmptyState title={emptyTitle} message={emptyCopy} />
      ) : null}
    </PanelShell>
  );
}

function QuickActionsPanel({ actions, onNavigate }) {
  const safeActions = Array.isArray(actions) ? actions : [];
  return (
    <div className="aw-nopanel">
      <div className="aw-toolbar aw-quick-actions-grid">
        {safeActions.map((item) => (
          <button
            key={item.key}
            type="button"
            className="aw-quick-action-btn"
            onClick={() => onNavigate(item.path)}
          >
            <AppIcon icon={item.icon} />
            <span>{item.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function RecommendationsPanel({ items, onNavigate }) {
  const safeItems = Array.isArray(items) ? items : [];
  return (
    <PanelShell title="Recommendations">
      <ul className="aw-home-list aw-home-list--recommendations">
        {safeItems.map((item) => (
          <li key={item.key}>
            <button
              type="button"
              className="aw-home-list-item aw-home-list-item--link"
              onClick={() => onNavigate(item.path)}
            >
              <div>
                <strong>{item.title}</strong>
                <p>{item.note}</p>
              </div>
              <div className="aw-home-list-meta">
                <AppIcon icon={faArrowRight} />
              </div>
            </button>
          </li>
        ))}
      </ul>
    </PanelShell>
  );
}

function BusinessKpiPanel({ panel, onNavigate }) {
  if (!panel?.visible) return null;
  const summaryCards = Array.isArray(panel.summaryCards) ? panel.summaryCards : [];
  const windowOptions = Array.isArray(panel.windowOptions) ? panel.windowOptions : [];
  const revenueMix = panel.revenueMix || {
    path: "",
    radius: 53,
    circumference: 2 * Math.PI * 53,
    donut: [],
    segments: [],
    total: 0,
    totalValue: "GHS 0.00",
  };
  const revenueTrend = panel.revenueTrend || {
    path: "",
    windowLabel: "",
    loading: false,
    error: "",
    hasData: false,
    latestValue: "GHS 0.00",
    deltaLabel: "",
    rangeLabel: "",
    spark: { fillPoints: "", linePoints: "" },
  };
  const stockMovement = panel.stockMovement || {
    path: "",
    loading: false,
    error: "",
    hasData: false,
    totals: { stockIn: 0, stockOut: 0 },
    spark: { fillPoints: "", linePoints: "" },
    rangeLabel: "",
    velocityTotalsLabel: "",
    velocityTrend: [],
    velocityMax: 1,
  };
  const operationalLoad = panel.operationalLoad || {
    path: "",
    bars: [],
    max: 1,
  };

  return (
    <PanelShell
      title="Business KPI Dashboard"
      subtitle={panel.updatedAt ? (
        <span className={`aw-freshness${panel.dataFreshnessClass ? ` ${panel.dataFreshnessClass}` : ""}`}>
          {`Updated ${panel.updatedAt} • ${panel.sourceLabel}`}
        </span>
      ) : panel.sourceLabel}
      className="aw-home-kpi-panel"
      actions={(
        <div className="aw-home-kpi-window-pills">
          <div className="aw-qty-pills" role="tablist" aria-label="Dashboard KPI window">
            {windowOptions.map((option) => (
              <button
                key={option.key}
                type="button"
                role="tab"
                aria-selected={panel.activeWindow === option.key}
                className={`aw-pill ${panel.activeWindow === option.key ? "is-active" : ""}`}
                onClick={() => panel.onWindowChange(option.key)}
              >
                {option.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="aw-secondary-btn"
            onClick={panel.onRefresh}
            disabled={panel.refreshDisabled}
          >
            <AppIcon icon={faRotateRight} />
            Refresh KPI
          </button>
        </div>
      )}
    >
      {panel.loading && (
        <div className="aw-home-kpi-grid" aria-hidden="true">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="aw-skeleton aw-skeleton-kpi-card" />
          ))}
        </div>
      )}
      {!panel.loading && panel.error && (
        <div className="aw-chart-error">
          <InlineNotice tone="error" compact message={panel.error} />
          <button type="button" className="aw-link-btn" onClick={panel.onRetryKpi}>
            Retry
          </button>
        </div>
      )}
      {!panel.loading && !panel.error && (
        <>
          <div className="aw-home-kpi-grid">
            {summaryCards.map((card) => (
              <button
                key={card.key}
                type="button"
                className="button-card aw-home-kpi-card aw-home-kpi-card-hero"
                onClick={() => onNavigate(card.path)}
                aria-label={`${card.label}: ${card.value}`}
              >
                <p className="aw-home-kpi-label">{card.label}</p>
                <strong>{card.value}</strong>
                <span>{card.meta}</span>
                {card.meterWidth !== undefined ? (
                  <div className={`aw-home-kpi-meter${card.meterClass ? ` ${card.meterClass}` : ""}`}>
                    <span style={{ width: `${card.meterWidth}%` }} />
                  </div>
                ) : null}
              </button>
            ))}
          </div>

          <div className="aw-home-kpi-chart-grid">
            <button
              type="button"
              className="button-card aw-home-kpi-chart-card aw-home-kpi-chart-card--link"
              onClick={() => onNavigate(revenueMix.path)}
            >
              <div className="aw-home-kpi-chart-head">
                <h3>Revenue mix</h3>
                <span>Retail, rental, expenses</span>
              </div>
              <div className="aw-home-kpi-donut-wrap">
                <div className="aw-home-kpi-donut-shell">
                  <svg viewBox="0 0 120 120" role="img" aria-label="Revenue composition">
                    <circle className="aw-home-kpi-donut-track" cx="60" cy="60" r={revenueMix.radius} />
                    {revenueMix.donut.map((segment) => (
                      <circle
                        key={segment.key}
                        cx="60"
                        cy="60"
                        r={revenueMix.radius}
                        fill="none"
                        stroke={segment.color}
                        strokeWidth="12"
                        strokeLinecap="round"
                        strokeDasharray={`${segment.dash} ${revenueMix.circumference - segment.dash}`}
                        strokeDashoffset={segment.offset}
                        transform="rotate(-90 60 60)"
                      />
                    ))}
                  </svg>
                  <div className="aw-home-kpi-donut-center">
                    <strong>{revenueMix.totalValue}</strong>
                    <span>Total revenue</span>
                  </div>
                </div>
                <ul className="aw-home-kpi-legend">
                  {revenueMix.segments.map((segment) => {
                    const percentage = revenueMix.total
                      ? Math.round((segment.value / revenueMix.total) * 100)
                      : 0;
                    return (
                      <li key={segment.key}>
                        <span style={{ backgroundColor: segment.color }} />
                        <b>{segment.label}</b>
                        <em>{percentage}%</em>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </button>

            <button
              type="button"
              className="button-card aw-home-kpi-chart-card aw-home-kpi-chart-card--link"
              onClick={() => onNavigate(revenueTrend.path)}
            >
              <div className="aw-home-kpi-chart-head">
                <h3>Revenue trend</h3>
                <span>{revenueTrend.windowLabel}</span>
              </div>
              {revenueTrend.loading ? (
                <div className="aw-skeleton aw-skeleton-chart-card" aria-hidden="true" />
              ) : revenueTrend.error ? (
                <div className="aw-chart-error">
                  <InlineNotice tone="error" compact message={revenueTrend.error} />
                  <button type="button" className="aw-link-btn" onClick={revenueTrend.onRetry}>Retry</button>
                </div>
              ) : revenueTrend.hasData ? (
                <div className="aw-home-kpi-spark-panel">
                  <div className="aw-home-kpi-spark-stat">
                    <strong>{revenueTrend.latestValue}</strong>
                    <span>Latest day</span>
                  </div>
                  <div className="aw-home-kpi-spark-shell" aria-hidden="true">
                    <svg viewBox="0 0 100 100" preserveAspectRatio="none">
                      <polygon className="aw-home-kpi-spark-fill" points={revenueTrend.spark.fillPoints} />
                      <polyline className="aw-home-kpi-spark-line" points={revenueTrend.spark.linePoints} />
                    </svg>
                  </div>
                  <div className="aw-home-kpi-spark-meta">
                    <strong>{revenueTrend.deltaLabel}</strong>
                    <span>{revenueTrend.rangeLabel}</span>
                  </div>
                </div>
              ) : (
                <p className="aw-muted">No revenue trend yet.</p>
              )}
            </button>

            <button
              type="button"
              className="button-card aw-home-kpi-chart-card aw-home-kpi-chart-card--link"
              onClick={() => onNavigate(stockMovement.path)}
            >
              <div className="aw-home-kpi-chart-head">
                <h3>Stock movement</h3>
                <span>12 months + recent velocity</span>
              </div>
              {stockMovement.loading ? (
                <div className="aw-skeleton aw-skeleton-chart-card" aria-hidden="true" />
              ) : stockMovement.error ? (
                <div className="aw-chart-error">
                  <InlineNotice tone="error" compact message={stockMovement.error} />
                  <button type="button" className="aw-link-btn" onClick={stockMovement.onRetry}>Retry</button>
                </div>
              ) : stockMovement.hasData ? (
                <div className="aw-home-kpi-stock-panel">
                  <div className="aw-home-kpi-stock-summary">
                    <div>
                      <strong>{stockMovement.totals.stockIn}</strong>
                      <span>12m stock in</span>
                    </div>
                    <div>
                      <strong>{stockMovement.totals.stockOut}</strong>
                      <span>12m stock out</span>
                    </div>
                  </div>
                  <div className="aw-home-kpi-spark-shell aw-home-kpi-spark-shell--stock" aria-hidden="true">
                    <svg viewBox="0 0 100 100" preserveAspectRatio="none">
                      <polygon className="aw-home-kpi-spark-fill is-stock" points={stockMovement.spark.fillPoints} />
                      <polyline className="aw-home-kpi-spark-line is-stock" points={stockMovement.spark.linePoints} />
                    </svg>
                  </div>
                  <div className="aw-home-kpi-spark-meta">
                    <strong>{stockMovement.rangeLabel}</strong>
                    <span>{stockMovement.velocityTotalsLabel}</span>
                  </div>
                  {stockMovement.velocityTrend.length > 0 && (
                    <ul className="aw-home-kpi-velocity-list">
                      {stockMovement.velocityTrend.map((entry) => (
                        <li key={entry.label} className="aw-home-kpi-velocity-row">
                          <span>{entry.label}</span>
                          <div className="aw-home-kpi-velocity-bars">
                            <span
                              className="is-in"
                              style={{ width: `${Math.round((entry.stockIn / stockMovement.velocityMax) * 100)}%` }}
                            />
                            <span
                              className="is-out"
                              style={{ width: `${Math.round((entry.stockOut / stockMovement.velocityMax) * 100)}%` }}
                            />
                          </div>
                          <strong>{entry.stockIn}/{entry.stockOut}</strong>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ) : (
                <p className="aw-muted">No stock history yet.</p>
              )}
            </button>

            <button
              type="button"
              className="button-card aw-home-kpi-chart-card aw-home-kpi-chart-card--link"
              onClick={() => onNavigate(operationalLoad.path)}
            >
              <div className="aw-home-kpi-chart-head">
                <h3>Operational load</h3>
                <span>Key queues right now</span>
              </div>
              <ul className="aw-home-kpi-bars">
                {operationalLoad.bars.map((entry) => {
                  const widthPct = Math.round((entry.value / operationalLoad.max) * 100);
                  return (
                    <li key={entry.key} className="aw-home-kpi-bar-row">
                      <div className="aw-home-kpi-bar-label">
                        <span>{entry.label}</span>
                        <strong>{entry.value}</strong>
                      </div>
                      <div className="aw-home-kpi-bar-track">
                        <span
                          style={{
                            width: `${entry.value > 0 ? Math.max(10, widthPct) : 0}%`,
                            backgroundColor: entry.color,
                          }}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </button>
          </div>

          {(panel.topProducts?.length > 0 || panel.topRentalBookings?.length > 0) && (
            <div className="aw-home-top-performers glass-card" style={{ marginTop: "1rem" }}>
              <p className="aw-home-kpi-label">Top performers</p>
              <div className="aw-home-top-performers-grids">
                {panel.topProducts?.length > 0 && (
                  <div>
                    <p className="aw-home-kpi-label" style={{ fontSize: "0.74rem", marginBottom: "0.3rem" }}>
                      Best-selling products
                    </p>
                    <ul className="aw-home-top-list">
                      {panel.topProducts.slice(0, 5).map((p, i) => (
                        <li key={p.id || p.sku || i}>
                          <span className="aw-home-top-rank">{i + 1}</span>
                          <span>{p.name || p.sku || "Product"}</span>
                          <strong>{p.units} unit{p.units === 1 ? "" : "s"}</strong>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {panel.topRentalBookings?.length > 0 && (
                  <div>
                    <p className="aw-home-kpi-label" style={{ fontSize: "0.74rem", marginBottom: "0.3rem" }}>
                      Top rental items
                    </p>
                    <ul className="aw-home-top-list">
                      {panel.topRentalBookings.slice(0, 5).map((p, i) => (
                        <li key={p.id || p.sku || i}>
                          <span className="aw-home-top-rank">{i + 1}</span>
                          <span>{p.name || p.sku || "Item"}</span>
                          <strong>{p.units} unit{p.units === 1 ? "" : "s"}</strong>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </PanelShell>
  );
}

function ApprovalsPanel({ panel, onNavigate }) {
  const safePanel = panel || { items: [], loading: false, emptyPath: "" };
  const items = Array.isArray(safePanel.items) ? safePanel.items : [];
  return (
    <PanelShell
      title="Approvals queue"
      actions={<span className="aw-count-pill">{items.length} waiting</span>}
    >
      {safePanel.loading && !items.length ? (
        <p className="aw-muted">Loading approvals...</p>
      ) : items.length ? (
        <ul className="aw-queue-list">
          {items.map((item) => (
            <li key={item.key} className="aw-queue-item">
              <div>
                <strong>{item.title}</strong>
                <p>{item.meta}</p>
                <p>{item.reason}</p>
                <p>{item.ageLabel}</p>
              </div>
              <div className="aw-queue-status">
                <span className="aw-status-chip pending">{item.amountLabel}</span>
                <button type="button" className="aw-link-btn" onClick={() => onNavigate(item.href)}>
                  Review
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          title="No approvals waiting."
          message="Open orders or bookings directly if you want to review the wider queue."
          actions={(
            <button type="button" className="aw-link-btn" onClick={() => onNavigate(safePanel.emptyPath)}>
              Open orders
            </button>
          )}
        />
      )}
    </PanelShell>
  );
}

function TeamLoadPanel({ panel, onNavigate }) {
  const safePanel = panel || { rows: [], loading: false, emptyPath: "" };
  const rows = Array.isArray(safePanel.rows) ? safePanel.rows : [];
  return (
    <PanelShell title="Team Load">
      {safePanel.loading && !rows.length ? (
        <p className="aw-muted">Loading team workload...</p>
      ) : rows.length ? (
        <ul className="aw-home-list aw-home-list--team">
          {rows.map((row) => (
            <li key={row.id}>
              <button
                type="button"
                className="aw-home-list-item aw-home-list-item--link"
                onClick={() => onNavigate(row.path)}
              >
                <div>
                  <strong>{row.name}</strong>
                  <p>{row.orders} orders • {row.bookings} bookings • {row.overdue} overdue</p>
                </div>
                <div className="aw-home-list-meta">
                  <span>{row.activeSessionCount ? `${row.activeSessionCount} live` : "Offline"}</span>
                  <strong className="aw-home-team-total">{row.total}</strong>
                </div>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          title="No team workload data yet."
          message="Assigned orders and bookings will populate the team board automatically."
          actions={(
            <button type="button" className="aw-link-btn" onClick={() => onNavigate(safePanel.emptyPath)}>
              Open team directory
            </button>
          )}
        />
      )}
    </PanelShell>
  );
}

function CustomerHealthPanel({ panel, onNavigate }) {
  const safePanel = panel || {};
  const summaryCards = Array.isArray(safePanel.summaryCards) ? safePanel.summaryCards : [];
  const topCustomers = Array.isArray(safePanel.topCustomers) ? safePanel.topCustomers : [];
  const inactiveVipCustomers = Array.isArray(safePanel.inactiveVipCustomers)
    ? safePanel.inactiveVipCustomers
    : [];
  const getCustomerPath = safePanel.getCustomerPath || (() => "");
  const getCustomerValueLabel = safePanel.getCustomerValueLabel || (() => "");
  const getInactiveMeta = safePanel.getInactiveMeta || (() => "");
  return (
    <PanelShell title="Customer Health">
      <div className="aw-home-kpi-grid aw-home-kpi-grid-tight">
        {summaryCards.map((card) => (
          <button
            key={card.key}
            type="button"
            className="bubble-card aw-home-kpi-card"
            onClick={() => onNavigate(card.path)}
          >
            <p className="aw-home-kpi-label">{card.label}</p>
            <strong>{card.value}</strong>
            <span>{card.meta}</span>
          </button>
        ))}
      </div>
      <div className="aw-home-grid" style={{ marginTop: "1rem" }}>
        <div className="aw-home-customer-column glass-card">
          <p className="aw-home-kpi-label">Top customers</p>
          <ul className="aw-home-search-results aw-home-search-results--compact">
            {topCustomers.map((customer) => (
              <li key={`top-${customer.id}`}>
                <SearchResultRow
                  title={customer.name}
                  meta={getCustomerValueLabel(customer)}
                  onClick={() => onNavigate(getCustomerPath(customer.id))}
                />
              </li>
            ))}
          </ul>
        </div>
        <div className="aw-home-customer-column glass-card">
          <p className="aw-home-kpi-label">Inactive VIPs</p>
          {inactiveVipCustomers.length ? (
            <ul className="aw-home-search-results aw-home-search-results--compact">
              {inactiveVipCustomers.map((customer) => (
                <li key={`vip-${customer.id}`}>
                  <SearchResultRow
                    title={customer.name}
                    meta={getInactiveMeta(customer)}
                    onClick={() => onNavigate(getCustomerPath(customer.id))}
                  />
                </li>
              ))}
            </ul>
          ) : (
            <p className="aw-muted">No inactive VIP customers right now.</p>
          )}
        </div>
      </div>
    </PanelShell>
  );
}

function ActivityPanel({ panel, onNavigate, formatRelativeTime, formatDateTime }) {
  const safePanel = panel || {};
  const items = Array.isArray(safePanel.items) ? safePanel.items : [];
  const title =
    safePanel.canViewHomeKpis && safePanel.activityScope === "team" ? "Team activity" : "Your activity";

  return (
    <PanelShell
      title={title}
      subtitle="Orders, bookings, stock movements, and sync actions in one list."
      className="aw-staff-panel"
      actions={(
        <div className="aw-home-toggle-group">
          {safePanel.canViewHomeKpis && (
            <div className="aw-qty-pills" role="tablist" aria-label="Activity scope">
              <button
                type="button"
                role="tab"
                aria-selected={safePanel.activityScope === "team"}
                className={`aw-pill ${safePanel.activityScope === "team" ? "is-active" : ""}`}
                onClick={() => safePanel.onScopeChange?.("team")}
              >
                Team
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={safePanel.activityScope === "mine"}
                className={`aw-pill ${safePanel.activityScope === "mine" ? "is-active" : ""}`}
                onClick={() => safePanel.onScopeChange?.("mine")}
              >
                Mine
              </button>
            </div>
          )}
        </div>
      )}
    >
      {safePanel.error && <InlineNotice tone="error" compact message={safePanel.error} />}
      {safePanel.loading && !items.length ? (
        <p className="aw-muted">Loading activity...</p>
      ) : items.length ? (
        <ul className="aw-activity-list">
          {items.map((item, index) => {
            const ActivityTag = item.href ? "button" : "div";
            return (
              <li key={item.id}>
                <ActivityTag
                  type={item.href ? "button" : undefined}
                  className={`aw-activity-item ${item.visual.accentClass}${item.href ? " aw-activity-item--link" : ""}`}
                  onClick={item.href ? () => onNavigate(item.href) : undefined}
                >
                  <div className="aw-activity-rail" aria-hidden="true">
                    <span className={`aw-activity-icon ${item.visual.accentClass}`}>
                      <AppIcon icon={item.visual.icon} />
                    </span>
                    {index < items.length - 1 && <span className="aw-activity-line" />}
                  </div>
                  <div className="aw-activity-main">
                    <div className="aw-activity-topline">
                      <span className={`aw-status-chip ${item.tone || "pending"}`}>
                        {item.badgeLabel || "Activity"}
                      </span>
                      <span className="aw-activity-topline-end">
                        <span className="aw-activity-time">{formatRelativeTime(item.createdAt)}</span>
                        {item.href && (
                          <span className="aw-activity-cue" aria-hidden="true">
                            <AppIcon icon={faArrowRight} />
                          </span>
                        )}
                      </span>
                    </div>
                    <strong>{item.label || "Store activity"}</strong>
                    {item.meta && <p className="aw-activity-meta">{item.meta}</p>}
                    <div className="aw-activity-foot">
                      <span className="aw-activity-stamp">{formatDateTime(item.createdAt)}</span>
                      {item.actor && safePanel.activityScope === "team" && !item.lastError && <small>{item.actor}</small>}
                      {item.lastError && <small>{item.lastError}</small>}
                    </div>
                  </div>
                </ActivityTag>
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState
          title="No staff activity logged yet."
          message="Orders, bookings, stock changes, and pending sync actions will appear here once work starts."
        />
      )}
    </PanelShell>
  );
}

export function AdminWorkspaceHomeView({
  storeModePath,
  workflowError,
  myWorkCards = [],
  assignedWorkItems = [],
  isAssignedWorkListVisible,
  workflowLoading,
  assignedWorkFilter,
  expandedAssignedWorkKey,
  onToggleAssignedWorkItem,
  onNavigate,
  formatDate,
  homeSummaryCards = [],
  homeQuickActions = [],
  recommendationItems = [],
  kpiPanel,
  approvalsPanel,
  teamLoadPanel,
  customerHealthPanel,
  activityPanel,
  formatRelativeTime,
  formatDateTime,
}) {
  const hasAssignedWorkPanel =
    Boolean(workflowError)
    || myWorkCards.length > 0
    || assignedWorkItems.length > 0;

  return (
    <section className="aw-section-grid aw-home-view">
      <StoreModeHero storeModePath={storeModePath} onNavigate={onNavigate} />

      <QuickActionsPanel actions={homeQuickActions} onNavigate={onNavigate} />

      {hasAssignedWorkPanel && (
        <AssignedWorkPanel
          workflowError={workflowError}
          myWorkCards={myWorkCards}
          assignedWorkItems={assignedWorkItems}
          isAssignedWorkListVisible={isAssignedWorkListVisible}
          workflowLoading={workflowLoading}
          assignedWorkFilter={assignedWorkFilter}
          expandedAssignedWorkKey={expandedAssignedWorkKey}
          onToggleAssignedWorkItem={onToggleAssignedWorkItem}
          onNavigate={onNavigate}
          formatDate={formatDate}
        />
      )}

      {homeSummaryCards.length > 0 && (
        <div className="aw-home-summary-grid">
          {homeSummaryCards.map((card) => (
            <SummaryCard key={card.key} card={card} onNavigate={onNavigate} />
          ))}
        </div>
      )}
      <RecommendationsPanel items={recommendationItems} onNavigate={onNavigate} />
      <BusinessKpiPanel panel={kpiPanel} onNavigate={onNavigate} />

      {kpiPanel?.visible && (
        <>
          <div className="aw-home-grid">
            <ApprovalsPanel panel={approvalsPanel} onNavigate={onNavigate} />
            <TeamLoadPanel panel={teamLoadPanel} onNavigate={onNavigate} />
          </div>
          <CustomerHealthPanel panel={customerHealthPanel} onNavigate={onNavigate} />
        </>
      )}

      <ActivityPanel
        panel={activityPanel}
        onNavigate={onNavigate}
        formatRelativeTime={formatRelativeTime}
        formatDateTime={formatDateTime}
      />
    </section>
  );
}
