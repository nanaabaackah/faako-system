import { createHttpError } from "../apiResponse.js";
import { evaluateStockStatus, resolveAvailableQuantity } from "../inventory/services.js";
import { PRODUCT_PUBLISHING_STATUSES } from "./validation.js";

const toNumber = (value) => {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const priceRequestLabelPattern =
  /(?:request\s+(?:a\s+)?price|price\s+on\s+request|request\s+quote|quote\s+required|price\s+required)/i;

const buildProductUpdateData = (product, patch) => {
  if (!Object.prototype.hasOwnProperty.call(patch, "price")) return patch;

  const data = { ...patch };
  if (patch.price === null) {
    data.quoteOnly = true;
    return data;
  }

  data.quoteOnly = false;
  if (priceRequestLabelPattern.test(String(product.priceLabel || ""))) {
    data.priceLabel = null;
  }

  return data;
};

const toIso = (value) => (value instanceof Date ? value.toISOString() : value || null);
const asArray = (value) => (Array.isArray(value) ? value : []);

const supplierSelect = {
  id: true,
  name: true,
  slug: true,
  status: true,
};

const inventorySelect = {
  id: true,
  variantId: true,
  quantityOnHand: true,
  reservedQuantity: true,
  availableQuantity: true,
  reorderThreshold: true,
  lowStockThreshold: true,
  stockStatus: true,
  updatedAt: true,
};

const productInclude = {
  category: true,
  supplierLinks: {
    include: { supplier: { select: supplierSelect } },
    orderBy: [{ isPreferred: "desc" }, { updatedAt: "desc" }],
  },
  inventoryItems: {
    select: inventorySelect,
    orderBy: { updatedAt: "desc" },
  },
};

const getBaseInventoryItem = (product) =>
  product.inventoryItems?.find((item) => item.variantId == null) || product.inventoryItems?.[0] || null;

const toStockSummary = (product) => {
  const inventory = getBaseInventoryItem(product);
  const quantityOnHand = inventory ? inventory.quantityOnHand : product.stockQuantity;
  const reservedQuantity = inventory
    ? inventory.reservedQuantity ?? 0
    : product.reservedQuantity ?? 0;
  const availableQuantity = inventory
    ? resolveAvailableQuantity({
        quantityOnHand,
        reservedQuantity,
        availableQuantity: inventory.availableQuantity,
      })
    : resolveAvailableQuantity({
        quantityOnHand,
        reservedQuantity,
        availableQuantity: product.availableQuantity,
      });
  const stockStatus = evaluateStockStatus({
    quantityOnHand,
    reservedQuantity,
    availableQuantity,
    lowStockThreshold: inventory?.lowStockThreshold ?? product.lowStockThreshold,
    stockStatus: inventory?.stockStatus ?? product.stockStatus,
  });

  return {
    inventoryItemId: inventory?.id || null,
    quantityOnHand,
    reservedQuantity,
    availableQuantity,
    reorderThreshold: inventory?.reorderThreshold ?? product.reorderThreshold,
    lowStockThreshold: inventory?.lowStockThreshold ?? product.lowStockThreshold,
    stockStatus,
    isLowStock: stockStatus === "low_stock",
    isOutOfStock: ["out_of_stock", "unavailable", "manual_review"].includes(stockStatus),
    updatedAt: toIso(inventory?.updatedAt || product.updatedAt),
  };
};

const toSupplierLink = (link) => ({
  id: link.id,
  supplierId: link.supplierId,
  supplierSku: link.supplierSku || null,
  supplierProductName: link.supplierProductName || null,
  isPreferred: Boolean(link.isPreferred),
  notes: link.notes || null,
  supplier: link.supplier
    ? {
        id: link.supplier.id,
        name: link.supplier.name,
        slug: link.supplier.slug,
        status: link.supplier.status,
      }
    : null,
});

export const toAdminProduct = (product) => ({
  id: product.id,
  slug: product.slug,
  name: product.name,
  sku: product.sku || null,
  shortDescription: product.shortDescription || null,
  longDescription: product.longDescription || null,
  price: toNumber(product.price),
  compareAtPrice: toNumber(product.compareAtPrice),
  currency: product.currency || "GHS",
  categorySlug: product.categorySlug || null,
  category: product.category
    ? { slug: product.category.slug, name: product.category.name }
    : null,
  tags: asArray(product.tags),
  thumbnailImage: product.image || null,
  galleryImages: asArray(product.images),
  publishingStatus: product.publishingStatus || (product.isPublished ? "active" : "draft"),
  isPublished: Boolean(product.isPublished),
  isFeatured: Boolean(product.isFeatured),
  stock: toStockSummary(product),
  supplierLinks: (product.supplierLinks || []).map(toSupplierLink),
  preferredSupplier:
    (product.supplierLinks || []).map(toSupplierLink).find((link) => link.isPreferred) || null,
  createdAt: toIso(product.createdAt),
  updatedAt: toIso(product.updatedAt),
});

const getProductById = async (prisma, id) => {
  const product = await prisma.catalogueProduct.findUnique({
    where: { id },
    include: productInclude,
  });
  if (!product) throw createHttpError("Catalogue product not found.", 404);
  return product;
};

const writeProductAudit = async (tx, product, action, beforeState, afterState, authUser) => {
  await tx.inventoryAuditEntry.create({
    data: {
      action,
      entityType: "catalogue_product",
      entityId: product.id,
      productSlug: afterState.slug || product.slug,
      beforeState,
      afterState,
      note: `Catalogue product ${action.toLowerCase().replace(/_/g, " ")} through Stroane admin API.`,
      createdById: authUser?.id || null,
      createdByName: authUser?.username || null,
    },
  });
};

const mapKnownPrismaError = (error) => {
  if (error?.code === "P2002") {
    throw createHttpError("A product with that slug or SKU already exists.", 409);
  }
  throw error;
};

export const listAdminProductCategories = async (prisma) =>
  prisma.catalogueCategory.findMany({
    where: { isActive: true },
    select: { slug: true, name: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });

export const listAdminProducts = async (prisma, query) => {
  const where = {};
  if (query.publishingStatus && PRODUCT_PUBLISHING_STATUSES.has(query.publishingStatus)) {
    where.publishingStatus = query.publishingStatus;
  }
  if (query.categorySlug) where.categorySlug = query.categorySlug;
  if (query.search) {
    where.OR = [
      { name: { contains: query.search, mode: "insensitive" } },
      { slug: { contains: query.search, mode: "insensitive" } },
      { sku: { contains: query.search, mode: "insensitive" } },
      { brand: { contains: query.search, mode: "insensitive" } },
    ];
  }

  const products = await prisma.catalogueProduct.findMany({
    where,
    include: productInclude,
    orderBy: [{ updatedAt: "desc" }, { name: "asc" }],
    take: query.limit,
  });

  return products
    .map(toAdminProduct)
    .filter((product) =>
      query.tag
        ? product.tags.some((tag) => String(tag).toLowerCase().includes(query.tag))
        : true
    );
};

export const getAdminProduct = async (prisma, id) => toAdminProduct(await getProductById(prisma, id));

export const updateAdminProduct = async (prisma, id, patch, authUser) => {
  const product = await getProductById(prisma, id);

  if (patch.categorySlug) {
    const category = await prisma.catalogueCategory.findUnique({
      where: { slug: patch.categorySlug },
      select: { slug: true },
    });
    if (!category) throw createHttpError("Product category not found.", 404);
  }

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const productUpdateData = buildProductUpdateData(product, patch);
      const next = await tx.catalogueProduct.update({
        where: { id },
        data: productUpdateData,
        include: productInclude,
      });

      if (patch.slug && patch.slug !== product.slug) {
        await tx.catalogueProductSupplier.updateMany({
          where: { productId: id },
          data: { productSlug: patch.slug },
        });
        await tx.inventoryItem.updateMany({
          where: { productId: id },
          data: { productSlug: patch.slug },
        });
      }

      await writeProductAudit(tx, product, "PRODUCT_DETAILS_UPDATED", {
        name: product.name,
        slug: product.slug,
        sku: product.sku,
        categorySlug: product.categorySlug,
        price: toNumber(product.price),
      }, {
        ...productUpdateData,
        price: patch.price === undefined ? undefined : toNumber(patch.price),
        compareAtPrice:
          patch.compareAtPrice === undefined ? undefined : toNumber(patch.compareAtPrice),
      }, authUser);

      return patch.slug && patch.slug !== product.slug
        ? tx.catalogueProduct.findUnique({ where: { id }, include: productInclude })
        : next;
    });

    return toAdminProduct(updated);
  } catch (error) {
    return mapKnownPrismaError(error);
  }
};

