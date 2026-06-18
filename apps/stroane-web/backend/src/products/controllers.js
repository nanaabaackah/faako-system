import { sendCreated, sendOk } from "../apiResponse.js";
import {
  bulkUpdateAdminProductPublishing,
  createAdminProduct,
  getAdminProduct,
  listAdminProductCategories,
  listAdminProducts,
  updateAdminProduct,
  updateAdminProductMedia,
  updateAdminProductPublishing,
  updateAdminProductSupplier,
} from "./services.js";
import {
  validateAdminProductListQuery,
  validateProductBulkPayload,
  validateProductCreatePayload,
  validateProductMediaPayload,
  validateProductPatchPayload,
  validateProductPublishingPayload,
  validateProductSupplierPayload,
} from "./validation.js";

export const createProductAdminController = (prisma) => ({
  listProducts: async (req, res) => {
    const query = validateAdminProductListQuery(req.query);
    const [products, categories] = await Promise.all([
      listAdminProducts(prisma, query),
      listAdminProductCategories(prisma),
    ]);
    return sendOk(res, { products, categories });
  },

  createProduct: async (req, res) =>
    sendCreated(res, {
      product: await createAdminProduct(
        prisma,
        validateProductCreatePayload(req.body),
        req.authUser
      ),
    }),

  bulkUpdateProducts: async (req, res) =>
    sendOk(res, await bulkUpdateAdminProductPublishing(
      prisma,
      validateProductBulkPayload(req.body),
      req.authUser
    )),

  getProduct: async (req, res) =>
    sendOk(res, { product: await getAdminProduct(prisma, String(req.params.id || "")) }),

  updateProduct: async (req, res) =>
    sendOk(res, {
      product: await updateAdminProduct(
        prisma,
        String(req.params.id || ""),
        validateProductPatchPayload(req.body),
        req.authUser
      ),
    }),

  updateProductMedia: async (req, res) =>
    sendOk(res, {
      product: await updateAdminProductMedia(
        prisma,
        String(req.params.id || ""),
        validateProductMediaPayload(req.body),
        req.authUser
      ),
    }),

  updateProductPublishing: async (req, res) =>
    sendOk(res, {
      product: await updateAdminProductPublishing(
        prisma,
        String(req.params.id || ""),
        validateProductPublishingPayload(req.body),
        req.authUser
      ),
    }),

  updateProductSupplier: async (req, res) =>
    sendOk(res, {
      product: await updateAdminProductSupplier(
        prisma,
        String(req.params.id || ""),
        validateProductSupplierPayload(req.body),
        req.authUser
      ),
    }),
});
