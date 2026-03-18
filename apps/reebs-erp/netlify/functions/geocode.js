/* eslint-disable no-undef */
// Filename: geocode.js
// Server-side geocoding proxy for map pins (avoids browser CORS issues).

import "../../runtimeEnv.js";
import https from "https";

const json = (statusCode, body, extraHeaders = {}) => ({
  statusCode,
  headers: {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    ...extraHeaders,
  },
  body: JSON.stringify(body),
});

export async function handler(event) {
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "POST,OPTIONS",
      },
      body: "",
    };
  }

  if (event.httpMethod !== "POST") {
    return json(405, { error: "Method Not Allowed" }, { "Access-Control-Allow-Methods": "POST,OPTIONS" });
  }

  let data;
  try {
    data = JSON.parse(event.body || "{}");
  } catch {
    return json(400, { error: "Invalid JSON body." });
  }

  const address = typeof data.address === "string" ? data.address.trim() : "";
  if (!address) return json(400, { error: "Address is required." });

  try {
    const referer =
      event.headers?.origin ||
      (event.headers?.host ? `https://${event.headers.host}` : "https://reebs.app");
    const normalize = (value) => String(value || "").toLowerCase();
    const compact = (value) => String(value || "").replace(/\s+/g, " ").trim();
    const raw = compact(address);
    const googleApiKey =
      process.env.GOOGLE_MAPS_API_KEY ||
      process.env.GOOGLE_GEOCODING_API_KEY ||
      process.env.GOOGLE_API_KEY ||
      "";

    const dropHints = (segment) => {
      const trimmed = compact(segment);
      if (!trimmed) return "";
      return trimmed
        .replace(/^\s*(near|opposite|behind|beside|by|close to|around)\b[:\-\s]*/i, "")
        .replace(/\b(near|opposite|behind|beside|by|close to|around)\b.*$/i, "")
        .trim();
    };

    const parts = raw
      .split(",")
      .map((part) => dropHints(part))
      .map((part) => part.trim())
      .filter(Boolean);

    const includesGhana = normalize(raw).includes("ghana");
    const includesAccra = normalize(raw).includes("accra");

    const buildCandidate = (segments) => {
      const joined = segments.join(", ");
      if (!normalize(joined).includes("ghana")) return `${joined}, Ghana`;
      return joined;
    };

    const candidates = [];
    candidates.push(buildCandidate([raw]));
    if (parts.length) candidates.push(buildCandidate(parts));

    for (let take = Math.min(parts.length, 6); take >= 2; take -= 1) {
      candidates.push(buildCandidate(parts.slice(-take)));
    }

    if (!includesAccra) {
      candidates.push(`${raw}, Accra, Ghana`);
      if (parts.length) candidates.push(`${parts.join(", ")}, Accra, Ghana`);
    }

    const seen = new Set();
    const orderedCandidates = candidates
      .map(compact)
      .filter(Boolean)
      .filter((cand) => {
        const key = cand.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

    const tried = [];
    let lastStatus = null;
    let googleStatus = null;

    const getJson = (url, headers) =>
      new Promise((resolve, reject) => {
        const request = https.request(
          url,
          {
            method: "GET",
            headers,
          },
          (response) => {
            const chunks = [];
            response.on("data", (chunk) => chunks.push(chunk));
            response.on("end", () => {
              const body = Buffer.concat(chunks).toString("utf8");
              resolve({
                statusCode: response.statusCode,
                body,
              });
            });
          }
        );
        request.on("error", reject);
        request.end();
      });

    const attempt = async (candidate, options = { country: true }) => {
      tried.push(candidate + (options.country ? " (GH)" : " (ANY)"));
      const countryParam = options.country ? "&countrycodes=gh" : "";
      const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=10&accept-language=en${countryParam}&q=${encodeURIComponent(candidate)}`;
      const response = await getJson(url, {
        Accept: "application/json",
        "User-Agent": "reebs-admin/1.0 (contact: admin@reebs.com)",
        Referer: referer,
      });

      if (!response.statusCode || response.statusCode < 200 || response.statusCode > 299) {
        lastStatus = response.statusCode || null;
        return null;
      }

      let payload;
      try {
        payload = JSON.parse(response.body);
      } catch {
        return null;
      }
      const hit = Array.isArray(payload) ? payload[0] : null;
      if (!hit) return null;

      const lat = Number(hit.lat);
      const lng = Number(hit.lon);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

      return { lat, lng };
    };

    for (const candidate of orderedCandidates) {
      // eslint-disable-next-line no-await-in-loop
      const coords = await attempt(candidate, { country: true });
      if (coords) return json(200, { ...coords, query: candidate, provider: "nominatim", status: "OK" });
    }

    for (const candidate of orderedCandidates) {
      // eslint-disable-next-line no-await-in-loop
      const coords = await attempt(candidate, { country: false });
      if (coords) return json(200, { ...coords, query: candidate, provider: "nominatim", status: "OK" });
    }

    const attemptGoogle = async (candidate, options = { country: true }) => {
      if (!googleApiKey) return null;
      const components = options.country ? "&components=country:GH" : "";
      const region = "&region=gh";
      const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
        candidate
      )}${region}${components}&key=${encodeURIComponent(googleApiKey)}`;
      const response = await getJson(url, {
        Accept: "application/json",
        Referer: referer,
      });

      if (!response.statusCode || response.statusCode < 200 || response.statusCode > 299) {
        googleStatus = `HTTP_${response.statusCode || "ERR"}`;
        return null;
      }

      let payload;
      try {
        payload = JSON.parse(response.body);
      } catch {
        googleStatus = "BAD_JSON";
        return null;
      }

      const status = typeof payload?.status === "string" ? payload.status : "UNKNOWN";
      googleStatus = status;
      if (status !== "OK") return null;

      const hit = Array.isArray(payload?.results) ? payload.results[0] : null;
      const lat = Number(hit?.geometry?.location?.lat);
      const lng = Number(hit?.geometry?.location?.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        googleStatus = "NO_LOCATION";
        return null;
      }

      return { lat, lng };
    };

    for (const candidate of orderedCandidates) {
      // eslint-disable-next-line no-await-in-loop
      const coords = await attemptGoogle(candidate, { country: true });
      if (coords) return json(200, { ...coords, query: candidate, provider: "google", status: "OK" });
    }

    for (const candidate of orderedCandidates) {
      // eslint-disable-next-line no-await-in-loop
      const coords = await attemptGoogle(candidate, { country: false });
      if (coords) return json(200, { ...coords, query: candidate, provider: "google", status: "OK" });
    }

    const provider = googleApiKey ? "google" : "nominatim";
    const status = googleApiKey ? googleStatus || "ZERO_RESULTS" : lastStatus ? `HTTP_${lastStatus}` : "ZERO_RESULTS";
    return json(200, { lat: null, lng: null, tried, lastStatus, provider, status });
  } catch (err) {
    console.error("Geocode error:", err);
    return json(500, { error: "Geocode error", details: err?.message || String(err) });
  }
}
