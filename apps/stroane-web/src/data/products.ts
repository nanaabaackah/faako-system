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
  parentId?: string | null;
  sortOrder?: number;
  isGroup?: boolean;
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
  productType?: "standalone" | "variant_parent";
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
  media?: ProductMedia[];
  imageAlt?: string;
  tag?: string;
  stock: ProductStock;
  stockStatus?: ProductStockStatus;
  stockQuantity?: number | null;
  availableQuantity?: number | null;
  reservedQuantity?: number | null;
  lowStockThreshold?: number | null;
  allowBackorder?: boolean;
  isPurchasable?: boolean;
  availability?: string;
  quoteOnly?: boolean;
  sku: string;
  reorderThreshold?: number | null;
  supplier?: string | null;
  costPrice?: number | null;
  sellingPrice?: number | null;
  variants?: ProductVariant[];
  features: string[];
  specifications?: Record<string, string> | ProductSpecification[];
  tags?: string[];
  useCases?: string[];
  inquiryCta?: string;
  sourceRefs?: string[];
  manualReviewRequired?: boolean;
  reviewNotes?: string[];
}

export type ProductMediaType =
  | "primary"
  | "gallery"
  | "variant"
  | "lifestyle"
  | "detail"
  | "packaging";

export interface ProductMedia {
  url: string;
  alt: string;
  type: ProductMediaType;
  sortOrder: number;
  publicId?: string;
  secureUrl?: string;
  variantId?: string;
}

export interface ProductSpecification {
  label: string;
  value: string;
  group?: string;
}

export interface ProductVariant {
  id: string;
  name: string;
  sku: string;
  price?: number | null;
  priceLabel?: string;
  currency?: "GHS";
  stockQuantity?: number | null;
  availableQuantity?: number | null;
  reservedQuantity?: number | null;
  stockStatus?: ProductStockStatus;
  reorderThreshold?: number | null;
  allowBackorder?: boolean;
  isPurchasable?: boolean;
  imageUrl?: string;
  imageAlt?: string;
  media?: ProductMedia[];
  options?: Record<string, string>;
}

interface CatalogueSeed {
  businessProfile: BusinessProfile;
  categories: CatalogueCategory[];
  products: Product[];
}

const catalogue = catalogueData as CatalogueSeed;
const PRODUCT_IMAGE_PLACEHOLDER = "/imgs/products/product-placeholder.webp";
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

export const getAvailableStockQuantity = (product: Product) => {
  const explicitAvailableQuantity = toNullableInteger(product.availableQuantity);
  if (explicitAvailableQuantity != null) return explicitAvailableQuantity;

  const stockQuantity = getNormalizedStockQuantity(product);
  if (stockQuantity == null) return null;

  const reservedQuantity = toNullableInteger(product.reservedQuantity) ?? 0;
  return Math.max(0, stockQuantity - reservedQuantity);
};

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

const normalizeMediaItems = (
  product: Product,
  localProduct?: Product
): ProductMedia[] => {
  const explicitMedia = Array.isArray(product.media) && product.media.length
    ? product.media
    : localProduct?.media;

  if (Array.isArray(explicitMedia) && explicitMedia.length) {
    return explicitMedia
      .filter((item) => item?.url)
      .map((item, index) => ({
        url: item.url,
        alt: item.alt || product.imageAlt || product.name,
        type: item.type || (index === 0 ? "primary" : "gallery"),
        sortOrder: Number.isFinite(item.sortOrder) ? item.sortOrder : index + 1,
        publicId: item.publicId,
        secureUrl: item.secureUrl,
        variantId: item.variantId,
      }))
      .sort((left, right) => left.sortOrder - right.sortOrder);
  }

  const image = pickImage(product.imageUrl, product.image, localProduct?.imageUrl, localProduct?.image);
  const galleryImages = pickGalleryImages(
    image,
    product.galleryImages,
    localProduct?.galleryImages,
    product.images,
    localProduct?.images
  );

  return galleryImages.map((url, index) => ({
    url,
    alt: product.imageAlt || localProduct?.imageAlt || product.name,
    type: index === 0 ? "primary" : "gallery",
    sortOrder: index + 1,
  }));
};

const normalizeSpecifications = (
  specifications?: Product["specifications"]
): ProductSpecification[] => {
  if (Array.isArray(specifications)) {
    return specifications
      .filter((item) => item?.label && item?.value)
      .map((item) => ({
        label: String(item.label),
        value: String(item.value),
        group: item.group ? String(item.group) : undefined,
      }));
  }

  return Object.entries(specifications || {}).map(([label, value]) => ({
    label,
    value: String(value),
  }));
};

