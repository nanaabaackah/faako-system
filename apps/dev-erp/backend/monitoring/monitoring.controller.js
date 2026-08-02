import { parseServiceId, parseTimelineRange } from "./monitoring.validation.js";

const sendNotFound = (res) => res.status(404).json({ error: "Monitoring service not found." });

export const createMonitoringController = ({ monitoringService, auditWriter }) => ({
  async summary(req, res) {
    const range = parseTimelineRange(req.query.range);
    const summary = await monitoringService.getSummary(range);
    res.json({ summary: { ...summary, services: undefined }, services: summary.services, range, generatedAt: new Date().toISOString() });
  },
  async services(req, res) {
    const range = parseTimelineRange(req.query.range);
    const services = await monitoringService.getServices(range);
    res.json({ services, range, generatedAt: new Date().toISOString(), errors: [] });
  },
  async service(req, res) {
    const id = parseServiceId(req.params.id);
    if (!id) return sendNotFound(res);
    const service = await monitoringService.getService(id, parseTimelineRange(req.query.range));
    return service ? res.json({ service }) : sendNotFound(res);
  },
  async history(req, res) {
    const id = parseServiceId(req.params.id);
    if (!id) return sendNotFound(res);
    const history = await monitoringService.getHistory(id, parseTimelineRange(req.query.range));
    return history ? res.json(history) : sendNotFound(res);
  },
  async serviceIncidents(req, res) {
    const id = parseServiceId(req.params.id);
    if (!id) return sendNotFound(res);
    const service = await monitoringService.getService(id, "24h");
    if (!service) return sendNotFound(res);
    const incidents = await monitoringService.listIncidents({ serviceId: id });
    return res.json({ incidents });
  },
  async incidents(req, res) {
    const status = ["OPEN", "ACKNOWLEDGED", "RESOLVED"].includes(req.query.status) ? req.query.status : null;
    const incidents = await monitoringService.listIncidents({ status });
    res.json({ incidents });
  },
  async dependencies(_req, res) {
    const dependencies = await monitoringService.listDependencies();
    res.json({ dependencies });
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
