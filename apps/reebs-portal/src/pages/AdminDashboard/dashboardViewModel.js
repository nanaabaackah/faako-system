const WINDOW_OPTIONS = Object.freeze([
  Object.freeze({ value: "today", label: "Today" }),
  Object.freeze({ value: "7d", label: "Last 7 days" }),
  Object.freeze({ value: "30d", label: "Last 30 days" }),
  Object.freeze({ value: "thisMonth", label: "This month" }),
]);

const formatGhs = (cents) => new Intl.NumberFormat("en-GH", {
  style: "currency",
  currency: "GHS",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
}).format((Number(cents) || 0) / 100);

const formatDashboardDateTime = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not available";
  return new Intl.DateTimeFormat("en-GH", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Africa/Accra",
  }).format(date);
};

const formatRelativeTime = (value, nowInput = new Date()) => {
  const date = new Date(value);
  const now = new Date(nowInput);
  if (Number.isNaN(date.getTime()) || Number.isNaN(now.getTime())) return "Time unavailable";
  const seconds = Math.round((date.getTime() - now.getTime()) / 1000);
  const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  if (Math.abs(seconds) < 60) return formatter.format(seconds, "second");
  const minutes = Math.round(seconds / 60);
  if (Math.abs(minutes) < 60) return formatter.format(minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return formatter.format(hours, "hour");
  return formatter.format(Math.round(hours / 24), "day");
};

const normalizeHealthStatus = (value) => {
  const normalized = String(value || "").trim().toLowerCase();
  if (["ready", "alive", "online", "operational", "ok"].includes(normalized)) return "operational";
  if (["down", "offline", "failed", "error", "unavailable"].includes(normalized)) return "down";
  return "degraded";
};

const getHealthUptime = (samples = []) => {
  if (!samples.length) return null;
  const healthy = samples.filter((sample) => sample === "operational").length;
  return Math.round((healthy / samples.length) * 1000) / 10;
};

const appendHealthSample = (samples = [], nextStatus, limit = 20) => [
  ...samples,
  normalizeHealthStatus(nextStatus),
].slice(-Math.max(1, limit));

export {
  WINDOW_OPTIONS,
  appendHealthSample,
  formatDashboardDateTime,
  formatGhs,
  formatRelativeTime,
  getHealthUptime,
  normalizeHealthStatus,
};
