import { Router } from "express";
import { requireAdminRole, requireSiteUser } from "../adminAuth.js";
import { asyncRoute } from "../apiResponse.js";
import { createProductAdminController } from "./controllers.js";

export const createAdminProductRouter = (prisma) => {
  const router = Router();
  const controller = createProductAdminController(prisma);

  router.use(requireSiteUser(prisma, ["ADMIN", "VIEWER"]));

  router.get("/products", asyncRoute(controller.listProducts));
  router.post("/products", requireAdminRole(prisma), asyncRoute(controller.createProduct));
  router.patch("/products/bulk", requireAdminRole(prisma), asyncRoute(controller.bulkUpdateProducts));
  router.get("/products/:id", asyncRoute(controller.getProduct));
  router.patch("/products/:id", requireAdminRole(prisma), asyncRoute(controller.updateProduct));
  router.patch(
    "/products/:id/media",
    requireAdminRole(prisma),
    asyncRoute(controller.updateProductMedia)
  );
  router.patch(
    "/products/:id/publishing",
    requireAdminRole(prisma),
    asyncRoute(controller.updateProductPublishing)
  );
  router.patch(
    "/products/:id/suppliers",
    requireAdminRole(prisma),
    asyncRoute(controller.updateProductSupplier)
  );

  return router;
};
