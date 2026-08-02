import { asyncHandler } from "../../utils/asyncHandler.js";
import { INCIDENT_CAPABILITIES, createRequireIncidentCapability } from "./incident.constants.js";

export const registerIncidentResponseRoutes = (app, { authMiddleware, mutationRateLimit, incidentController, alertController, maintenanceController }) => {
  const requireCapability = createRequireIncidentCapability;
  app.get("/api/monitoring/incidents", authMiddleware, requireCapability(INCIDENT_CAPABILITIES.VIEW), asyncHandler(incidentController.list));
  app.get("/api/monitoring/responders", authMiddleware, requireCapability(INCIDENT_CAPABILITIES.ASSIGN), asyncHandler(alertController.responders));
  app.get("/api/monitoring/incidents/:id/timeline", authMiddleware, requireCapability(INCIDENT_CAPABILITIES.VIEW), asyncHandler(incidentController.timeline));
  app.get("/api/monitoring/incidents/:id/export", authMiddleware, requireCapability(INCIDENT_CAPABILITIES.EXPORT), mutationRateLimit, asyncHandler(incidentController.export));
  app.get("/api/monitoring/incidents/:id", authMiddleware, requireCapability(INCIDENT_CAPABILITIES.VIEW), asyncHandler(incidentController.get));
  app.post("/api/monitoring/incidents/:id/acknowledge", authMiddleware, requireCapability(INCIDENT_CAPABILITIES.ACKNOWLEDGE), mutationRateLimit, asyncHandler(incidentController.acknowledge));
  app.post("/api/monitoring/incidents/:id/assign", authMiddleware, requireCapability(INCIDENT_CAPABILITIES.ASSIGN), mutationRateLimit, asyncHandler(incidentController.assign));
  app.post("/api/monitoring/incidents/:id/notes", authMiddleware, requireCapability(INCIDENT_CAPABILITIES.UPDATE), mutationRateLimit, asyncHandler(incidentController.note));
  app.patch("/api/monitoring/incidents/:id", authMiddleware, requireCapability(INCIDENT_CAPABILITIES.UPDATE), mutationRateLimit, asyncHandler(incidentController.update));
  app.post("/api/monitoring/incidents/:id/resolve", authMiddleware, requireCapability(INCIDENT_CAPABILITIES.RESOLVE), mutationRateLimit, asyncHandler(incidentController.resolve));
  app.post("/api/monitoring/incidents/:id/close", authMiddleware, requireCapability(INCIDENT_CAPABILITIES.RESOLVE), mutationRateLimit, asyncHandler(incidentController.close));
  app.post("/api/monitoring/incidents/:id/reopen", authMiddleware, requireCapability(INCIDENT_CAPABILITIES.RESOLVE), mutationRateLimit, asyncHandler(incidentController.reopen));

  app.get("/api/monitoring/alert-rules", authMiddleware, requireCapability(INCIDENT_CAPABILITIES.ALERT_RULE_MANAGE), asyncHandler(alertController.rules));
  app.post("/api/monitoring/alert-rules", authMiddleware, requireCapability(INCIDENT_CAPABILITIES.ALERT_RULE_MANAGE), mutationRateLimit, asyncHandler(alertController.createRule));
  app.patch("/api/monitoring/alert-rules/:id", authMiddleware, requireCapability(INCIDENT_CAPABILITIES.ALERT_RULE_MANAGE), mutationRateLimit, asyncHandler(alertController.updateRule));
  app.post("/api/monitoring/alert-rules/:id/enable", authMiddleware, requireCapability(INCIDENT_CAPABILITIES.ALERT_RULE_MANAGE), mutationRateLimit, asyncHandler(alertController.enableRule));
  app.post("/api/monitoring/alert-rules/:id/disable", authMiddleware, requireCapability(INCIDENT_CAPABILITIES.ALERT_RULE_MANAGE), mutationRateLimit, asyncHandler(alertController.disableRule));

  app.get("/api/monitoring/channels", authMiddleware, requireCapability(INCIDENT_CAPABILITIES.ALERT_CHANNEL_MANAGE), asyncHandler(alertController.channels));
  app.post("/api/monitoring/channels", authMiddleware, requireCapability(INCIDENT_CAPABILITIES.ALERT_CHANNEL_MANAGE), mutationRateLimit, asyncHandler(alertController.createChannel));
  app.patch("/api/monitoring/channels/:id", authMiddleware, requireCapability(INCIDENT_CAPABILITIES.ALERT_CHANNEL_MANAGE), mutationRateLimit, asyncHandler(alertController.updateChannel));
  app.post("/api/monitoring/channels/:id/test", authMiddleware, requireCapability(INCIDENT_CAPABILITIES.ALERT_CHANNEL_MANAGE), mutationRateLimit, asyncHandler(alertController.testChannel));

  app.get("/api/monitoring/escalation-policies", authMiddleware, requireCapability(INCIDENT_CAPABILITIES.ESCALATION_POLICY_MANAGE), asyncHandler(alertController.policies));
  app.post("/api/monitoring/escalation-policies", authMiddleware, requireCapability(INCIDENT_CAPABILITIES.ESCALATION_POLICY_MANAGE), mutationRateLimit, asyncHandler(alertController.createPolicy));
  app.patch("/api/monitoring/escalation-policies/:id", authMiddleware, requireCapability(INCIDENT_CAPABILITIES.ESCALATION_POLICY_MANAGE), mutationRateLimit, asyncHandler(alertController.updatePolicy));

  app.get("/api/monitoring/maintenance-windows", authMiddleware, requireCapability(INCIDENT_CAPABILITIES.VIEW), asyncHandler(maintenanceController.list));
  app.post("/api/monitoring/maintenance-windows", authMiddleware, requireCapability(INCIDENT_CAPABILITIES.MAINTENANCE_WINDOW_MANAGE), mutationRateLimit, asyncHandler(maintenanceController.create));
  app.patch("/api/monitoring/maintenance-windows/:id", authMiddleware, requireCapability(INCIDENT_CAPABILITIES.MAINTENANCE_WINDOW_MANAGE), mutationRateLimit, asyncHandler(maintenanceController.update));
  app.post("/api/monitoring/maintenance-windows/:id/cancel", authMiddleware, requireCapability(INCIDENT_CAPABILITIES.MAINTENANCE_WINDOW_MANAGE), mutationRateLimit, asyncHandler(maintenanceController.cancel));

  app.get("/api/monitoring/notifications", authMiddleware, requireCapability(INCIDENT_CAPABILITIES.VIEW), asyncHandler(alertController.notifications));
  app.post("/api/monitoring/notifications/:id/read", authMiddleware, requireCapability(INCIDENT_CAPABILITIES.VIEW), mutationRateLimit, asyncHandler(alertController.readNotification));
};
