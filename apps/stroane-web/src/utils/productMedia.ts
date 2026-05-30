export const PRODUCT_IMAGE_FALLBACK = "/imgs/products/product-placeholder.webp";

const PRODUCT_IMAGE_PATH_PATTERN =
  /^\/imgs\/products\/[a-zA-Z0-9][a-zA-Z0-9/_-]*\.(?:avif|gif|jpe?g|png|webp)$/i;

export const normalizeProductImagePath = (value: string) => {
  const normalized = value.trim().replace(/\/+/g, "/");
  if (!normalized) return "";

  if (
    !PRODUCT_IMAGE_PATH_PATTERN.test(normalized) ||
    normalized.includes("..") ||
    normalized.includes("\\") ||
    normalized.includes("?") ||
    normalized.includes("#")
  ) {
    throw new Error(
      "Product images must use a safe /imgs/products/ path with a supported image extension."
    );
  }

  return normalized;
};

export const parseProductGalleryPaths = (value: string) =>
  [...new Set(
    value
      .split(/\r?\n/)
      .map((path) => normalizeProductImagePath(path))
      .filter(Boolean)
  )].slice(0, 12);
