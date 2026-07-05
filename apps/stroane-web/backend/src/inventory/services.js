import { createHttpError } from "../apiResponse.js";
import { STOCK_STATUSES, normalizeSlug, sanitizeText } from "./validation.js";

const toNumber = (value) => {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const toIso = (value) => (value instanceof Date ? value.toISOString() : value || null);

const supplierSummarySelect = {
  id: true,
  name: true,
  slug: true,
  status: true,
  email: true,
  phone: true,
  website: true,
  location: true,
};

const productSummarySelect = {
  id: true,
  slug: true,
  name: true,
  sku: true,
  categorySlug: true,
  price: true,
  currency: true,
  stockStatus: true,
  stockQuantity: true,
  availableQuantity: true,
  reservedQuantity: true,
  lowStockThreshold: true,
  reorderThreshold: true,
  isPurchasable: true,
  allowBackorder: true,
};

export const calculateAvailableQuantity = (quantityOnHand, reservedQuantity = 0) => {
  const quantity = toNumber(quantityOnHand);
  if (quantity === null) return null;
  const reserved = Math.max(0, toNumber(reservedQuantity) ?? 0);
  return Math.max(0, quantity - reserved);
};

export const resolveAvailableQuantity = ({
  quantityOnHand,
  reservedQuantity,
  availableQuantity,
} = {}) => {
  const calculatedAvailableQuantity = calculateAvailableQuantity(quantityOnHand, reservedQuantity);
  if (calculatedAvailableQuantity !== null) return calculatedAvailableQuantity;

  const storedAvailableQuantity = toNumber(availableQuantity);
  return storedAvailableQuantity === null ? null : Math.max(0, storedAvailableQuantity);
};

export const evaluateStockStatus = ({
  quantityOnHand,
  reservedQuantity,
  lowStockThreshold,
  stockStatus,
  availableQuantity,
} = {}) => {
  const explicitStatus = sanitizeText(stockStatus, 80).toLowerCase().replace(/[\s-]+/g, "_");
  if (explicitStatus === "preorder" || explicitStatus === "manual_review") return explicitStatus;

  const resolvedAvailableQuantity = resolveAvailableQuantity({
    quantityOnHand,
    reservedQuantity,
    availableQuantity,
  });
  if (resolvedAvailableQuantity === null) return "unavailable";
  if (resolvedAvailableQuantity <= 0) return "out_of_stock";

  const threshold = toNumber(lowStockThreshold);
  if (threshold !== null && resolvedAvailableQuantity <= threshold) return "low_stock";
  return "in_stock";
};

export const isLowStock = (item = {}) => {
  const availableQuantity = resolveAvailableQuantity(item);
  const threshold = toNumber(item.lowStockThreshold);
  return availableQuantity !== null && threshold !== null && availableQuantity <= threshold;
};

export const needsReorder = (item = {}) => {
  const availableQuantity = resolveAvailableQuantity(item);
  const threshold = toNumber(item.reorderThreshold);
  return availableQuantity !== null && threshold !== null && availableQuantity <= threshold;
};

const toProductSummary = (product) =>
  product
    ? {
        id: product.id,
        slug: product.slug,
        name: product.name,
        sku: product.sku || null,
        categorySlug: product.categorySlug || null,
        price: toNumber(product.price),
        currency: product.currency || "GHS",
        stockStatus: product.stockStatus || "unavailable",
        stockQuantity: product.stockQuantity,
        availableQuantity: product.availableQuantity,
        reservedQuantity: product.reservedQuantity,
        lowStockThreshold: product.lowStockThreshold,
        reorderThreshold: product.reorderThreshold,
        isPurchasable: Boolean(product.isPurchasable),
        allowBackorder: Boolean(product.allowBackorder),
      }
    : null;

const toSupplierSummary = (supplier) =>
  supplier
    ? {
        id: supplier.id,
        name: supplier.name,
        slug: supplier.slug,
        status: supplier.status || "active",
        email: supplier.email || null,
        phone: supplier.phone || null,
        website: supplier.website || null,
        location: supplier.location || null,
        createdAt: toIso(supplier.createdAt),
        updatedAt: toIso(supplier.updatedAt),
        contactCount: supplier._count?.contacts ?? undefined,
        productCount: supplier._count?.productLinks ?? undefined,
        inventoryItemCount: supplier._count?.inventoryItems ?? undefined,
      }
    : null;

const toSupplierContact = (contact) => ({
  id: contact.id,
  name: contact.name,
  role: contact.role || null,
  email: contact.email || null,
  phone: contact.phone || null,
  whatsapp: contact.whatsapp || null,
  isPrimary: Boolean(contact.isPrimary),
  notes: contact.notes || null,
  createdAt: toIso(contact.createdAt),
  updatedAt: toIso(contact.updatedAt),
});

const toSupplierDetail = (supplier) => ({
  ...toSupplierSummary(supplier),
  notes: supplier.notes || null,
  contacts: (supplier.contacts || []).map(toSupplierContact),
  productLinks: (supplier.productLinks || []).map((link) => ({
    id: link.id,
    productId: link.productId || null,
    productSlug: link.productSlug,
    supplierSku: link.supplierSku || null,
    supplierProductName: link.supplierProductName || null,
    costPrice: toNumber(link.costPrice),
    currency: link.currency || "GHS",
    leadTimeDays: link.leadTimeDays,
    minimumOrderQuantity: link.minimumOrderQuantity,
    isPreferred: Boolean(link.isPreferred),
    notes: link.notes || null,
    product: toProductSummary(link.product),
  })),
});

const hydrateInventoryItemProducts = async (prisma, items = []) => {
  const missingProductSlugs = [
    ...new Set(
      items
        .filter((item) => !item.product && item.productSlug)
        .map((item) => item.productSlug)
    ),
  ];

  if (!missingProductSlugs.length) return items;

  const products = await prisma.catalogueProduct.findMany({
    where: { slug: { in: missingProductSlugs } },
    select: productSummarySelect,
  });
  const productBySlug = new Map(products.map((product) => [product.slug, product]));

  return items.map((item) =>
    item.product || !productBySlug.has(item.productSlug)
      ? item
      : { ...item, product: productBySlug.get(item.productSlug) }
  );
};

const buildInventoryStockBasis = (item = {}) => ({
  ...item,
  quantityOnHand: item.quantityOnHand ?? item.product?.stockQuantity,
  reservedQuantity: item.reservedQuantity ?? item.product?.reservedQuantity,
  availableQuantity: item.availableQuantity ?? item.product?.availableQuantity,
  lowStockThreshold: item.lowStockThreshold ?? item.product?.lowStockThreshold,
  reorderThreshold: item.reorderThreshold ?? item.product?.reorderThreshold,
  stockStatus: item.stockStatus || item.product?.stockStatus,
});

const toInventoryItem = (item) => {
  const stockBasis = buildInventoryStockBasis(item);
  const availableQuantity = resolveAvailableQuantity(stockBasis);

  return {
    id: item.id,
    productId: item.productId || null,
    productSlug: item.productSlug,
    variantId: item.variantId || null,
    sku: item.sku || null,
    supplierId: item.supplierId || null,
    quantityOnHand: item.quantityOnHand,
    reservedQuantity: item.reservedQuantity ?? 0,
    availableQuantity,
    storedAvailableQuantity: item.availableQuantity,
    reorderThreshold: item.reorderThreshold,
    lowStockThreshold: item.lowStockThreshold,
    stockStatus: item.stockStatus || "unavailable",
    computedStockStatus: evaluateStockStatus(stockBasis),
    inventoryTrackingEnabled: item.inventoryTrackingEnabled !== false,
    allowBackorder: item.allowBackorder,
    isPurchasable: item.isPurchasable,
    isLowStock: isLowStock(stockBasis),
    needsReorder: needsReorder(stockBasis),
    lastCountedAt: toIso(item.lastCountedAt),
    lastRestockedAt: toIso(item.lastRestockedAt),
    notes: item.notes || null,
    product: toProductSummary(item.product),
    supplier: toSupplierSummary(item.supplier),
    createdAt: toIso(item.createdAt),
    updatedAt: toIso(item.updatedAt),
  };
};

const toMovement = (movement) => ({
  id: movement.id,
  inventoryItemId: movement.inventoryItemId || null,
  productSlug: movement.productSlug,
  variantId: movement.variantId || null,
  supplierId: movement.supplierId || null,
  movementType: movement.movementType,
  quantityDelta: movement.quantityDelta,
  quantityBefore: movement.quantityBefore,
  quantityAfter: movement.quantityAfter,
  reservedBefore: movement.reservedBefore,
  reservedAfter: movement.reservedAfter,
  reason: movement.reason || null,
  referenceType: movement.referenceType || null,
  referenceId: movement.referenceId || null,
  supplierNote: movement.supplierNote || null,
  purchaseNote: movement.purchaseNote || null,
  createdById: movement.createdById || null,
  createdByName: movement.createdByName || null,
  createdAt: toIso(movement.createdAt),
  supplier: toSupplierSummary(movement.supplier),
});

const getUniqueSupplierSlug = async (prisma, name, requestedSlug, excludeId = undefined) => {
  const baseSlug = normalizeSlug(requestedSlug || name) || "supplier";
  let candidate = baseSlug;
  let suffix = 2;

  while (true) {
    const existing = await prisma.supplier.findUnique({
      where: { slug: candidate },
      select: { id: true },
    });

    if (!existing || existing.id === excludeId) return candidate;
    candidate = `${baseSlug}-${suffix}`;
    suffix += 1;
  }
};

const buildSupplierWhere = ({ search, status } = {}) => {
  const where = {};
  if (status) where.status = status;
  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { slug: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
      { phone: { contains: search, mode: "insensitive" } },
      { location: { contains: search, mode: "insensitive" } },
    ];
  }
  return where;
};

