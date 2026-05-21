import catalogueData from "./stroaneCatalogue.json";

export type Category = string;

export type ProductStockStatus =
  | "in_stock"
  | "low_stock"
  | "out_of_stock"
  | "preorder"
  | "unavailable";

export type ProductStock =
  | "In stock"
  | "Few left"
  | "Out of stock"
  | "Preorder"
  | "Unavailable";

export interface CatalogueCategory {
  id: string;
  name: Category;
  description: string;
  tags: string[];
}

export interface BusinessProfile {
  name: string;
  slug: string;
  email: string;
  phone: string;
  alternatePhone?: string;
  location: string;
  catalogueVersion: string;
  sourceNote: string;
}

export interface Product {
  id: string;
  name: string;
  category: Category;
  categorySlug: string;
  subcategory?: string;
  brand?: string;
  description: string;
  longDescription?: string;
  price: number | null;
  priceLabel?: string;
  currency: "GHS";
  unit: string;
  image: string;
  thumbnailUrl?: string;
  imageUrl?: string;
  images?: string[];
  galleryImages?: string[];
  imageAlt?: string;
  tag?: string;
  stock: ProductStock;
  stockStatus?: ProductStockStatus;
  stockQuantity?: number | null;
  lowStockThreshold?: number | null;
  allowBackorder?: boolean;
  isPurchasable?: boolean;
  availability?: string;
  quoteOnly?: boolean;
  sku: string;
  features: string[];
  specifications?: Record<string, string>;
  tags?: string[];
  useCases?: string[];
  inquiryCta?: string;
  sourceRefs?: string[];
}

interface CatalogueSeed {
  businessProfile: BusinessProfile;
  categories: CatalogueCategory[];
  products: Product[];
}

const catalogue = catalogueData as CatalogueSeed;
const PRODUCT_IMAGE_PLACEHOLDER = "/images/products/product-placeholder.webp";
const legacyProductImagePattern = /^\/imgs\/products\/product_\d+\.(png|jpe?g|webp)$/i;

export const PRODUCT_STOCK_LABELS: Record<ProductStockStatus, ProductStock> = {
  in_stock: "In stock",
  low_stock: "Few left",
  out_of_stock: "Out of stock",
  preorder: "Preorder",
  unavailable: "Unavailable",
};

const legacyStockStatusMap: Record<string, ProductStockStatus> = {
  in_stock: "in_stock",
  "in stock": "in_stock",
  low_stock: "low_stock",
  "low stock": "low_stock",
  "few left": "low_stock",
  out_of_stock: "out_of_stock",
  "out of stock": "out_of_stock",
  pre_order: "preorder",
  preorder: "preorder",
  "pre-order": "preorder",
  unavailable: "unavailable",
  manual_review: "unavailable",
  price_required: "unavailable",
  "price required": "unavailable",
  quote_required: "unavailable",
  "request price": "unavailable",
};

export const normalizeStockStatus = (
  value?: string | ProductStockStatus | ProductStock | null
): ProductStockStatus => {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  if (legacyStockStatusMap[normalized]) return legacyStockStatusMap[normalized];
  if (legacyStockStatusMap[String(value || "").trim().toLowerCase()]) {
    return legacyStockStatusMap[String(value || "").trim().toLowerCase()];
  }

  return "unavailable";
};

const toNullableInteger = (value: unknown) => {
  if (value === null || value === undefined || value === "") return null;
  const numberValue = Number(value);
  return Number.isInteger(numberValue) && numberValue >= 0 ? numberValue : null;
};

const getNormalizedStockQuantity = (product: Product) =>
  toNullableInteger(product.stockQuantity);

const getNormalizedLowStockThreshold = (product: Product) =>
  toNullableInteger(product.lowStockThreshold) ?? 5;

const localProductById = new Map(
  catalogue.products.map((product) => [product.id, product])
);

const isLegacyProductImage = (value?: string) =>
  Boolean(value && legacyProductImagePattern.test(value));

