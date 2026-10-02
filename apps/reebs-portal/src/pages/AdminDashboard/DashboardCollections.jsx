import React from "react";
import PortalAction from "../../components/PortalAction/PortalAction";
import { faRotateRight } from "../../icons/iconSet";
import { formatDashboardDateTime, formatGhs } from "./dashboardViewModel";

const tickLabel = (value, hourly) => new Intl.DateTimeFormat("en-GH", {
  timeZone: "Africa/Accra", ...(hourly ? { hour: "numeric", minute: "2-digit" } : { day: "numeric", month: "short" }),
}).format(new Date(value));
const axisAmount = (cents) => new Intl.NumberFormat("en-GH", {
  style: "currency", currency: "GHS", notation: "compact", maximumFractionDigits: 1,
}).format(cents / 100);

export default function DashboardCollections({ payments, period, unavailable, onRetry }) {
  const series = payments?.series || [];
  const maximum = Math.max(1, ...series.map((point) => point.amountCents));
  const minimum = Math.min(0, ...series.map((point) => point.amountCents));
  const hasData = series.some((point) => point.amountCents !== 0);
  const points = series.map((point, index) => ({ ...point, x: 110 + index * 370 / Math.max(1, series.length - 1), y: 210 - (point.amountCents - minimum) / (maximum - minimum) * 165 }));
  const comparison = payments?.comparison;
  return (
    <section className="glass-card reebs-dashboard-section reebs-dashboard-collections" aria-labelledby="collections-heading">
      <div className="reebs-dashboard-section-head"><div>
        <h2 id="collections-heading">Core collections</h2>
        <p>Payments received · {period.label} · GHS</p>
      </div></div>
      {unavailable || !payments ? <div className="reebs-dashboard-empty" role="status">
        <p>Collections are unavailable. No estimated total is shown.</p>
        <PortalAction icon={faRotateRight} label="Retry collections" onClick={onRetry} />
      </div> : !series.length ? <p className="reebs-dashboard-empty">The collections chart requires the updated Dashboard API.</p>
        : !hasData ? <p className="reebs-dashboard-empty">No Core payments received in this period.</p> : <>
          <svg className="reebs-dashboard-collections-chart" viewBox="0 0 510 255" role="img" aria-label={`Core collections: ${formatGhs(payments.receivedInWindowCents)}. Expand chart data for exact amounts.`}>
            {[0, 0.5, 1].map((fraction) => <g key={fraction}>
              <line x1="110" x2="480" y1={210 - fraction * 165} y2={210 - fraction * 165} className="reebs-dashboard-chart-grid" />
              <text x="98" y={214 - fraction * 165} textAnchor="end">{axisAmount(minimum + (maximum - minimum) * fraction)}</text>
            </g>)}
            <polyline points={points.map((point) => `${point.x},${point.y}`).join(" ")} className="reebs-dashboard-chart-line" />
            {points.map((point) => <circle key={point.start} cx={point.x} cy={point.y} r="4" className="reebs-dashboard-chart-point">
              <title>{formatDashboardDateTime(point.start)} – {formatDashboardDateTime(point.end)}: {formatGhs(point.amountCents)}</title>
            </circle>)}
            {[0, 3, 7].filter((index) => points[index]).map((index) => <text key={index} x={points[index].x} y="243" textAnchor={index === 0 ? "start" : index === 7 ? "end" : "middle"}>
              {tickLabel(points[index].start, period.key === "today")}
            </text>)}
          </svg>
          <details className="reebs-dashboard-chart-data"><summary>View chart data</summary>
            <dl>{points.map((point) => <div key={point.start}><dt>{formatDashboardDateTime(point.start)} – {formatDashboardDateTime(point.end)}</dt><dd>{formatGhs(point.amountCents)}</dd></div>)}</dl>
          </details>
        </>}
      {comparison && <p className="reebs-dashboard-chart-comparison">
        {comparison.changePercent == null ? "No comparable positive previous-period total." : `${comparison.changePercent > 0 ? "+" : ""}${comparison.changePercent}% against the previous equal-length period.`}
      </p>}
      <p className="reebs-dashboard-freshness">Cash received, not earned revenue. Water is excluded.</p>
    </section>
  );
}