const buildInventoryWhere = ({ search, status, supplierId, productSlug } = {}) => {
  const where = {};
  if (status && STOCK_STATUSES.has(status)) where.stockStatus = status;
  if (supplierId) where.supplierId = supplierId;
  if (productSlug) where.productSlug = productSlug;
  if (search) {
    where.OR = [
      { productSlug: { contains: search, mode: "insensitive" } },
      { sku: { contains: search, mode: "insensitive" } },
      { product: { is: { name: { contains: search, mode: "insensitive" } } } },
      { supplier: { is: { name: { contains: search, mode: "insensitive" } } } },
    ];
  }
  return where;
};

export const listSuppliers = async (prisma, query) => {
  const suppliers = await prisma.supplier.findMany({
    where: buildSupplierWhere(query),
    select: {
      ...supplierSummarySelect,
      createdAt: true,
      updatedAt: true,
      _count: {
        select: {
          contacts: true,
          productLinks: true,
          inventoryItems: true,
        },
      },
    },
    orderBy: [{ updatedAt: "desc" }, { name: "asc" }],
    take: query.limit,
  });

  return suppliers.map(toSupplierSummary);
};

export const getSupplier = async (prisma, id) => {
  const supplier = await prisma.supplier.findUnique({
    where: { id },
    include: {
      contacts: { orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }] },
      productLinks: {
        include: { product: { select: productSummarySelect } },
        orderBy: [{ isPreferred: "desc" }, { createdAt: "desc" }],
      },
      _count: {
        select: {
          contacts: true,
          productLinks: true,
          inventoryItems: true,
        },
      },
    },
  });

  if (!supplier) throw createHttpError("Supplier not found.", 404);
  return toSupplierDetail(supplier);
};

