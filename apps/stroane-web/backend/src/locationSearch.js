const DEFAULT_SEARCH_ENDPOINT = "https://nominatim.openstreetmap.org/search";
const DEFAULT_GOOGLE_PLACES_AUTOCOMPLETE_ENDPOINT =
  "https://places.googleapis.com/v1/places:autocomplete";
const DEFAULT_GOOGLE_PLACE_DETAILS_ENDPOINT = "https://places.googleapis.com/v1/places";
const DEFAULT_GOOGLE_AUTOCOMPLETE_FIELD_MASK =
  "suggestions.placePrediction.placeId,suggestions.placePrediction.place,suggestions.placePrediction.text.text,suggestions.placePrediction.structuredFormat.mainText.text,suggestions.placePrediction.structuredFormat.secondaryText.text";
const DEFAULT_GOOGLE_PLACE_DETAILS_FIELD_MASK =
  "id,displayName,formattedAddress,location";
const DEFAULT_COUNTRY_CODES = "gh";
const DEFAULT_REGION_CODE = "gh";
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

const buildGoogleMapUrl = ({ latitude, longitude, fallbackQuery }) => {
  const query =
    latitude !== null && longitude !== null ? `${latitude},${longitude}` : fallbackQuery || "";
  if (!query) return "";
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
};

const getRegionCode = () =>
  (sanitizeText(process.env.STROANE_LOCATION_REGION_CODE, 2) || DEFAULT_REGION_CODE).toLowerCase();

const getIncludedRegionCodes = () => {
  const regionCodes =
    sanitizeText(process.env.STROANE_LOCATION_COUNTRY_CODES, 80) || DEFAULT_COUNTRY_CODES;
  return regionCodes
    .split(",")
    .map((code) => sanitizeText(code, 2).toLowerCase())
    .filter(Boolean)
    .slice(0, 15);
};

const getGoogleMapsApiKey = () =>
  sanitizeText(
    process.env.GOOGLE_MAPS_API_KEY ||
      process.env.GOOGLE_PLACES_API_KEY ||
      process.env.STROANE_GOOGLE_MAPS_API_KEY ||
      "",
    240
  );