const normalizeVariants = (
  variants: Product["variants"] | undefined,
  productName: string
): ProductVariant[] =>
  (Array.isArray(variants) ? variants : [])
    .filter((variant) => variant?.id && variant?.name)
    .map((variant) => ({
      ...variant,
      currency: variant.currency || "GHS",
      price: variant.price == null ? null : Number(variant.price),
      stockStatus: normalizeStockStatus(variant.stockStatus),
      stockQuantity: toNullableInteger(variant.stockQuantity),
      availableQuantity: toNullableInteger(variant.availableQuantity),
      reservedQuantity: toNullableInteger(variant.reservedQuantity),
      reorderThreshold: toNullableInteger(variant.reorderThreshold),
      allowBackorder: Boolean(variant.allowBackorder),
      isPurchasable: Boolean(variant.isPurchasable),
      imageAlt: variant.imageAlt || `${productName} - ${variant.name}`,
      media: Array.isArray(variant.media)
        ? variant.media
            .filter((item) => item?.url)
            .map((item, index) => ({
              ...item,
              alt: item.alt || variant.imageAlt || `${productName} - ${variant.name}`,
              type: item.type || "variant",
              sortOrder: Number.isFinite(item.sortOrder) ? item.sortOrder : index + 1,
              variantId: item.variantId || variant.id,
            }))
        : undefined,
    }));

export const businessProfile = catalogue.businessProfile;

export const categories: CatalogueCategory[] = catalogue.categories;

export const isKnownCatalogueProduct = (product: Pick<Product, "id">) =>
  localProductById.has(product.id);

