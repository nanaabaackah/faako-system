/** @param {any} content @param {string} key @param {import('./collections').PublicImage|null} fallback */
export function imagePlacement(content, key, fallback = null) {
  const placement = content?.imagePlacements?.[key] || {};
  return { ...placement, image: placement.image || fallback };
}
export function recordImagePlacement(record) {
  return {
    ...record?.imagePlacement,
    image: record?.imagePlacement?.image || record?.image || null,
  };
}
