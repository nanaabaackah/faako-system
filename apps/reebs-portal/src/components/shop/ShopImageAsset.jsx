import { useEffect, useState } from "react";

const isUnavailableImageSource = (src = "") => {
  const normalized = src.toString().trim().toLowerCase();
  if (!normalized) return true;
  return normalized.includes("placeholder");
};

function ShopImageAsset({ src, alt, fallbackClassName = "" }) {
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    setImageError(false);
  }, [src]);

  const showFallback = isUnavailableImageSource(src) || imageError;

  if (showFallback) {
    return (
      <div
        className={`shop-image-fallback ${fallbackClassName}`.trim()}
        role="img"
        aria-label={`${alt || "Item"} image not available`}
      >
        <span>Image not available</span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      onError={() => setImageError(true)}
    />
  );
}

export default ShopImageAsset;