export const createSupplier = async (prisma, data, authUser) => {
  const slug = await getUniqueSupplierSlug(prisma, data.name, data.slug);
  const contacts = data.contacts;
  delete data.contacts;

  const supplier = await prisma.supplier.create({
    data: {
      status: "active",
      ...data,
      slug,
      contacts: contacts?.length ? { create: contacts } : undefined,
      auditEntries: {
        create: {
          action: "SUPPLIER_CREATED",
          entityType: "supplier",
          note: "Supplier created through Stroane admin API.",
          createdById: authUser?.id || null,
          createdByName: authUser?.username || null,
        },
      },
    },
    include: {
      contacts: { orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }] },
      productLinks: { include: { product: { select: productSummarySelect } } },
      _count: {
        select: {
          contacts: true,
          productLinks: true,
          inventoryItems: true,
        },
      },
    },
  });

  return toSupplierDetail(supplier);
};

export const updateSupplier = async (prisma, id, data, authUser) => {
  const existing = await prisma.supplier.findUnique({
    where: { id },
    include: { contacts: true },
  });
  if (!existing) throw createHttpError("Supplier not found.", 404);

  const contacts = data.contacts;
  delete data.contacts;

  if (data.slug || data.name) {
    data.slug = await getUniqueSupplierSlug(prisma, data.name || existing.name, data.slug, id);
  }

  const supplier = await prisma.$transaction(async (tx) => {
    if (contacts) {
      await tx.supplierContact.deleteMany({ where: { supplierId: id } });
    }

    const updated = await tx.supplier.update({
      where: { id },
      data: {
        ...data,
        contacts: contacts?.length ? { create: contacts } : undefined,
        auditEntries: {
          create: {
            action: "SUPPLIER_UPDATED",
            entityType: "supplier",
            entityId: id,
            beforeState: {
              name: existing.name,
              slug: existing.slug,
              status: existing.status,
              email: existing.email,
              phone: existing.phone,
              location: existing.location,
            },
            afterState: {
              ...data,
              contactsReplaced: Boolean(contacts),
            },
            note: "Supplier updated through Stroane admin API.",
            createdById: authUser?.id || null,
            createdByName: authUser?.username || null,
          },
        },
      },
      include: {
        contacts: { orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }] },
        productLinks: { include: { product: { select: productSummarySelect } } },
        _count: {
          select: {
            contacts: true,
            productLinks: true,
            inventoryItems: true,
          },
        },
      },
    });

    return updated;
  });

  return toSupplierDetail(supplier);
};