const pickImage = (...values: Array<string | undefined>) =>
  values.find((value) => value && !isLegacyProductImage(value)) ||
  values.find(Boolean) ||
  PRODUCT_IMAGE_PLACEHOLDER;

const pickGalleryImages = (
  image: string,
  ...galleries: Array<string[] | undefined>
) => {
  const flattened = galleries.flatMap((gallery) => gallery || []);
  const currentImages = flattened.filter((value) => value && !isLegacyProductImage(value));

  if (currentImages.length) return currentImages;
  if (flattened.length) return flattened;
  return [image];
};

export const businessProfile = catalogue.businessProfile;

export const categories: CatalogueCategory[] = catalogue.categories;

export const isKnownCatalogueProduct = (product: Pick<Product, "id">) =>
  localProductById.has(product.id);

export const normalizeProduct = (product: Product): Product => {
  const localProduct = localProductById.get(product.id);
  const image = pickImage(product.imageUrl, product.image, localProduct?.imageUrl, localProduct?.image);
  const thumbnailUrl = pickImage(
    product.thumbnailUrl,
    product.imageUrl,
    product.image,
    localProduct?.thumbnailUrl,
    localProduct?.imageUrl,
    localProduct?.image
  );
  const galleryImages = pickGalleryImages(
    image,
    product.galleryImages,
    localProduct?.galleryImages,
    product.images,
    localProduct?.images
  );
  const stockStatus = normalizeStockStatus(
    product.stockStatus || product.stock || localProduct?.stockStatus || localProduct?.stock
  );
  const stockQuantity =
    product.stockQuantity !== undefined
      ? toNullableInteger(product.stockQuantity)
      : toNullableInteger(localProduct?.stockQuantity);
  const lowStockThreshold =
    product.lowStockThreshold !== undefined
      ? toNullableInteger(product.lowStockThreshold) ?? 5
      : toNullableInteger(localProduct?.lowStockThreshold) ?? 5;

  return {
    ...product,
    image,
    thumbnailUrl,
    imageUrl: pickImage(product.imageUrl, product.image, localProduct?.imageUrl, localProduct?.image),
    images: galleryImages,
    galleryImages,
    imageAlt: product.imageAlt || localProduct?.imageAlt || product.name,
    stock: PRODUCT_STOCK_LABELS[stockStatus],
    stockStatus,
    stockQuantity,
    lowStockThreshold,
    allowBackorder: Boolean(product.allowBackorder ?? localProduct?.allowBackorder),
    isPurchasable: Boolean(product.isPurchasable ?? localProduct?.isPurchasable),
  };
};

export const normalizeProducts = (productList: Product[]) =>
  productList.map((product) => normalizeProduct(product));

export const products: Product[] = catalogue.products.map((product) => normalizeProduct(product));

/*
 * API-backed catalogue records may lag behind static image extraction. Keep the
 * UI data-driven while preferring current local image metadata for known SKUs.
 */
export const shouldUseLocalCatalogueFallback = (productList: Product[]) =>
  productList.length > 0 && !productList.some((product) => isKnownCatalogueProduct(product));

export const categoryOptions: Array<Category | "All"> = [
  "All",
  ...categories.map((category) => category.name),
];

export const formatCurrency = (value: number | null | undefined) => {
  if (typeof value !== "number") return "Request price";

  return new Intl.NumberFormat("en-GH", {
    style: "currency",
    currency: "GHS",
    maximumFractionDigits: 0,
  }).format(value);
};

export const isPricedProduct = (product: Product): product is Product & { price: number } =>
  typeof product.price === "number" && !product.quoteOnly;

export const canPurchaseProduct = (product: Product, quantity = 1) => {
  if (!isPricedProduct(product) || !product.isPurchasable) return false;

  const stockStatus = normalizeStockStatus(product.stockStatus || product.stock);
  const stockQuantity = getNormalizedStockQuantity(product);
  const requestedQuantity = Math.max(1, Math.floor(quantity));

  if (stockStatus === "out_of_stock" || stockStatus === "unavailable") return false;

  if (stockStatus === "preorder") {
    return Boolean(product.allowBackorder);
  }

  if (stockQuantity == null) return false;
  return stockQuantity >= requestedQuantity;
};

