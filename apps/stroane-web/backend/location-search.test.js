import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { getDeliveryLocationDetails, searchDeliveryLocations } from "./src/locationSearch.js";

const LOCATION_ENV_KEYS = [
  "GOOGLE_MAPS_API_KEY",
  "GOOGLE_PLACES_API_KEY",
  "STROANE_GOOGLE_MAPS_API_KEY",
  "STROANE_GOOGLE_PLACES_AUTOCOMPLETE_URL",
  "STROANE_GOOGLE_AUTOCOMPLETE_FIELD_MASK",
  "STROANE_GOOGLE_PLACE_DETAILS_URL",
  "STROANE_GOOGLE_PLACE_DETAILS_FIELD_MASK",
  "STROANE_LOCATION_SEARCH_PROVIDER",
  "STROANE_LOCATION_REGION_CODE",
  "STROANE_LOCATION_SEARCH_URL",
  "STROANE_LOCATION_COUNTRY_CODES",
];

const ORIGINAL_ENV = new Map(LOCATION_ENV_KEYS.map((key) => [key, process.env[key]]));

afterEach(() => {
  LOCATION_ENV_KEYS.forEach((key) => {
    const originalValue = ORIGINAL_ENV.get(key);
    if (originalValue === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = originalValue;
    }
  });
});

test("location search uses Google Places Autocomplete when a Google Maps key is configured", async () => {
  process.env.GOOGLE_MAPS_API_KEY = "test-google-key";
  process.env.STROANE_LOCATION_REGION_CODE = "GH";

  let requestedUrl = "";
  let requestedOptions = null;
  const fetchImpl = async (url, options) => {
    requestedUrl = String(url);
    requestedOptions = options;
    return {
      ok: true,
      json: async () => ({
        suggestions: [
          {
            placePrediction: {
              place: "places/ChIJ-stroane-east-legon",
              placeId: "ChIJ-stroane-east-legon",
              text: { text: "East Legon, Accra, Ghana" },
              structuredFormat: {
                mainText: { text: "East Legon" },
                secondaryText: { text: "Accra, Ghana" },
              },
            },
          },
        ],
      }),
    };
  };

  const locations = await searchDeliveryLocations("  East Legon  ", {
    fetchImpl,
    limit: 3,
    sessionToken: "session-123",
  });

  assert.equal(requestedUrl, "https://places.googleapis.com/v1/places:autocomplete");
  assert.equal(requestedOptions.method, "POST");
  assert.equal(requestedOptions.headers["X-Goog-Api-Key"], "test-google-key");
  assert.match(requestedOptions.headers["X-Goog-FieldMask"], /suggestions\.placePrediction/);
  assert.deepEqual(JSON.parse(requestedOptions.body), {
    input: "East Legon",
    includedRegionCodes: ["gh"],
    regionCode: "gh",
    sessionToken: "session-123",
  });
  assert.deepEqual(locations, [
    {
      id: "ChIJ-stroane-east-legon",
      placeId: "ChIJ-stroane-east-legon",
      label: "East Legon, Accra, Ghana",
      address: "East Legon, Accra, Ghana",
      provider: "Google Maps",
      latitude: null,
      longitude: null,
      mapUrl:
        "https://www.google.com/maps/search/?api=1&query=East%20Legon%2C%20Accra%2C%20Ghana",
      mainText: "East Legon",
      secondaryText: "Accra, Ghana",
    },
  ]);
});

test("location details resolves a selected Google autocomplete place", async () => {
  process.env.GOOGLE_MAPS_API_KEY = "test-google-key";
  process.env.STROANE_LOCATION_REGION_CODE = "GH";

  let requestedUrl = "";
  let requestedOptions = null;
  const fetchImpl = async (url, options) => {
    requestedUrl = String(url);
    requestedOptions = options;
    return {
      ok: true,
      json: async () => ({
        id: "ChIJ-stroane-east-legon",
        displayName: { text: "East Legon" },
        formattedAddress: "East Legon, Accra, Ghana",
        location: { latitude: 5.6505, longitude: -0.1461 },
      }),
    };
  };

  const location = await getDeliveryLocationDetails("ChIJ-stroane-east-legon", {
    fetchImpl,
    sessionToken: "session-123",
  });

  assert.match(
    requestedUrl,
    /^https:\/\/places\.googleapis\.com\/v1\/places\/ChIJ-stroane-east-legon/
  );
  assert.match(requestedUrl, /regionCode=gh/);
  assert.match(requestedUrl, /sessionToken=session-123/);
  assert.equal(requestedOptions.headers["X-Goog-Api-Key"], "test-google-key");
  assert.match(requestedOptions.headers["X-Goog-FieldMask"], /formattedAddress/);
  assert.deepEqual(location, {
    id: "ChIJ-stroane-east-legon",
    placeId: "ChIJ-stroane-east-legon",
    label: "East Legon - East Legon, Accra, Ghana",
    address: "East Legon, Accra, Ghana",
    provider: "Google Maps",
    latitude: 5.6505,
    longitude: -0.1461,
    mapUrl: "https://www.google.com/maps/search/?api=1&query=5.6505%2C-0.1461",
  });
});

test("location search falls back to Nominatim when no Google Maps key is configured", async () => {
  delete process.env.GOOGLE_MAPS_API_KEY;
  delete process.env.GOOGLE_PLACES_API_KEY;
  delete process.env.STROANE_GOOGLE_MAPS_API_KEY;
  delete process.env.STROANE_LOCATION_SEARCH_PROVIDER;

  let requestedUrl = "";
  const fetchImpl = async (url) => {
    requestedUrl = String(url);
    return {
      ok: true,
      json: async () => [
        {
          place_id: "osm-accra",
          osm_type: "node",
          osm_id: "123",
          display_name: "Accra, Greater Accra Region, Ghana",
          lat: "5.6037",
          lon: "-0.1870",
        },
      ],
    };
  };

  const locations = await searchDeliveryLocations("Accra", { fetchImpl, limit: 2 });

  assert.match(requestedUrl, /^https:\/\/nominatim\.openstreetmap\.org\/search/);
  assert.match(requestedUrl, /countrycodes=gh/);
  assert.equal(locations[0].provider, "nominatim");
  assert.equal(locations[0].address, "Accra, Greater Accra Region, Ghana");
});

test("location search reports missing key when Google provider is forced", async () => {
  delete process.env.GOOGLE_MAPS_API_KEY;
  delete process.env.GOOGLE_PLACES_API_KEY;
  delete process.env.STROANE_GOOGLE_MAPS_API_KEY;
  process.env.STROANE_LOCATION_SEARCH_PROVIDER = "google";

  await assert.rejects(
    () =>
      searchDeliveryLocations("Accra", {
        fetchImpl: async () => {
          throw new Error("fetch should not be called without a Google key");
        },
      }),
    /Google Maps location search is not configured/
  );
});