export const listInventoryItems = async (prisma, query) => {
  const items = await prisma.inventoryItem.findMany({
    where: buildInventoryWhere(query),
    include: {
      product: { select: productSummarySelect },
      supplier: { select: supplierSummarySelect },
    },
    orderBy: [{ updatedAt: "desc" }, { productSlug: "asc" }],
    take: query.limit,
  });

  return (await hydrateInventoryItemProducts(prisma, items)).map(toInventoryItem);
};

export const getInventoryItem = async (prisma, id) => {
  const item = await prisma.inventoryItem.findUnique({
    where: { id },
    include: {
      product: { select: productSummarySelect },
      supplier: { select: supplierSummarySelect },
    },
  });

  if (!item) throw createHttpError("Inventory item not found.", 404);
  const [hydratedItem] = await hydrateInventoryItemProducts(prisma, [item]);
  return toInventoryItem(hydratedItem);
};

const buildInventoryUpdateData = (existing, patch) => {
  const next = {
    ...patch,
  };

  const quantityOnHand = Object.prototype.hasOwnProperty.call(next, "quantityOnHand")
    ? next.quantityOnHand
    : existing.quantityOnHand;
  const reservedQuantity = Object.prototype.hasOwnProperty.call(next, "reservedQuantity")
    ? next.reservedQuantity
    : existing.reservedQuantity;

  if (quantityOnHand !== null && reservedQuantity !== null && reservedQuantity > quantityOnHand) {
    throw createHttpError("Reserved quantity cannot exceed quantity on hand.");
  }

  next.availableQuantity = calculateAvailableQuantity(quantityOnHand, reservedQuantity);

  if (!Object.prototype.hasOwnProperty.call(next, "stockStatus")) {
    next.stockStatus = evaluateStockStatus({
      ...existing,
      ...next,
      quantityOnHand,
      reservedQuantity,
    });
  }

  return next;
};

export const syncProductStockFromInventory = async (tx, item, updates) => {
  if (!item.productSlug || item.variantId) return;

  const data = {
    stockQuantity: updates.quantityOnHand,
    reservedQuantity: updates.reservedQuantity,
    availableQuantity: updates.availableQuantity,
    lowStockThreshold: updates.lowStockThreshold,
    reorderThreshold: updates.reorderThreshold,
    stockStatus: updates.stockStatus,
  };

  if (typeof updates.allowBackorder === "boolean") {
    data.allowBackorder = updates.allowBackorder;
  }

  if (typeof updates.isPurchasable === "boolean") {
    data.isPurchasable = updates.isPurchasable;
  }

  await tx.catalogueProduct.updateMany({
    where: { slug: item.productSlug },
    data,
  });
};

