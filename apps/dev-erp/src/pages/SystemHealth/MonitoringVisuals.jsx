import React, { useMemo, useState } from "react";
import "./MonitoringVisuals.css";

// Every point comes from persisted monitoring checks. Empty buckets remain gaps;
// never infer uptime/latency from the latest HTTP status.
export const LatencyTrendChart = ({ timeline = [], label = "Response time", thresholdMs = 500 }) => {
  const points = useMemo(() => (Array.isArray(timeline) ? timeline : [])
    .map((bucket, index) => ({
      index,
      latency: Number.isFinite(bucket.latencyMs) ? bucket.latencyMs : null,
      time: bucket.timestamp || bucket.startedAt || null,
      status: bucket.status || "unknown",
    })), [timeline]);
  const known = points.filter((point) => point.latency !== null);
  if (!known.length) return <p className="monitor-chart-empty">No measured response times in this period. Missing checks are not treated as healthy.</p>;
  const width = 560;
  const height = 150;
  const baseline = 128;
  const cap = Math.max(thresholdMs * 1.15, ...known.map((point) => point.latency), 1);
  const x = (index) => 4 + (index / Math.max(points.length - 1, 1)) * (width - 8);
  const y = (latency) => baseline - (latency / cap) * 112;
  // Break the polyline at every unmeasured bucket rather than joining missing data.
  const segments = [];
  let current = [];
  points.forEach((point) => {
    if (point.latency === null) {
      if (current.length) segments.push(current);
      current = [];
    } else {
      current.push(point);
    }
  });
  if (current.length) segments.push(current);
  const thresholdY = Math.max(4, y(thresholdMs));
  return (
    <div className="monitor-trend-chart">
      <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" role="img"
        aria-label={`${label}, ${known.length} actual latency samples, maximum ${Math.round(Math.max(...known.map((p) => p.latency)))} milliseconds`}>
        {[.25, .5, .75].map((fraction) => (
          <line key={fraction} x1="0" x2={width} y1={baseline - fraction * 112} y2={baseline - fraction * 112}
            className="monitor-trend-chart__grid" />
        ))}
        <line x1="0" x2={width} y1={thresholdY} y2={thresholdY} className="monitor-trend-chart__threshold" />
        {segments.map((segment, index) => (
          <polyline key={index} fill="none" className="monitor-trend-chart__line"
            points={segment.map((point) => `${x(point.index).toFixed(2)},${y(point.latency).toFixed(2)}`).join(" ")} />
        ))}
        {known.map((point) => (
          <circle key={point.index} cx={x(point.index)} cy={y(point.latency)} r="2.8"
            className={point.latency > thresholdMs ? "monitor-trend-chart__point is-slow" : "monitor-trend-chart__point"}>
            <title>{`${point.time ? new Date(point.time).toLocaleString() : "Check"}: ${Math.round(point.latency)} ms · ${point.status}`}</title>
          </circle>
        ))}
      </svg>
      <div className="monitor-trend-chart__legend"><span>Measured checks: {known.length}</span><span>Threshold: {thresholdMs} ms</span></div>
    </div>
  );
};

export const MonitoringTrendsPanel = ({ services = [] }) => {
  const supported = services.filter((service) => Array.isArray(service.timeline) && service.timeline.some((point) => Number.isFinite(point.latencyMs)));
  const [serviceKey, setServiceKey] = useState("");
  const selected = supported.find((service) => String(service.id) === serviceKey) || supported[0] || null;
  return (
    <section className="panel monitoring-trends-panel" aria-labelledby="monitoring-trend-title">
      <div className="panel-header">
        <div>
          <h3 id="monitoring-trend-title">Response time history</h3>
          <p className="muted">Actual recorded checks; empty intervals are shown as gaps.</p>
        </div>
        {supported.length > 0 ? (
          <label className="monitoring-trends-panel__select">
            <span className="sr-only">Service to visualize</span>
            <select className="input" aria-label="Select monitored service" value={selected ? String(selected.id) : ""}
              onChange={(event) => setServiceKey(event.target.value)}>
              {supported.map((service) => <option value={String(service.id)} key={service.id}>{service.name}</option>)}
            </select>
          </label>
        ) : null}
      </div>
      {selected ? (
        <>
          <LatencyTrendChart timeline={selected.timeline} label={selected.name} />
          <p className="muted">Selected: {selected.name} · Last check {selected.lastCheckedAt ? new Date(selected.lastCheckedAt).toLocaleString() : "unavailable"}</p>
        </>
      ) : <p className="monitor-chart-empty">No recorded response-time samples yet. Configure monitoring and allow checks to run to populate this chart.</p>}
    </section>
  );
};
