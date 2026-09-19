export const createInventoryAdjustmentIdempotencyKey = () =>
  typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `inventory-adjustment-${Date.now()}-${Math.random().toString(36).slice(2)}`;
