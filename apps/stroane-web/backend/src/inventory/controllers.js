import { sendCreated, sendOk } from "../apiResponse.js";
import {
  createInventoryMovement,
  createSupplier,
  getInventoryItem,
  getSupplier,
  listInventoryItems,
  listInventoryMovements,
  listSuppliers,
  updateInventoryItem,
  updateProductInventory,
  updateSupplier,
} from "./services.js";
import {
  validateInventoryPatchPayload,
  validateListQuery,
  validateMovementPayload,
  validateProductInventoryPatchPayload,
  validateSupplierPayload,
} from "./validation.js";

export const createInventoryAdminController = (prisma) => ({
  listSuppliers: async (req, res) => {
    const suppliers = await listSuppliers(prisma, validateListQuery(req.query));
    return sendOk(res, { suppliers });
  },

  getSupplier: async (req, res) => {
    const supplier = await getSupplier(prisma, String(req.params.id || ""));
    return sendOk(res, { supplier });
  },

  createSupplier: async (req, res) => {
    const supplier = await createSupplier(
      prisma,
      validateSupplierPayload(req.body),
      req.authUser
    );
    return sendCreated(res, { supplier });
  },

  updateSupplier: async (req, res) => {
    const supplier = await updateSupplier(
      prisma,
      String(req.params.id || ""),
      validateSupplierPayload(req.body, { partial: true }),
      req.authUser
    );
    return sendOk(res, { supplier });
  },

  listInventoryItems: async (req, res) => {
    const inventory = await listInventoryItems(prisma, validateListQuery(req.query));
    return sendOk(res, { inventory });
  },

  getInventoryItem: async (req, res) => {
    const inventoryItem = await getInventoryItem(prisma, String(req.params.id || ""));
    return sendOk(res, { inventoryItem });
  },

  updateInventoryItem: async (req, res) => {
    const inventoryItem = await updateInventoryItem(
      prisma,
      String(req.params.id || ""),
      validateInventoryPatchPayload(req.body),
      req.authUser
    );
    return sendOk(res, { inventoryItem });
  },

  listInventoryMovements: async (req, res) => {
    const movements = await listInventoryMovements(prisma, validateListQuery(req.query));
    return sendOk(res, { movements });
  },

  createInventoryMovement: async (req, res) => {
    const result = await createInventoryMovement(
      prisma,
      validateMovementPayload(req.body),
      req.authUser
    );
    return sendCreated(res, result);
  },

  updateProductInventory: async (req, res) => {
    const result = await updateProductInventory(
      prisma,
      String(req.params.id || ""),
      validateProductInventoryPatchPayload(req.body),
      req.authUser
    );
    return sendOk(res, result);
  },
});
