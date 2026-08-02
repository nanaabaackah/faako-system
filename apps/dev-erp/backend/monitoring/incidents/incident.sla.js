export const INCIDENT_TARGETS = Object.freeze({
  INFO: { responseMinutes: 8 * 60, resolutionBusinessDays: 3 },
  WARNING: { responseMinutes: 60, resolutionMinutes: 8 * 60 },
  CRITICAL: { responseMinutes: 15, resolutionMinutes: 2 * 60 },
});

const addBusinessDays = (value, businessDays) => {
  const result = new Date(value);
  let remaining = businessDays;
  while (remaining > 0) {
    result.setUTCDate(result.getUTCDate() + 1);
    if (![0, 6].includes(result.getUTCDay())) remaining -= 1;
  }
  return result;
};

export const calculateIncidentTargets = ({ severity = "WARNING", startedAt = new Date() } = {}) => {
  const definition = INCIDENT_TARGETS[severity] || INCIDENT_TARGETS.WARNING;
  const startedMs = new Date(startedAt).getTime();
  return {
    responseDueAt: new Date(startedMs + definition.responseMinutes * 60_000),
    resolutionDueAt: definition.resolutionBusinessDays ? addBusinessDays(startedAt, definition.resolutionBusinessDays) : new Date(startedMs + definition.resolutionMinutes * 60_000),
  };
};

export const getIncidentBreaches = (incident, now = new Date()) => ({
  response: !incident.acknowledgedAt && !incident.responseBreachedAt && incident.responseDueAt && new Date(incident.responseDueAt) <= now,
  resolution: !["RESOLVED", "CLOSED"].includes(incident.status) && !incident.resolutionBreachedAt && incident.resolutionDueAt && new Date(incident.resolutionDueAt) <= now,
});
