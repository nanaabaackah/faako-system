const HEALTHY_STATUSES = new Set(["ok", "online", "active"]);
const WARNING_STATUSES = new Set(["degraded", "warning", "pending"]);
const DANGER_STATUSES = new Set(["offline", "error", "suspended"]);

export const clampMonitoringValue = (value, min = 0, max = 100) =>
  Math.max(min, Math.min(max, value));

export const getMonitoringTone = (status) => {
  if (HEALTHY_STATUSES.has(status)) return "success";
  if (WARNING_STATUSES.has(status)) return "warning";
  if (DANGER_STATUSES.has(status)) return "danger";
  return "info";
};

export const getMonitoringHealthScore = (status) => {
  if (HEALTHY_STATUSES.has(status)) return 96;
  if (status === "degraded" || status === "warning" || status === "pending") return 68;
  if (status === "not_configured") return 18;
  if (status === "offline" || status === "error" || status === "suspended") return 10;
  return 42;
};

export const buildMonitoringSparklineValues = ({
  status,
  score,
  seed = 0,
  points = 14,
} = {}) => {
  const base = clampMonitoringValue(
    Number.isFinite(score) ? score : getMonitoringHealthScore(status)
  );
  const tone = getMonitoringTone(status);
  const volatility = tone === "success" ? 7 : tone === "warning" ? 20 : tone === "danger" ? 28 : 14;

  return Array.from({ length: points }, (_, index) => {
    const wave = ((index * 17 + seed * 11) % 23) - 11;
    const drift = index === points - 1 ? 0 : ((index + seed) % 4) - 1.5;
    const drop =
      tone === "danger" && index > points - 4
        ? (index - (points - 4)) * 9
        : tone === "warning" && index % 5 === 0
          ? 10
          : 0;
    return clampMonitoringValue(base + wave * (volatility / 18) + drift * 2 - drop);
  });
};

export const getMonitoringStatusSummary = (items = []) => {
  const list = Array.isArray(items) ? items : [];
  const total = list.length;
  const online = list.filter((item) => HEALTHY_STATUSES.has(item?.status)).length;
  const degraded = list.filter((item) => WARNING_STATUSES.has(item?.status)).length;
  const offline = list.filter((item) => DANGER_STATUSES.has(item?.status)).length;
  const notConfigured = list.filter((item) => item?.status === "not_configured").length;
  const configured = Math.max(total - notConfigured, 0);
  const score = configured ? Math.round((online / configured) * 100) : 0;

  return {
    total,
    configured,
    online,
    degraded,
    offline,
    notConfigured,
    score,
  };
};
