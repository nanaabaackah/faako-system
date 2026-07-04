import { Router } from "express";
import { requireAdminRole, requireSiteUser } from "../adminAuth.js";
import { asyncRoute } from "../apiResponse.js";
import { createProductAdminController } from "./controllers.js";

export const createAdminProductRouter = (prisma) => {
  const router = Router();
  const controller = createProductAdminController(prisma);

  router.use(requireSiteUser(prisma, ["ADMIN", "OWNER", "VIEWER", "CUSTOM"]));

  router.get("/products", requireAdminRole(prisma, "inventory", "view"), asyncRoute(controller.listProducts));
  router.post("/products", requireAdminRole(prisma, "inventory", "create"), asyncRoute(controller.createProduct));
  router.patch("/products/bulk", requireAdminRole(prisma, "inventory", "edit"), asyncRoute(controller.bulkUpdateProducts));
  router.get("/products/:id", requireAdminRole(prisma, "inventory", "view"), asyncRoute(controller.getProduct));
  router.patch("/products/:id", requireAdminRole(prisma, "inventory", "edit"), asyncRoute(controller.updateProduct));
  router.patch(
    "/products/:id/media",
    requireAdminRole(prisma, "inventory", "edit"),
    asyncRoute(controller.updateProductMedia)
  );
  router.patch(
    "/products/:id/publishing",
    requireAdminRole(prisma, "inventory", "edit"),
    asyncRoute(controller.updateProductPublishing)
  );
  router.patch(
    "/products/:id/suppliers",
    requireAdminRole(prisma, "inventory", "edit"),
    asyncRoute(controller.updateProductSupplier)
  );

  return router;
};