export const updateInventoryItem = async (prisma, id, patch, authUser) => {
  const existing = await prisma.inventoryItem.findUnique({
    where: { id },
    include: {
      product: { select: productSummarySelect },
      supplier: { select: supplierSummarySelect },
    },
  });
  if (!existing) throw createHttpError("Inventory item not found.", 404);

  const data = buildInventoryUpdateData(existing, patch);

  const updated = await prisma.$transaction(async (tx) => {
    const nextItem = await tx.inventoryItem.update({
      where: { id },
      data,
      include: {
        product: { select: productSummarySelect },
        supplier: { select: supplierSummarySelect },
      },
    });

    await syncProductStockFromInventory(tx, nextItem, {
      ...existing,
      ...nextItem,
    });

    await tx.inventoryAuditEntry.create({
      data: {
        inventoryItemId: id,
        supplierId: nextItem.supplierId,
        action: "INVENTORY_ITEM_UPDATED",
        entityType: "inventory_item",
        entityId: id,
        productSlug: nextItem.productSlug,
        variantId: nextItem.variantId,
        beforeState: {
          quantityOnHand: existing.quantityOnHand,
          reservedQuantity: existing.reservedQuantity,
          availableQuantity: existing.availableQuantity,
          stockStatus: existing.stockStatus,
          supplierId: existing.supplierId,
        },
        afterState: {
          quantityOnHand: nextItem.quantityOnHand,
          reservedQuantity: nextItem.reservedQuantity,
          availableQuantity: nextItem.availableQuantity,
          stockStatus: nextItem.stockStatus,
          supplierId: nextItem.supplierId,
        },
        note: "Inventory item updated through Stroane admin API.",
        createdById: authUser?.id || null,
        createdByName: authUser?.username || null,
      },
    });

    return nextItem;
  });

  return toInventoryItem(updated);
};

export const applyInventoryMovementState = (item = {}, movement = {}) => {
  const beforeQuantity = Math.max(0, toNumber(item.quantityOnHand) ?? 0);
  const beforeReserved = Math.max(0, toNumber(item.reservedQuantity) ?? 0);
  const rawDelta = Number(movement.quantityDelta);
  const absoluteDelta = Math.abs(rawDelta);

  let quantityAfter = beforeQuantity;
  let reservedAfter = beforeReserved;
  let storedDelta = rawDelta;

  if (movement.movementType === "RESTOCK") {
    storedDelta = absoluteDelta;
    quantityAfter = beforeQuantity + absoluteDelta;
  } else if (movement.movementType === "DAMAGE") {
    storedDelta = -absoluteDelta;
    quantityAfter = beforeQuantity - absoluteDelta;
  } else if (movement.movementType === "RESERVED") {
    storedDelta = absoluteDelta;
    reservedAfter = beforeReserved + absoluteDelta;
  } else if (movement.movementType === "RELEASED") {
    storedDelta = -absoluteDelta;
    reservedAfter = beforeReserved - absoluteDelta;
  } else if (movement.quantityAfter !== undefined) {
    quantityAfter = movement.quantityAfter;
    storedDelta = quantityAfter - beforeQuantity;
  } else {
    quantityAfter = beforeQuantity + rawDelta;
  }

  if (quantityAfter < 0) {
    throw createHttpError("Inventory movement would make stock quantity negative.", 409);
  }
  if (reservedAfter < 0) {
    throw createHttpError("Inventory movement would make reserved quantity negative.", 409);
  }
  if (reservedAfter > quantityAfter) {
    throw createHttpError("Inventory movement would reserve more stock than is on hand.", 409);
  }

  const availableQuantity = calculateAvailableQuantity(quantityAfter, reservedAfter);

  return {
    quantityDelta: storedDelta,
    quantityBefore: beforeQuantity,
    quantityAfter,
    reservedBefore: beforeReserved,
    reservedAfter,
    availableQuantity,
    stockStatus: evaluateStockStatus({
      ...item,
      quantityOnHand: quantityAfter,
      reservedQuantity: reservedAfter,
    }),
  };
};

export const listInventoryMovements = async (prisma, query) => {
  const where = {};
  if (query.productSlug) where.productSlug = query.productSlug;
  if (query.supplierId) where.supplierId = query.supplierId;
  if (query.movementType) where.movementType = query.movementType;

  const movements = await prisma.inventoryMovement.findMany({
    where,
    include: {
      supplier: { select: supplierSummarySelect },
    },
    orderBy: { createdAt: "desc" },
    take: query.limit,
  });

  return movements.map(toMovement);
};

