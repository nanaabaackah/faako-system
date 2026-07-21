const PROJECT_HEALTH_LABELS = {
  ON_TRACK: "On track",
  AT_RISK: "At risk",
  BLOCKED: "Blocked",
};

export const getProjectHealthLabel = (health) =>
  PROJECT_HEALTH_LABELS[health] || PROJECT_HEALTH_LABELS.ON_TRACK;

export const getProjectHealthTone = (health) => {
  if (health === "BLOCKED") return "blocked";
  if (health === "AT_RISK") return "at-risk";
  return "on-track";
};

export const normalizeProjectProgress = (value) => {
  const progress = Number(value);
  if (!Number.isFinite(progress)) return 0;
  return Math.min(100, Math.max(0, Math.round(progress)));
};
