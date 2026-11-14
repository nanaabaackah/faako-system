import { asyncHandler } from "../utils/asyncHandler.js";

// Only routes used by the actual DEV ERP System Health and Dashboard views.
// Their summary includes services, measured history, incidents and dependencies.
export const registerMonitoringRoutes = (app, {
  authMiddleware,
  requireAdmin,
  manualCheckRateLimit,
  controller,
}) => {
  app.get("/api/monitoring/summary", authMiddleware, asyncHandler(controller.summary));
  app.post("/api/monitoring/services/:id/run-check", authMiddleware, requireAdmin, manualCheckRateLimit, asyncHandler(controller.runCheck));
};
