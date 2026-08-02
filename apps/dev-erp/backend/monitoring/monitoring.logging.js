export const createMonitoringLogger = (logger = console) => ({
  checkStarted(service) {
    logger.info?.({ eventName: "monitoring.check.started", serviceKey: service.key, checkType: service.checkType }, "Monitoring check started");
  },
  checkCompleted(service, result, retryCount = 0) {
    logger.info?.({ eventName: "monitoring.check.completed", serviceKey: service.key, checkType: service.checkType, status: result.status, latencyMs: result.latencyMs, retryCount }, "Monitoring check completed");
  },
  incident(eventName, service, incident) {
    logger.info?.({ eventName, serviceKey: service.key, incidentId: incident?.id, status: incident?.status }, "Monitoring incident changed");
  },
  failure(eventName, service, error) {
    logger.error?.({ eventName, serviceKey: service?.key, errorCode: error?.code || "MONITORING_ERROR" }, "Monitoring operation failed");
  },
});
