const parseDistanceValue = (value) => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value.replace(/[^\d.]+/g, ""));
    return Number.isFinite(parsed) ? parsed : null;
  }
  if (value && typeof value === "object") {
    const nested = [value.km, value.distanceKm, value.distance, value.value, value.amount];
    for (const candidate of nested) {
      const parsed = parseDistanceValue(candidate);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return null;
};

const readDistanceKm = (details) => {
  if (!details) return null;
  if (typeof details === "string") {
    try {
      const parsed = JSON.parse(details);
      return readDistanceKm(parsed);
    } catch {
      return parseDistanceValue(details);
    }
  }
  if (typeof details !== "object") return parseDistanceValue(details);
  const candidates = [
    details.distanceKm,
    details.distance_km,
    details.distance,
    details.km,
    details.kilometers,
    details.kilometres,
    details.distanceInKm,
    details.deliveryDistance,
    details.deliveryDistanceKm,
  ];
  for (const candidate of candidates) {
    const parsed = parseDistanceValue(candidate);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
};

export const getRecordedDeliveryDistanceKm = (deliveryMethod, deliveryDetails) => {
  const isPickup = String(deliveryMethod || "").toLowerCase().includes("pickup");
  if (isPickup) return 0;
  const rawDistance = readDistanceKm(deliveryDetails);
  return Number.isFinite(rawDistance) && rawDistance > 0
    ? Math.round(rawDistance * 10) / 10
    : 0;
};

export const getDeliveryFeeDetails = (deliveryMethod, deliveryDetails, rateCents) => {
  const parsedRateCents = Number(rateCents);
  if (!Number.isFinite(parsedRateCents) || parsedRateCents < 0) {
    throw new TypeError("An explicit non-negative delivery rate in cents is required.");
  }
  const normalizedRateCents = Math.round(parsedRateCents);
  const isPickup = String(deliveryMethod || "").toLowerCase().includes("pickup");
  if (isPickup) return { distanceKm: 0, feeCents: 0, rateCents: normalizedRateCents };
  const rawDistance = readDistanceKm(deliveryDetails);
  if (!Number.isFinite(rawDistance) || rawDistance <= 0) {
    const error = new Error(
      "A positive delivery distance is required before the delivery fee can be calculated."
    );
    error.statusCode = 422;
    error.code = "DELIVERY_DISTANCE_REQUIRED";
    throw error;
  }
  const distanceKm = Math.round(rawDistance * 10) / 10;
  const feeCents = Math.round(distanceKm * normalizedRateCents);
  return { distanceKm, feeCents, rateCents: normalizedRateCents };
};
