import { Router } from "express";
import { asyncRoute } from "../apiResponse.js";
import { requireAdminRole, requireSiteUser } from "../adminAuth.js";
import { createInventoryAdminController } from "./controllers.js";

export const createAdminInventoryRouter = (prisma) => {
  const router = Router();
  const controller = createInventoryAdminController(prisma);

  router.use(requireSiteUser(prisma, ["ADMIN", "OWNER", "VIEWER", "CUSTOM"]));

  router.get("/suppliers", asyncRoute(controller.listSuppliers));
  router.get("/suppliers/:id", asyncRoute(controller.getSupplier));
  router.post(
    "/suppliers",
    requireAdminRole(prisma, "inventory", "create"),
    asyncRoute(controller.createSupplier)
  );
  router.patch(
    "/suppliers/:id",
    requireAdminRole(prisma, "inventory", "edit"),
    asyncRoute(controller.updateSupplier)
  );

  router.get("/inventory/movements", asyncRoute(controller.listInventoryMovements));
  router.post(
    "/inventory/movements",
    requireAdminRole(prisma, "inventory", "edit"),
    asyncRoute(controller.createInventoryMovement)
  );
  router.get("/inventory", asyncRoute(controller.listInventoryItems));
  router.get("/inventory/:id", asyncRoute(controller.getInventoryItem));
  router.patch(
    "/inventory/:id",
    requireAdminRole(prisma, "inventory", "edit"),
    asyncRoute(controller.updateInventoryItem)
  );

  router.patch(
    "/products/:id/inventory",
    requireAdminRole(prisma, "inventory", "edit"),
    asyncRoute(controller.updateProductInventory)
  );

  return router;
};
