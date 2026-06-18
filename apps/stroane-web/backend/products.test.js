import assert from "node:assert/strict";
import test from "node:test";
import { requireSiteUser } from "./src/adminAuth.js";
import { listCatalogueProducts, listPersistedCatalogueProducts } from "./src/catalogue.js";
import { createAdminProductRouter } from "./src/products/routes.js";
import { toAdminProduct } from "./src/products/services.js";
import {
  normalizeProductImagePath,
  validateProductMediaPayload,
  validateProductPublishingPayload,
  validateProductSupplierPayload,
} from "./src/products/validation.js";

test("normalizes safe local product media paths", () => {
  assert.equal(
    normalizeProductImagePath("//imgs//products//aprons//chef-apron.webp"),
    "/imgs/products/aprons/chef-apron.webp"
  );
});

test("rejects external, traversal, and non-product media paths", () => {
  assert.throws(
    () => normalizeProductImagePath("https://example.com/apron.webp"),
    /Product images must use/
  );
  assert.throws(
    () => normalizeProductImagePath("/imgs/products/../secret.png"),
    /Product images must use/
  );
  assert.throws(() => normalizeProductImagePath("/uploads/apron.webp"), /Product images must use/);
});

test("deduplicates gallery media paths and derives active publishing visibility", () => {
  assert.deepEqual(
    validateProductMediaPayload({
      thumbnailImage: "/imgs/products/apron.webp",
      galleryImages: ["/imgs/products/apron.webp", "/imgs/products/apron.webp"],
    }),
    {
      image: "/imgs/products/apron.webp",
      images: ["/imgs/products/apron.webp"],
    }
  );
  assert.deepEqual(validateProductPublishingPayload({ publishingStatus: "active" }), {
    publishingStatus: "active",
    isPublished: true,
  });
  assert.deepEqual(validateProductPublishingPayload({ publishingStatus: "draft" }), {
    publishingStatus: "draft",
    isPublished: false,
  });
});

test("supplier edits require an explicit preferred supplier selection", () => {
  assert.throws(() => validateProductSupplierPayload({}), /Supplier selection is required/);
  assert.deepEqual(validateProductSupplierPayload({ supplierId: "" }), {
    supplierId: null,
    supplierSku: undefined,
    notes: undefined,
  });
});

test("admin middleware rejects product API requests without a bearer token", async () => {
  const middleware = requireSiteUser({ siteUser: {} }, ["ADMIN", "VIEWER"]);
  const response = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
  let nextCalled = false;

  await middleware({ headers: {} }, response, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, false);
  assert.equal(response.statusCode, 401);
  assert.deepEqual(response.body, { error: "Unauthorized" });
});

test("admin product router applies bearer auth before product routes", async () => {
  const router = createAdminProductRouter({ siteUser: {} });
  const authLayer = router.stack[0];
  const response = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
  let nextCalled = false;

  await authLayer.handle({ headers: {} }, response, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, false);
  assert.equal(response.statusCode, 401);
  assert.deepEqual(response.body, { error: "Unauthorized" });
  assert.deepEqual(
    router.stack.filter((layer) => layer.route).map((layer) => layer.route.path),
    [
      "/products",
      "/products",
      "/products/bulk",
      "/products/:id",
      "/products/:id",
      "/products/:id/media",
      "/products/:id/publishing",
      "/products/:id/suppliers",
    ]
  );
});

test("public catalogue queries active products and omit private supplier and cost data", async () => {
  const prisma = {
    catalogueProduct: {
      findMany: async (query) => {
        assert.deepEqual(query.where, { isPublished: true, publishingStatus: "active" });
        return [
          {
            id: "product-1",
            slug: "private-supplier-test",
            name: "Private supplier test",
            categorySlug: "thermometers",
            category: { slug: "thermometers", name: "Thermometers" },
            currency: "GHS",
            price: "25.00",
            compareAtPrice: null,
            priceLabel: "Request price",
            quoteOnly: true,
            isPurchasable: false,
            stockStatus: "unavailable",
            supplier: "Internal supplier",
            costPrice: "10.00",
            sellingPrice: "25.00",
          },
        ];
      },
    },
  };

  const [product] = await listPersistedCatalogueProducts(prisma);
  assert.equal(product.id, "private-supplier-test");
  assert.equal(product.price, 25);
  assert.equal(product.priceLabel, undefined);
  assert.equal(product.quoteOnly, false);
  assert.equal(product.isPurchasable, false);
  assert.equal("supplier" in product, false);
  assert.equal("costPrice" in product, false);
  assert.equal("sellingPrice" in product, false);
  assert.equal("sourceRefs" in product, false);
  assert.equal("manualReviewRequired" in product, false);
  assert.equal("reviewNotes" in product, false);
});

