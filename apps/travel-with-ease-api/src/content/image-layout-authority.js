import { ContentError } from "./schema.js";

// Image selection and alt text remain editorial. Geometry and page layouts are
// technical decisions restricted to the TWE Superadmin, including direct API saves.
const geometryKeys = ["focalX", "focalY", "mobileFocalX", "mobileFocalY", "layout"];
const defaults = Object.freeze({ focalX: 50, focalY: 50, mobileFocalX: 50, mobileFocalY: 50, layout: "default" });

function geometry(placement) {
  return geometryKeys.map(key => placement?.[key] ?? defaults[key]);
}
function sameGeometry(a, b) {
  return JSON.stringify(geometry(a)) === JSON.stringify(geometry(b));
}
function recordKey(record, index) {
  return record?.id || record?.slug || record?.serviceSlug || `index:${index}`;
}

export function assertImageLayoutAuthority(previous, next, actor) {
  if (actor?.role === "platform_admin") return;
  const oldSlots = previous?.imagePlacements || {};
  const newSlots = next.imagePlacements || {};
  for (const key of new Set([...Object.keys(oldSlots), ...Object.keys(newSlots)])) {
    if (!sameGeometry(oldSlots[key], newSlots[key]))
      throw new ContentError(403, "permission_error", "Only Superadmin can change image layout or focal points.");
  }
  for (const collection of ["entries", "packages", "articles", "tips"]) {
    const originals = new Map((previous?.[collection] || []).map((record, index) => [recordKey(record, index), record]));
    for (const [index, record] of (next[collection] || []).entries()) {
      const old = originals.get(recordKey(record, index));
      if (!sameGeometry(old?.imagePlacement, record.imagePlacement))
        throw new ContentError(403, "permission_error", "Only Superadmin can change image layout or focal points.");
    }
  }
}
