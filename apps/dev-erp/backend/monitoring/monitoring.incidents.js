export const getConsecutiveStatusCount = (checks = [], status) => {
  let count = 0;
  for (const check of checks) {
    if (check.status !== status) break;
    count += 1;
  }
  return count;
};

export const decideIncidentTransition = ({
  result,
  recentChecks = [],
  activeIncident = null,
  failureThreshold = 2,
  recoveryThreshold = 2,
  critical = false,
} = {}) => {
  if (!result || result.status === "UNKNOWN" || result.status === "DEGRADED") return { action: "none" };
  if (result.status === "DOWN") {
    const failureCount = getConsecutiveStatusCount(recentChecks, "DOWN");
    if (activeIncident) return { action: "increment", failureCount: Math.max(activeIncident.failureCount + 1, failureCount), recoveryCount: 0 };
    if (failureCount >= failureThreshold) return { action: "open", failureCount, severity: critical ? "CRITICAL" : "WARNING" };
    return { action: "none" };
  }
  if (result.status === "HEALTHY" && activeIncident) {
    const recoveryCount = getConsecutiveStatusCount(recentChecks, "HEALTHY");
    if (recoveryCount >= recoveryThreshold) return { action: "resolve", recoveryCount };
    return { action: "recovering", recoveryCount };
  }
  return { action: "none" };
};

export const applyIncidentRules = async ({ repository, service, result, options, logger }) => {
  if (result.status === "UNKNOWN") return null;
  const [recentChecks, activeIncident] = await Promise.all([
    repository.getRecentChecks(service.id, Math.max(options.incidentFailureThreshold, options.incidentRecoveryThreshold) + 1),
    repository.findActiveIncident(service.id),
  ]);
  const transition = decideIncidentTransition({
    result,
    recentChecks,
    activeIncident,
    failureThreshold: options.incidentFailureThreshold,
    recoveryThreshold: options.incidentRecoveryThreshold,
    critical: service.critical,
  });
  if (transition.action === "open") {
    const incident = await repository.createIncident({ serviceId: service.id, status: "OPEN", severity: transition.severity, startedAt: new Date(result.startedAt), failureCount: transition.failureCount, summary: `${service.name} failed consecutive health checks.`, metadata: { errorCode: result.errorCode } });
    logger?.incident("monitoring.incident.opened", service, incident);
    return incident;
  }
  if (transition.action === "increment") return repository.updateIncident(activeIncident.id, { failureCount: transition.failureCount, recoveryCount: 0 });
  if (transition.action === "recovering") return repository.updateIncident(activeIncident.id, { recoveryCount: transition.recoveryCount });
  if (transition.action === "resolve") {
    const incident = await repository.updateIncident(activeIncident.id, { status: "RESOLVED", resolvedAt: new Date(result.completedAt), recoveryCount: transition.recoveryCount });
    logger?.incident("monitoring.incident.resolved", service, incident);
    return incident;
  }
  return activeIncident;
};
