import { matchesFrontendRentalDetailSlug } from "./rentalCatalog.js";

export const normalizePublishedRental = (item) => item ? {
  ...item,
  productId: item.productId || item.id,
  sourceCategoryCode: "RENTAL",
  specificCategory: item.specificCategory || item.category,
  imageUrl: item.imageUrl || item.image,
  quantity: item.availability === "out-of-stock" ? 0 : 1,
  status: item.availability !== "out-of-stock",
} : null;

// Inventory responses can be partial. Keep the already-public Astro detail
// available when unrelated live rentals arrive; matching live data wins.
export const findRentalDetail = (rentals, slug, publishedRental) =>
  rentals.find((item) => matchesFrontendRentalDetailSlug(item, slug))
  || (publishedRental && matchesFrontendRentalDetailSlug(publishedRental, slug)
    ? publishedRental : null);
