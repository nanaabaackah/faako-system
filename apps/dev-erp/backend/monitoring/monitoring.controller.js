import { parseServiceId, parseTimelineRange } from "./monitoring.validation.js";

const sendNotFound = (res) => res.status(404).json({ error: "Monitoring service not found." });

export const createMonitoringController = ({ monitoringService, auditWriter }) => ({
  async summary(req, res) {
    const range = parseTimelineRange(req.query.range);
    const summary = await monitoringService.getSummary(range);
    res.json({ summary: { ...summary, services: undefined }, services: summary.services, range, generatedAt: new Date().toISOString() });
  },
  async runCheck(req, res) {
    const id = parseServiceId(req.params.id);
    if (!id) return sendNotFound(res);
    const check = await monitoringService.runServiceById(id);
    if (!check) return sendNotFound(res);
    await auditWriter?.({
      organizationId: req.user?.organizationId,
      userId: req.user?.userId,
      action: "MONITORING_MANUAL_CHECK",
      targetType: "MonitoredService",
      targetId: String(id),
      status: "ok",
      source: "api",
      category: "admin",
      actorLabel: req.user?.email,
      requestId: req.requestId,
      ipAddress: req.ip,
      metadata: { resultStatus: check.status },
    });
    const service = await monitoringService.getService(id, parseTimelineRange(req.query.range));
    return res.json({ check, service });
  },
});
