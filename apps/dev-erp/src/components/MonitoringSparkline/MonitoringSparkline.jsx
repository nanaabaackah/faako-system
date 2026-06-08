import React from "react";
import {
  buildMonitoringSparklineValues,
  clampMonitoringValue,
  getMonitoringTone,
} from "./monitoringSparklineUtils";
import "./MonitoringSparkline.css";

const toPolyline = (values, width, height) => {
  const safeValues = values.length ? values : [0];
  const maxIndex = Math.max(safeValues.length - 1, 1);

  return safeValues
    .map((value, index) => {
      const x = (index / maxIndex) * width;
      const y = height - (clampMonitoringValue(value) / 100) * height;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
};

const MonitoringSparkline = ({
  values = [],
  status = "unknown",
  label = "Monitoring trend",
  className = "",
}) => {
  const width = 160;
  const height = 54;
  const safeValues = Array.isArray(values) && values.length
    ? values
    : buildMonitoringSparklineValues({ status });
  const points = toPolyline(safeValues, width, height);
  const areaPoints = `0,${height} ${points} ${width},${height}`;
  const lastValue = safeValues[safeValues.length - 1] ?? 0;
  const lastX = width;
  const lastY = height - (clampMonitoringValue(lastValue) / 100) * height;
  const tone = getMonitoringTone(status);

  return (
    <svg
      className={`monitoring-sparkline is-${tone} ${className}`.trim()}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={label}
      preserveAspectRatio="none"
    >
      <polygon className="monitoring-sparkline__area" points={areaPoints} />
      <polyline className="monitoring-sparkline__line" points={points} />
      <circle className="monitoring-sparkline__point" cx={lastX} cy={lastY} r="3.2" />
    </svg>
  );
};

export default MonitoringSparkline;
