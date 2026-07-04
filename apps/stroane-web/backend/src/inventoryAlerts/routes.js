import { timingSafeEqual } from "node:crypto";
import { Router } from "express";
import { requireAdminRole, requireSiteUser } from "../adminAuth.js";
import { asyncRoute } from "../apiResponse.js";
import { createInventoryAlertController } from "./controllers.js";

const safeEqual = (left, right) => {
  const leftBuffer = Buffer.from(String(left || ""));
  const rightBuffer = Buffer.from(String(right || ""));
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
};

export const requireCronSecret = (req, res, next) => {
  const configuredSecret = String(process.env.STROANE_ALERT_CRON_SECRET || "").trim();
  if (!configuredSecret) {
    return res.status(503).json({ error: "Inventory alert scheduler is not configured." });
  }

  const authHeader = String(req.headers.authorization || "");
  const providedSecret = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  if (!providedSecret || !safeEqual(configuredSecret, providedSecret)) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  return next();
};

export const createAdminInventoryAlertRouter = (prisma) => {
  const router = Router();
  const controller = createInventoryAlertController(prisma);

  router.use(requireSiteUser(prisma, ["ADMIN", "OWNER", "VIEWER", "CUSTOM"]));
  router.get(
    "/inventory/alerts",
    requireAdminRole(prisma, "inventory", "view"),
    asyncRoute(controller.getSummary)
  );
  router.post(
    "/inventory/alerts/check",
    requireAdminRole(prisma, "inventory", "edit"),
    asyncRoute(controller.runManualCheck)
  );

  return router;
};

export const createInternalInventoryAlertRouter = (prisma) => {
  const router = Router();
  const controller = createInventoryAlertController(prisma);

  router.post("/check", requireCronSecret, asyncRoute(controller.runScheduledCheck));

  return router;
};
