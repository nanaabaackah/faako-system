import { asyncHandler } from "../utils/asyncHandler.js";

export const registerMonitoringRoutes = (app, {
  authMiddleware,
  requireAdmin,
  manualCheckRateLimit,
  controller,
}) => {
  app.get("/api/monitoring/summary", authMiddleware, asyncHandler(controller.summary));
  app.get("/api/monitoring/services", authMiddleware, asyncHandler(controller.services));
  app.get("/api/monitoring/services/:id/history", authMiddleware, asyncHandler(controller.history));
  app.get("/api/monitoring/services/:id/incidents", authMiddleware, asyncHandler(controller.serviceIncidents));
  app.get("/api/monitoring/services/:id", authMiddleware, asyncHandler(controller.service));
  app.get("/api/monitoring/dependencies", authMiddleware, asyncHandler(controller.dependencies));
  app.post("/api/monitoring/services/:id/run-check", authMiddleware, requireAdmin, manualCheckRateLimit, asyncHandler(controller.runCheck));
};