const getLocationSearchProvider = () => {
  const configuredProvider = sanitizeText(process.env.STROANE_LOCATION_SEARCH_PROVIDER, 40)
    .toLowerCase()
    .replace(/[-\s]+/g, "_");
  if (["google", "google_maps", "google_places"].includes(configuredProvider)) return "google";
  if (["nominatim", "openstreetmap", "osm"].includes(configuredProvider)) return "nominatim";
  return getGoogleMapsApiKey() ? "google" : "nominatim";
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

const toGoogleLocationResult = (place) => {
  const displayName = sanitizeText(place?.displayName?.text, 160);
  const formattedAddress = sanitizeText(place?.formattedAddress, 260);
  const latitude = toCoordinate(place?.location?.latitude);
  const longitude = toCoordinate(place?.location?.longitude);
  const label =
    displayName && formattedAddress && displayName !== formattedAddress
      ? `${displayName} - ${formattedAddress}`
      : displayName || formattedAddress;
  if (!label) return null;

  return {
    id: sanitizeText(place?.id || place?.name || label, 120),
    placeId: sanitizeText(place?.id || String(place?.name || "").replace(/^places\//, ""), 120),
    label: sanitizeText(label, 260),
    address: formattedAddress || label,
    provider: "Google Maps",
    latitude,
    longitude,
    mapUrl:
      sanitizeText(place?.googleMapsUri, 500) ||
      buildGoogleMapUrl({ latitude, longitude, fallbackQuery: formattedAddress || label }),
  };
};

const toGoogleAutocompleteResult = (suggestion) => {
  const prediction = suggestion?.placePrediction;
  if (!prediction) return null;
  const label = sanitizeText(prediction?.text?.text, 260);
  const mainText = sanitizeText(prediction?.structuredFormat?.mainText?.text, 160);
  const secondaryText = sanitizeText(prediction?.structuredFormat?.secondaryText?.text, 220);
  const placeId = sanitizeText(
    prediction?.placeId || String(prediction?.place || "").replace(/^places\//, ""),
    120
  );
  if (!label || !placeId) return null;

  return {
    id: placeId,
    placeId,
    label,
    address: label,
    provider: "Google Maps",
    latitude: null,
    longitude: null,
    mapUrl: buildGoogleMapUrl({ latitude: null, longitude: null, fallbackQuery: label }),
    mainText: mainText || label,
    secondaryText,
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

const searchNominatimDeliveryLocations = async (safeQuery, options = {}) => {
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

const searchGoogleDeliveryLocations = async (safeQuery, options = {}) => {
  const apiKey = getGoogleMapsApiKey();
  if (!apiKey) {
    const error = new Error("Google Maps location search is not configured.");
    error.statusCode = 503;
    throw error;
  }

  const fetchImpl = options.fetchImpl || globalThis.fetch;
  if (typeof fetchImpl !== "function") {
    const error = new Error("Location search is not available in this runtime.");
    error.statusCode = 503;
    throw error;
  }

  const endpoint =
    process.env.STROANE_GOOGLE_PLACES_AUTOCOMPLETE_URL ||
    DEFAULT_GOOGLE_PLACES_AUTOCOMPLETE_ENDPOINT;
  const requestBody = {
    input: safeQuery,
    includedRegionCodes: getIncludedRegionCodes(),
    regionCode: getRegionCode(),
  };
  const sessionToken = sanitizeText(options.sessionToken, 120);
  if (sessionToken) requestBody.sessionToken = sessionToken;

  const response = await fetchImpl(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask":
        sanitizeText(process.env.STROANE_GOOGLE_AUTOCOMPLETE_FIELD_MASK, 500) ||
        DEFAULT_GOOGLE_AUTOCOMPLETE_FIELD_MASK,
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const error = new Error("Location search provider is unavailable.");
    error.statusCode = 502;
    throw error;
  }

  const responseBody = await response.json().catch(() => null);
  const suggestions = Array.isArray(responseBody?.suggestions) ? responseBody.suggestions : [];
  return suggestions
    .map(toGoogleAutocompleteResult)
    .filter(Boolean)
    .slice(0, clampLimit(options.limit));
};

export const searchDeliveryLocations = async (query, options = {}) => {
  const safeQuery = sanitizeText(query, 140);
  if (safeQuery.length < 3) return [];
  if (String(process.env.STROANE_LOCATION_SEARCH_ENABLED || "true").toLowerCase() === "false") {
    return [];
  }

  return getLocationSearchProvider() === "google"
    ? searchGoogleDeliveryLocations(safeQuery, options)
    : searchNominatimDeliveryLocations(safeQuery, options);
};

export const getDeliveryLocationDetails = async (placeId, options = {}) => {
  const safePlaceId = sanitizeText(String(placeId || "").replace(/^places\//, ""), 160);
  if (!safePlaceId) {
    const error = new Error("A Google place ID is required.");
    error.statusCode = 400;
    throw error;
  }

  const apiKey = getGoogleMapsApiKey();
  if (!apiKey) {
    const error = new Error("Google Maps location search is not configured.");
    error.statusCode = 503;
    throw error;
  }

  const fetchImpl = options.fetchImpl || globalThis.fetch;
  if (typeof fetchImpl !== "function") {
    const error = new Error("Location search is not available in this runtime.");
    error.statusCode = 503;
    throw error;
  }

  const endpoint =
    process.env.STROANE_GOOGLE_PLACE_DETAILS_URL || DEFAULT_GOOGLE_PLACE_DETAILS_ENDPOINT;
  const url = new URL(`${endpoint.replace(/\/+$/, "")}/${encodeURIComponent(safePlaceId)}`);
  url.searchParams.set("regionCode", getRegionCode());
  const sessionToken = sanitizeText(options.sessionToken, 120);
  if (sessionToken) url.searchParams.set("sessionToken", sessionToken);

  const response = await fetchImpl(url, {
    headers: {
      Accept: "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask":
        sanitizeText(process.env.STROANE_GOOGLE_PLACE_DETAILS_FIELD_MASK, 500) ||
        DEFAULT_GOOGLE_PLACE_DETAILS_FIELD_MASK,
    },
  });

  if (!response.ok) {
    const error = new Error("Location details provider is unavailable.");
    error.statusCode = 502;
    throw error;
  }

  const body = await response.json().catch(() => null);
  const location = toGoogleLocationResult(body);
  if (!location) {
    const error = new Error("Location details were not found.");
    error.statusCode = 404;
    throw error;
  }
  return location;
};