export const updateAdminProductMedia = async (prisma, id, patch, authUser) => {
  const product = await getProductById(prisma, id);
  const updated = await prisma.$transaction(async (tx) => {
    const next = await tx.catalogueProduct.update({
      where: { id },
      data: patch,
      include: productInclude,
    });
    await writeProductAudit(
      tx,
      product,
      "PRODUCT_MEDIA_UPDATED",
      { image: product.image, images: asArray(product.images) },
      patch,
      authUser
    );
    return next;
  });
  return toAdminProduct(updated);
};

export const updateAdminProductPublishing = async (prisma, id, patch, authUser) => {
  const product = await getProductById(prisma, id);
  const updated = await prisma.$transaction(async (tx) => {
    const next = await tx.catalogueProduct.update({
      where: { id },
      data: patch,
      include: productInclude,
    });
    await writeProductAudit(
      tx,
      product,
      "PRODUCT_PUBLISHING_UPDATED",
      {
        publishingStatus: product.publishingStatus,
        isPublished: product.isPublished,
        isFeatured: product.isFeatured,
      },
      patch,
      authUser
    );
    return next;
  });
  return toAdminProduct(updated);
};

export const updateAdminProductSupplier = async (prisma, id, patch, authUser) => {
  const product = await getProductById(prisma, id);

  if (patch.supplierId) {
    const supplier = await prisma.supplier.findUnique({
      where: { id: patch.supplierId },
      select: { id: true },
    });
    if (!supplier) throw createHttpError("Supplier not found.", 404);
  }

  const updated = await prisma.$transaction(async (tx) => {
    await tx.catalogueProductSupplier.updateMany({
      where: { productId: id },
      data: { isPreferred: false },
    });

    if (patch.supplierId) {
      await tx.catalogueProductSupplier.upsert({
        where: {
          productSlug_supplierId: {
            productSlug: product.slug,
            supplierId: patch.supplierId,
          },
        },
        update: {
          productId: id,
          supplierSku: patch.supplierSku,
          notes: patch.notes,
          isPreferred: true,
        },
        create: {
          productId: id,
          productSlug: product.slug,
          supplierId: patch.supplierId,
          supplierSku: patch.supplierSku,
          notes: patch.notes,
          isPreferred: true,
        },
      });
    }

    await writeProductAudit(
      tx,
      product,
      "PRODUCT_SUPPLIER_UPDATED",
      { preferredSupplierId: product.supplierLinks.find((link) => link.isPreferred)?.supplierId || null },
      { preferredSupplierId: patch.supplierId || null },
      authUser
    );

    return tx.catalogueProduct.findUnique({
      where: { id },
      include: productInclude,
    });
  });

  return toAdminProduct(updated);
};
