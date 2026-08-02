import catalogue from "./public-catalogue.json";

export const publicRentals = Object.freeze(catalogue.rentals || []);
export const publicShopItems = Object.freeze(catalogue.shop || []);
export const publicCatalogueItems = Object.freeze([
  ...publicRentals,
  ...publicShopItems,
]);

export const getPublicCatalogueItem = (kind, slug) =>
  publicCatalogueItems.find(
    (item) => item.kind === kind && item.slug === String(slug || ""),
  ) || null;

export const getPublicCategoryItems = (kind, categorySlug) =>
  publicCatalogueItems.filter(
    (item) =>
      item.kind === kind
      && item.categorySlug === String(categorySlug || ""),
  );

export const getPublicCategories = (kind) =>
  Array.from(
    new Map(
      publicCatalogueItems
        .filter((item) => item.kind === kind)
        .map((item) => [
          item.categorySlug,
          {
            kind,
            slug: item.categorySlug,
            name: item.category,
            count: getPublicCategoryItems(kind, item.categorySlug).length,
          },
        ]),
    ).values(),
  ).sort((left, right) => left.name.localeCompare(right.name));