export const createInventoryMovement = async (prisma, movement, authUser) => {
  const inventoryItem = movement.inventoryItemId
    ? await prisma.inventoryItem.findUnique({
        where: { id: movement.inventoryItemId },
        include: {
          product: { select: productSummarySelect },
          supplier: { select: supplierSummarySelect },
        },
      })
    : await prisma.inventoryItem.findFirst({
        where: {
          productSlug: movement.productSlug,
          variantId: movement.variantId || null,
        },
        include: {
          product: { select: productSummarySelect },
          supplier: { select: supplierSummarySelect },
        },
      });

  if (!inventoryItem) {
    throw createHttpError("Inventory item not found for movement.", 404);
  }

  const nextState = applyInventoryMovementState(inventoryItem, movement);
  const now = new Date();

  const result = await prisma.$transaction(async (tx) => {
    const updatedItem = await tx.inventoryItem.update({
      where: { id: inventoryItem.id },
      data: {
        quantityOnHand: nextState.quantityAfter,
        reservedQuantity: nextState.reservedAfter,
        availableQuantity: nextState.availableQuantity,
        stockStatus: nextState.stockStatus,
        lastRestockedAt:
          movement.movementType === "RESTOCK" ? now : inventoryItem.lastRestockedAt,
      },
      include: {
        product: { select: productSummarySelect },
        supplier: { select: supplierSummarySelect },
      },
    });

    await syncProductStockFromInventory(tx, updatedItem, updatedItem);

    const savedMovement = await tx.inventoryMovement.create({
      data: {
        inventoryItemId: updatedItem.id,
        productSlug: updatedItem.productSlug,
        variantId: updatedItem.variantId,
        supplierId: movement.supplierId || updatedItem.supplierId,
        movementType: movement.movementType,
        quantityDelta: nextState.quantityDelta,
        quantityBefore: nextState.quantityBefore,
        quantityAfter: nextState.quantityAfter,
        reservedBefore: nextState.reservedBefore,
        reservedAfter: nextState.reservedAfter,
        reason: movement.reason,
        referenceType: movement.referenceType,
        referenceId: movement.referenceId,
        supplierNote: movement.supplierNote,
        purchaseNote: movement.purchaseNote,
        createdById: authUser?.id || null,
        createdByName: authUser?.username || null,
      },
      include: {
        supplier: { select: supplierSummarySelect },
      },
    });

    await tx.inventoryAuditEntry.create({
      data: {
        inventoryItemId: updatedItem.id,
        supplierId: movement.supplierId || updatedItem.supplierId,
        action: `INVENTORY_${movement.movementType}`,
        entityType: "inventory_item",
        entityId: updatedItem.id,
        productSlug: updatedItem.productSlug,
        variantId: updatedItem.variantId,
        beforeState: {
          quantityOnHand: nextState.quantityBefore,
          reservedQuantity: nextState.reservedBefore,
        },
        afterState: {
          quantityOnHand: nextState.quantityAfter,
          reservedQuantity: nextState.reservedAfter,
          availableQuantity: nextState.availableQuantity,
          stockStatus: nextState.stockStatus,
        },
        note: movement.reason || "Inventory movement recorded through Stroane admin API.",
        createdById: authUser?.id || null,
        createdByName: authUser?.username || null,
      },
    });

    return { item: updatedItem, movement: savedMovement };
  });

  return {
    inventoryItem: toInventoryItem(result.item),
    movement: toMovement(result.movement),
  };
};

const getProductByIdOrSlug = async (prisma, id) =>
  prisma.catalogueProduct.findFirst({
    where: {
      OR: [{ id }, { slug: id }],
    },
  });