export const normalizeProduct = (product: Product): Product => {
  const localProduct = localProductById.get(product.id);
  const media = normalizeMediaItems(product, localProduct);
  const primaryMedia = media.find((item) => item.type === "primary") || media[0];
  const image = pickImage(
    primaryMedia?.url,
    product.imageUrl,
    product.image,
    localProduct?.imageUrl,
    localProduct?.image
  );
  const thumbnailUrl = pickImage(
    product.thumbnailUrl,
    primaryMedia?.url,
    product.imageUrl,
    product.image,
    localProduct?.thumbnailUrl,
    localProduct?.imageUrl,
    localProduct?.image
  );
  const galleryImages = media.map((item) => item.url);
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
  const reservedQuantity =
    product.reservedQuantity !== undefined
      ? toNullableInteger(product.reservedQuantity)
      : toNullableInteger(localProduct?.reservedQuantity);
  const availableQuantity =
    product.availableQuantity !== undefined
      ? toNullableInteger(product.availableQuantity)
      : stockQuantity == null
        ? null
        : Math.max(0, stockQuantity - (reservedQuantity ?? 0));

  return {
    ...product,
    image,
    thumbnailUrl,
    imageUrl: pickImage(primaryMedia?.url, product.imageUrl, product.image, localProduct?.imageUrl, localProduct?.image),
    images: galleryImages,
    galleryImages,
    media,
    imageAlt: product.imageAlt || localProduct?.imageAlt || product.name,
    stock: PRODUCT_STOCK_LABELS[stockStatus],
    stockStatus,
    stockQuantity,
    availableQuantity,
    reservedQuantity,
    lowStockThreshold,
    allowBackorder: Boolean(product.allowBackorder ?? localProduct?.allowBackorder),
    isPurchasable: Boolean(product.isPurchasable ?? localProduct?.isPurchasable),
    reorderThreshold:
      product.reorderThreshold !== undefined
        ? toNullableInteger(product.reorderThreshold)
        : toNullableInteger(localProduct?.reorderThreshold),
    costPrice: product.costPrice == null ? null : Number(product.costPrice),
    sellingPrice: product.sellingPrice == null ? product.price : Number(product.sellingPrice),
    supplier: product.supplier || null,
    variants: normalizeVariants(product.variants || localProduct?.variants, product.name),
    specifications: normalizeSpecifications(product.specifications || localProduct?.specifications),
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
  ...categories.filter((category) => !category.isGroup).map((category) => category.name),
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
  const availableQuantity = getAvailableStockQuantity(product);
  const requestedQuantity = Math.max(1, Math.floor(quantity));

  if (stockStatus === "out_of_stock" || stockStatus === "unavailable") return false;

  if (stockStatus === "preorder") {
    return Boolean(product.allowBackorder);
  }

  if (availableQuantity == null) return false;
  return availableQuantity >= requestedQuantity;
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
  const availableQuantity = getAvailableStockQuantity(product);
  const lowStockThreshold = getNormalizedLowStockThreshold(product);

  if ((stockStatus === "in_stock" || stockStatus === "low_stock") && availableQuantity != null) {
    if (availableQuantity <= 0) return "Out of stock";
    return availableQuantity <= lowStockThreshold ? "Few left" : "In stock";
  }

  if (stockStatus === "in_stock") return "In stock";
  if (stockStatus === "low_stock") return "Few left";
  if (stockStatus === "out_of_stock") return "Out of stock";
  if (stockStatus === "preorder") {
    return product.allowBackorder ? "Preorder available" : "Preorder unavailable";
  }

  if (availableQuantity != null && availableQuantity > 0) {
    return availableQuantity <= lowStockThreshold ? "Few left" : "In stock";
  }

  return "Unavailable";
};

export const getStockDetailLabel = (product: Product) => {
  const availableQuantity = getAvailableStockQuantity(product);
  if (availableQuantity == null) return "";
  if (availableQuantity <= 0) return "No available stock";
  return `${availableQuantity} available`;
};

export const getPurchaseBlocker = (product: Product, quantity = 1) => {
  if (product.quoteOnly || typeof product.price !== "number") {
    return "Request pricing before checkout.";
  }

  const stockStatus = normalizeStockStatus(product.stockStatus || product.stock);
  const availableQuantity = getAvailableStockQuantity(product);

  if (!product.isPurchasable) return "Purchasing is disabled until stock is confirmed.";
  if (stockStatus === "out_of_stock") return "Out of stock.";
  if (stockStatus === "unavailable") return "Unavailable for online purchase.";
  if (stockStatus === "preorder" && !product.allowBackorder) {
    return "Preorder is not enabled for this product.";
  }
  if ((stockStatus === "in_stock" || stockStatus === "low_stock") && availableQuantity == null) {
    return "Stock quantity must be confirmed before checkout.";
  }
  if (availableQuantity != null && availableQuantity < quantity && !product.allowBackorder) {
    return `Only ${availableQuantity} available.`;
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

export const formatVariantPrice = (product: Product, variant?: ProductVariant | null) => {
  if (!variant) return formatProductPrice(product);
  return variant.priceLabel || formatCurrency(variant.price ?? product.price);
};

export const getProductMedia = (product: Product, variant?: ProductVariant | null) => {
  const variantMedia = variant?.media?.length
    ? variant.media
    : variant?.imageUrl
      ? [
          {
            url: variant.imageUrl,
            alt: variant.imageAlt || `${product.name} - ${variant.name}`,
            type: "variant" as ProductMediaType,
            sortOrder: 1,
            variantId: variant.id,
          },
        ]
      : [];

  const productMedia = product.media?.length
    ? product.media
    : (product.galleryImages || [product.image]).map((url, index) => ({
        url,
        alt: product.imageAlt || product.name,
        type: index === 0 ? ("primary" as ProductMediaType) : ("gallery" as ProductMediaType),
        sortOrder: index + 1,
      }));

  const combined = [...variantMedia, ...productMedia];
  const seen = new Set<string>();
  return combined
    .filter((item) => {
      if (!item.url || seen.has(item.url)) return false;
      seen.add(item.url);
      return true;
    })
    .sort((left, right) => left.sortOrder - right.sortOrder);
};

export const getProductSpecifications = (product: Product): ProductSpecification[] =>
  normalizeSpecifications(product.specifications);

export const getLineTotal = (product: Product, qty: number) =>
  isPricedProduct(product) ? product.price * qty : 0;

export const getStockTone = (stock: Product["stock"] | ProductStockStatus | Product) => {
  const stockStatus =
    typeof stock === "object"
      ? normalizeStockStatus(stock.stockStatus || stock.stock)
      : normalizeStockStatus(stock);
  const availableQuantity = typeof stock === "object" ? getAvailableStockQuantity(stock) : null;
  const lowStockThreshold =
    typeof stock === "object" ? getNormalizedLowStockThreshold(stock) : 5;

  if (availableQuantity != null) {
    if (availableQuantity <= 0) return "danger" as const;
    if (availableQuantity <= lowStockThreshold) return "warning" as const;
  }

  if (stockStatus === "in_stock") return "success" as const;
  if (stockStatus === "low_stock" || stockStatus === "preorder") return "warning" as const;
  if (stockStatus === "out_of_stock" || stockStatus === "unavailable") return "danger" as const;
  return "info" as const;
};

export const getSchemaAvailability = (product: Product) => {
  const stockStatus = normalizeStockStatus(product.stockStatus || product.stock);
  const availableQuantity = getAvailableStockQuantity(product);

  if (availableQuantity != null && availableQuantity <= 0) {
    return "https://schema.org/OutOfStock";
  }

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
