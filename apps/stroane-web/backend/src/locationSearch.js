const DEFAULT_SEARCH_ENDPOINT = "https://nominatim.openstreetmap.org/search";
const DEFAULT_COUNTRY_CODES = "gh";
const DEFAULT_LIMIT = 6;

const sanitizeText = (value = "", maxLength = 240) =>
  String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, maxLength);

const toCoordinate = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const clampLimit = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return DEFAULT_LIMIT;
  return Math.min(Math.max(Math.trunc(parsed), 1), 8);
};

const buildMapUrl = ({ latitude, longitude, fallbackQuery }) => {
  if (latitude !== null && longitude !== null) {
    return `https://www.openstreetmap.org/?mlat=${encodeURIComponent(
      String(latitude)
    )}&mlon=${encodeURIComponent(String(longitude))}#map=17/${encodeURIComponent(
      String(latitude)
    )}/${encodeURIComponent(String(longitude))}`;
  }
  if (!fallbackQuery) return "";
  return `https://www.openstreetmap.org/search?query=${encodeURIComponent(fallbackQuery)}`;
};

const toLocationResult = (item) => {
  const latitude = toCoordinate(item?.lat);
  const longitude = toCoordinate(item?.lon);
  const label = sanitizeText(item?.display_name, 260);
  if (!label) return null;

  return {
    id: sanitizeText(item?.place_id || `${item?.osm_type || "place"}-${item?.osm_id || label}`, 120),
    placeId: sanitizeText(item?.place_id || item?.osm_id || "", 120),
    label,
    address: label,
    provider: "nominatim",
    latitude,
    longitude,
    mapUrl: buildMapUrl({ latitude, longitude, fallbackQuery: label }),
  };
};

export const normalizeDeliveryLocation = (value = {}) => {
  if (!value || typeof value !== "object") return null;
  const label = sanitizeText(value.label || value.address || "", 260);
  const address = sanitizeText(value.address || value.label || "", 260);
  const latitude = toCoordinate(value.latitude);
  const longitude = toCoordinate(value.longitude);
  const hasCoordinates = latitude !== null && longitude !== null;
  if (!label && !address && !hasCoordinates) return null;

  return {
    placeId: sanitizeText(value.placeId || value.id || "", 120) || null,
    label: label || address || null,
    address: address || label || null,
    provider: sanitizeText(value.provider || "", 80) || null,
    latitude,
    longitude,
    mapUrl:
      sanitizeText(value.mapUrl || "", 500) ||
      buildMapUrl({ latitude, longitude, fallbackQuery: address || label }) ||
      null,
  };
};

export const toPublicDeliveryLocation = (order = {}) => {
  const latitude = toCoordinate(order.deliveryLatitude);
  const longitude = toCoordinate(order.deliveryLongitude);
  const label = sanitizeText(order.deliveryLocationLabel || order.deliveryAddress || "", 260);
  if (!label && latitude === null && longitude === null) return null;

  return {
    placeId: order.deliveryPlaceId || undefined,
    label: label || undefined,
    address: order.deliveryAddress || undefined,
    provider: order.deliveryLocationProvider || undefined,
    latitude: latitude ?? undefined,
    longitude: longitude ?? undefined,
    mapUrl:
      order.deliveryMapUrl ||
      buildMapUrl({ latitude, longitude, fallbackQuery: order.deliveryAddress || label }) ||
      undefined,
  };
};

export const searchDeliveryLocations = async (query, options = {}) => {
  const safeQuery = sanitizeText(query, 140);
  if (safeQuery.length < 3) return [];
  if (String(process.env.STROANE_LOCATION_SEARCH_ENABLED || "true").toLowerCase() === "false") {
    return [];
  }

  const fetchImpl = options.fetchImpl || globalThis.fetch;
  if (typeof fetchImpl !== "function") {
    const error = new Error("Location search is not available in this runtime.");
    error.statusCode = 503;
    throw error;
  }

  const endpoint = process.env.STROANE_LOCATION_SEARCH_URL || DEFAULT_SEARCH_ENDPOINT;
  const url = new URL(endpoint);
  url.searchParams.set("q", safeQuery);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("limit", String(clampLimit(options.limit)));
  url.searchParams.set(
    "countrycodes",
    sanitizeText(process.env.STROANE_LOCATION_COUNTRY_CODES, 20) || DEFAULT_COUNTRY_CODES
  );

  const response = await fetchImpl(url, {
    headers: {
      Accept: "application/json",
      "User-Agent":
        process.env.STROANE_LOCATION_SEARCH_USER_AGENT ||
        "StroaneSolutions/1.0 (orders@stroanesolutions.com)",
    },
  });

  if (!response.ok) {
    const error = new Error("Location search provider is unavailable.");
    error.statusCode = 502;
    throw error;
  }

  const body = await response.json().catch(() => []);
  if (!Array.isArray(body)) return [];
  return body.map(toLocationResult).filter(Boolean);
};
