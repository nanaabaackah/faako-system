import process from "node:process";
import {
  DEFAULT_CAD_TO_GHS_RATE,
  parseCadToGhsRate,
} from "../../shared/displayCurrency.js";
import {
  getDisplayCadToGhsRate,
  setDisplayCadToGhsRate,
} from "./displayCurrency.js";

const SOURCE_CURRENCY = "CAD";
const TARGET_CURRENCY = "GHS";
const DEFAULT_RATE_CACHE_TTL_MS = 60 * 60 * 1000;
const DEFAULT_CURRENCY_API_TIMEOUT_MS = 8000;

let rateCache = null;
let rateRequestPromise = null;

const parsePositiveInt = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : fallback;
};

const parsePositiveRate = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

const readPath = (source, path) => {
  const segments = String(path || "").split(".").filter(Boolean);
  let current = source;
  for (const segment of segments) {
    if (!current || typeof current !== "object" || !(segment in current)) return null;
    current = current[segment];
  }
  return current;
};

export const extractCadToGhsRate = (payload) => {
  const paths = [
    "cadToGhsRate",
    "cad_to_ghs",
    "CAD_GHS",
    "rate",
    "conversion_rate",
    "quotes.CADGHS",
    "rates.GHS",
    "rates.GHS.value",
    "conversion_rates.GHS",
    "data.GHS",
    "data.GHS.value",
    "data.GHS.rate",
    "result",
    "info.rate",
  ];

  for (const path of paths) {
    const rate = parsePositiveRate(readPath(payload, path));
    if (rate) return rate;
  }

  return null;
};

export const buildCurrencyApiUrl = (env = process.env) => {
  const rawUrl = String(env.CURRENCY_API_URL || "").trim();
  if (!rawUrl) return "";

  const apiKey = String(env.CURRENCY_API_KEY || "").trim();
  const replacements = {
    apiKey,
    key: apiKey,
    base: SOURCE_CURRENCY,
    from: SOURCE_CURRENCY,
    source: SOURCE_CURRENCY,
    target: TARGET_CURRENCY,
    to: TARGET_CURRENCY,
  };

  const replacedUrl = rawUrl.replace(/\{([a-zA-Z0-9_]+)\}/g, (_match, key) => replacements[key] ?? "");
  const apiKeyQueryParam = String(env.CURRENCY_API_KEY_QUERY_PARAM || "").trim();

  if (!apiKey || !apiKeyQueryParam) return replacedUrl;

  try {
    const parsedUrl = new URL(replacedUrl);
    if (!parsedUrl.searchParams.has(apiKeyQueryParam)) {
      parsedUrl.searchParams.set(apiKeyQueryParam, apiKey);
    }
    return parsedUrl.toString();
  } catch {
    return replacedUrl;
  }
};

const buildApiHeaders = (env = process.env) => {
  const headers = { Accept: "application/json" };
  const apiKey = String(env.CURRENCY_API_KEY || "").trim();
  if (!apiKey) return headers;

  const rawUrl = String(env.CURRENCY_API_URL || "");
  if (rawUrl.includes("{apiKey}") || rawUrl.includes("{key}")) return headers;

  const headerName = String(env.CURRENCY_API_KEY_HEADER ?? "apikey").trim();
  if (headerName) {
    headers[headerName] = apiKey;
  }

  return headers;
};

const buildRateSnapshot = ({ rate, source, fetchedAt, ttlMs, stale = false }) => ({
  base: SOURCE_CURRENCY,
  target: TARGET_CURRENCY,
  rate: parseCadToGhsRate(rate, DEFAULT_CAD_TO_GHS_RATE),
  source,
  stale,
  updatedAt: new Date(fetchedAt).toISOString(),
  expiresAt: new Date(fetchedAt + ttlMs).toISOString(),
});

export const fetchCadToGhsRateFromApi = async ({
  env = process.env,
  fetcher = globalThis.fetch,
} = {}) => {
  const url = buildCurrencyApiUrl(env);
  if (!url) return null;
  if (typeof fetcher !== "function") {
    throw new Error("Currency API fetch is unavailable in this runtime.");
  }

  const timeoutMs = parsePositiveInt(
    env.CURRENCY_API_TIMEOUT_MS,
    DEFAULT_CURRENCY_API_TIMEOUT_MS
  );
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetcher(url, {
      headers: buildApiHeaders(env),
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`Currency API returned HTTP ${response.status}`);
    }
    const payload = await response.json();
    const rate = extractCadToGhsRate(payload);
    if (!rate) {
      throw new Error("Currency API response did not include a CAD to GHS rate.");
    }
    return rate;
  } finally {
    clearTimeout(timeoutId);
  }
};

export const getDisplayCurrencyRateSnapshot = (env = process.env) => {
  const ttlMs = parsePositiveInt(env.CURRENCY_RATE_CACHE_TTL_MS, DEFAULT_RATE_CACHE_TTL_MS);
  if (rateCache) return rateCache;
  return buildRateSnapshot({
    rate: getDisplayCadToGhsRate(),
    source: "env",
    fetchedAt: Date.now(),
    ttlMs,
  });
};

export const refreshDisplayCurrencyRate = async ({
  force = false,
  env = process.env,
  fetcher = globalThis.fetch,
} = {}) => {
  const now = Date.now();
  const ttlMs = parsePositiveInt(env.CURRENCY_RATE_CACHE_TTL_MS, DEFAULT_RATE_CACHE_TTL_MS);

  if (!force && rateCache && new Date(rateCache.expiresAt).getTime() > now) {
    return rateCache;
  }

  if (rateRequestPromise) return rateRequestPromise;

  rateRequestPromise = (async () => {
    const fallbackRate = getDisplayCadToGhsRate();
    try {
      const apiRate = await fetchCadToGhsRateFromApi({ env, fetcher });
      if (!apiRate) {
        rateCache = buildRateSnapshot({
          rate: fallbackRate,
          source: "env",
          fetchedAt: now,
          ttlMs,
        });
        return rateCache;
      }

      setDisplayCadToGhsRate(apiRate);
      rateCache = buildRateSnapshot({
        rate: apiRate,
        source: "api",
        fetchedAt: now,
        ttlMs,
      });
      return rateCache;
    } catch (error) {
      console.warn("Currency API rate refresh failed", error?.message || error);
      if (rateCache) {
        rateCache = { ...rateCache, stale: true };
        return rateCache;
      }
      rateCache = buildRateSnapshot({
        rate: fallbackRate,
        source: "env",
        fetchedAt: now,
        ttlMs,
        stale: true,
      });
      return rateCache;
    } finally {
      rateRequestPromise = null;
    }
  })();

  return rateRequestPromise;
};