const buildProductInventoryData = (product, patch) => {
  const quantityOnHand = Object.prototype.hasOwnProperty.call(patch, "quantityOnHand")
    ? patch.quantityOnHand
    : product.stockQuantity;
  const reservedQuantity = Object.prototype.hasOwnProperty.call(patch, "reservedQuantity")
    ? patch.reservedQuantity
    : product.reservedQuantity;
  const availableQuantity = calculateAvailableQuantity(quantityOnHand, reservedQuantity);
  const allowBackorder =
    patch.allowBackorder === undefined ? product.allowBackorder : Boolean(patch.allowBackorder);

  let isPurchasable =
    patch.isPurchasable === undefined ? product.isPurchasable : Boolean(patch.isPurchasable);
  if (availableQuantity === null && patch.isPurchasable === undefined) isPurchasable = false;
  if (availableQuantity === 0 && !allowBackorder && patch.isPurchasable === undefined) {
    isPurchasable = false;
  }

  const stockStatus =
    patch.stockStatus ||
    evaluateStockStatus({
      quantityOnHand,
      reservedQuantity,
      lowStockThreshold: patch.lowStockThreshold ?? product.lowStockThreshold,
      stockStatus: product.stockStatus,
    });

  return {
    stockQuantity: quantityOnHand,
    reservedQuantity,
    availableQuantity,
    lowStockThreshold: patch.lowStockThreshold ?? product.lowStockThreshold,
    reorderThreshold: patch.reorderThreshold ?? product.reorderThreshold,
    stockStatus,
    allowBackorder,
    isPurchasable,
  };
};

export const updateProductInventory = async (prisma, id, patch, authUser) => {
  const product = await getProductByIdOrSlug(prisma, String(id || ""));
  if (!product) throw createHttpError("Catalogue product not found.", 404);

  const variantId = patch.variantId || null;
  const isVariantInventory = Boolean(variantId);
  const productInventoryData = buildProductInventoryData(product, patch);
  const shouldSyncInventoryItem = patch.syncInventoryItem !== false;

  const result = await prisma.$transaction(async (tx) => {
    const updatedProduct = isVariantInventory
      ? product
      : await tx.catalogueProduct.update({
          where: { id: product.id },
          data: productInventoryData,
        });

    let inventoryItem = null;
    let existingItem = null;
    if (shouldSyncInventoryItem) {
      existingItem = await tx.inventoryItem.findFirst({
        where: {
          productSlug: product.slug,
          variantId,
        },
      });

      const inventoryData = {
        productId: product.id,
        productSlug: product.slug,
        variantId,
        sku: patch.sku ?? product.sku,
        supplierId: patch.supplierId,
        quantityOnHand: productInventoryData.stockQuantity,
        reservedQuantity: productInventoryData.reservedQuantity,
        availableQuantity: productInventoryData.availableQuantity,
        reorderThreshold: productInventoryData.reorderThreshold,
        lowStockThreshold: productInventoryData.lowStockThreshold,
        stockStatus: productInventoryData.stockStatus,
        inventoryTrackingEnabled: patch.inventoryTrackingEnabled,
        allowBackorder: productInventoryData.allowBackorder,
        isPurchasable: productInventoryData.isPurchasable,
        notes: patch.notes,
      };

      inventoryItem = existingItem
        ? await tx.inventoryItem.update({
            where: { id: existingItem.id },
            data: inventoryData,
            include: {
              product: { select: productSummarySelect },
              supplier: { select: supplierSummarySelect },
            },
          })
        : await tx.inventoryItem.create({
            data: inventoryData,
            include: {
              product: { select: productSummarySelect },
              supplier: { select: supplierSummarySelect },
            },
          });
    }

    await tx.inventoryAuditEntry.create({
      data: {
        inventoryItemId: inventoryItem?.id || null,
        supplierId: patch.supplierId,
        action: "PRODUCT_INVENTORY_UPDATED",
        entityType: isVariantInventory ? "inventory_item" : "catalogue_product",
        entityId: inventoryItem?.id || product.id,
        productSlug: product.slug,
        variantId,
        beforeState:
          isVariantInventory && existingItem
            ? {
                quantityOnHand: existingItem.quantityOnHand,
                reservedQuantity: existingItem.reservedQuantity,
                availableQuantity: existingItem.availableQuantity,
                stockStatus: existingItem.stockStatus,
                isPurchasable: existingItem.isPurchasable,
              }
            : {
                stockQuantity: product.stockQuantity,
                reservedQuantity: product.reservedQuantity,
                availableQuantity: product.availableQuantity,
                stockStatus: product.stockStatus,
                isPurchasable: product.isPurchasable,
              },
        afterState: productInventoryData,
        note: "Product inventory updated through Stroane admin API.",
        createdById: authUser?.id || null,
        createdByName: authUser?.username || null,
      },
    });

    return { product: updatedProduct, inventoryItem };
  });

  return {
    product: toProductSummary(result.product),
    inventoryItem: result.inventoryItem ? toInventoryItem(result.inventoryItem) : null,
  };
};