export const shouldShowInquiryOption = (product: Product) => {
  const stockStatus = normalizeStockStatus(product.stockStatus || product.stock);
  return (
    product.quoteOnly ||
    typeof product.price !== "number" ||
    !product.isPurchasable ||
    stockStatus === "out_of_stock" ||
    stockStatus === "unavailable"
  );
};

export const getAvailabilityLabel = (product: Product) => {
  const stockStatus = normalizeStockStatus(product.stockStatus || product.stock);
  const stockQuantity = getNormalizedStockQuantity(product);
  const lowStockThreshold = getNormalizedLowStockThreshold(product);

  if (stockStatus === "in_stock") return "In stock";
  if (stockStatus === "low_stock") return "Few left";
  if (stockStatus === "out_of_stock") return "Out of stock";
  if (stockStatus === "preorder") {
    return product.allowBackorder ? "Preorder available" : "Preorder unavailable";
  }

  if (stockQuantity != null && stockQuantity > 0) {
    return stockQuantity <= lowStockThreshold ? "Few left" : "In stock";
  }

  return "Unavailable";
};

export const getPurchaseBlocker = (product: Product, quantity = 1) => {
  if (product.quoteOnly || typeof product.price !== "number") {
    return "Request pricing before checkout.";
  }

  const stockStatus = normalizeStockStatus(product.stockStatus || product.stock);
  const stockQuantity = getNormalizedStockQuantity(product);

  if (!product.isPurchasable) return "Purchasing is disabled until stock is confirmed.";
  if (stockStatus === "out_of_stock") return "Out of stock.";
  if (stockStatus === "unavailable") return "Unavailable for online purchase.";
  if (stockStatus === "preorder" && !product.allowBackorder) {
    return "Preorder is not enabled for this product.";
  }
  if ((stockStatus === "in_stock" || stockStatus === "low_stock") && stockQuantity == null) {
    return "Stock quantity must be confirmed before checkout.";
  }
  if (stockQuantity != null && stockQuantity < quantity && !product.allowBackorder) {
    return `Only ${stockQuantity} available.`;
  }

  return "";
};

export const isCheckoutEligibleProduct = (
  product: Product,
  quantity = 1
): product is Product & { price: number } =>
  isPricedProduct(product) && canPurchaseProduct(product, quantity);

export const formatProductPrice = (product: Product) =>
  product.priceLabel || formatCurrency(product.price);

export const getLineTotal = (product: Product, qty: number) =>
  isPricedProduct(product) ? product.price * qty : 0;

export const getStockTone = (stock: Product["stock"] | ProductStockStatus | Product) => {
  const stockStatus =
    typeof stock === "object"
      ? normalizeStockStatus(stock.stockStatus || stock.stock)
      : normalizeStockStatus(stock);

  if (stockStatus === "in_stock") return "success" as const;
  if (stockStatus === "low_stock" || stockStatus === "preorder") return "warning" as const;
  if (stockStatus === "out_of_stock" || stockStatus === "unavailable") return "danger" as const;
  return "info" as const;
};

export const getSchemaAvailability = (product: Product) => {
  const stockStatus = normalizeStockStatus(product.stockStatus || product.stock);

  if (stockStatus === "in_stock") return "https://schema.org/InStock";
  if (stockStatus === "low_stock") return "https://schema.org/LimitedAvailability";
  if (stockStatus === "out_of_stock") return "https://schema.org/OutOfStock";
  if (stockStatus === "preorder" && product.allowBackorder) return "https://schema.org/PreOrder";
  return "https://schema.org/Discontinued";
};

export const getProductById = (id: string): Product | undefined =>
  products.find((product) => product.id === id);

export const getCategoryByName = (name: string): CatalogueCategory | undefined =>
  categories.find((category) => category.name === name);