test("seed fallback catalogue responses omit internal review metadata", () => {
  const [product] = listCatalogueProducts();
  assert.ok(product);
  assert.equal("supplier" in product, false);
  assert.equal("costPrice" in product, false);
  assert.equal("sellingPrice" in product, false);
  assert.equal("sourceRefs" in product, false);
  assert.equal("manualReviewRequired" in product, false);
  assert.equal("reviewNotes" in product, false);
});

test("public catalogue maps explicit zero stock to out of stock", async () => {
  const prisma = {
    catalogueProduct: {
      findMany: async () => [
        {
          id: "zero-stock-product",
          slug: "zero-stock-product",
          name: "Zero stock product",
          categorySlug: "thermometers",
          category: { slug: "thermometers", name: "Thermometers" },
          currency: "GHS",
          price: "25.00",
          compareAtPrice: null,
          stockQuantity: null,
          availableQuantity: 0,
          reservedQuantity: 0,
          stockStatus: "unavailable",
        },
      ],
    },
  };

  const [product] = await listPersistedCatalogueProducts(prisma);
  assert.equal(product.availableQuantity, 0);
  assert.equal(product.stockStatus, "out_of_stock");
  assert.equal(product.stock, "Out of stock");
});

test("public catalogue applies persisted inventory to product variants", async () => {
  const prisma = {
    catalogueProduct: {
      findMany: async () => [
        {
          id: "chef-waterproof-apron-db-id",
          slug: "chef-waterproof-apron",
          name: "Chef Waterproof Apron",
          categorySlug: "aprons",
          category: { slug: "aprons", name: "Aprons" },
          currency: "GHS",
          price: null,
          compareAtPrice: null,
          stockQuantity: null,
          availableQuantity: null,
          reservedQuantity: 0,
          stockStatus: "unavailable",
          inventoryItems: [
            {
              variantId: null,
              quantityOnHand: 10,
              reservedQuantity: 2,
              availableQuantity: 8,
              stockStatus: "in_stock",
              lowStockThreshold: 5,
              reorderThreshold: null,
              allowBackorder: false,
              isPurchasable: true,
            },
            {
              variantId: "chef-waterproof-apron-black",
              sku: "APR-BLK-STOCK",
              quantityOnHand: 4,
              reservedQuantity: 1,
              availableQuantity: 3,
              stockStatus: "low_stock",
              lowStockThreshold: 5,
              reorderThreshold: 2,
              allowBackorder: false,
              isPurchasable: true,
            },
          ],
        },
      ],
    },
  };

  const [product] = await listPersistedCatalogueProducts(prisma);
  const blackVariant = product.variants.find(
    (variant) => variant.id === "chef-waterproof-apron-black"
  );

  assert.ok(blackVariant);
  assert.equal(product.stockQuantity, 10);
  assert.equal(product.availableQuantity, 8);
  assert.equal(product.stockStatus, "in_stock");
  assert.equal(product.isPurchasable, true);
  assert.equal(blackVariant.sku, "APR-BLK-STOCK");
  assert.equal(blackVariant.stockQuantity, 4);
  assert.equal(blackVariant.availableQuantity, 3);
  assert.equal(blackVariant.stockStatus, "low_stock");
  assert.equal(blackVariant.isPurchasable, true);
});

test("admin products preserve unknown operational stock instead of inheriting catalogue zeroes", () => {
  const product = toAdminProduct({
    id: "product-unknown-stock",
    slug: "unknown-stock",
    name: "Unknown stock",
    stockQuantity: 0,
    availableQuantity: 0,
    reservedQuantity: 0,
    stockStatus: "out_of_stock",
    inventoryItems: [
      {
        id: "inventory-unknown-stock",
        variantId: null,
        quantityOnHand: null,
        reservedQuantity: 0,
        availableQuantity: null,
        stockStatus: "unavailable",
      },
    ],
    supplierLinks: [],
  });

  assert.equal(product.stock.quantityOnHand, null);
  assert.equal(product.stock.availableQuantity, null);
  assert.equal(product.stock.stockStatus, "unavailable");
});

test("admin products treat explicit stored zero inventory as out of stock", () => {
  const product = toAdminProduct({
    id: "product-zero-stock",
    slug: "zero-stock",
    name: "Zero stock",
    stockQuantity: null,
    availableQuantity: 0,
    reservedQuantity: 0,
    stockStatus: "unavailable",
    inventoryItems: [
      {
        id: "inventory-zero-stock",
        variantId: null,
        quantityOnHand: null,
        reservedQuantity: 0,
        availableQuantity: 0,
        stockStatus: "unavailable",
      },
    ],
    supplierLinks: [],
  });

  assert.equal(product.stock.quantityOnHand, null);
  assert.equal(product.stock.availableQuantity, 0);
  assert.equal(product.stock.stockStatus, "out_of_stock");
  assert.equal(product.stock.isOutOfStock, true);
});
