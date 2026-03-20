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

export const getDeliveryFeeDetails = (deliveryMethod, deliveryDetails, rateCents = 50) => {
  const isPickup = String(deliveryMethod || "").toLowerCase().includes("pickup");
  if (isPickup) return { distanceKm: 0, feeCents: 0, rateCents };
  const rawDistance = readDistanceKm(deliveryDetails);
  if (!Number.isFinite(rawDistance) || rawDistance <= 0) {
    return { distanceKm: 0, feeCents: 0, rateCents };
  }
  const distanceKm = Math.round(rawDistance * 10) / 10;
  const feeCents = Math.round(distanceKm * rateCents);
  return { distanceKm, feeCents, rateCents };
};
