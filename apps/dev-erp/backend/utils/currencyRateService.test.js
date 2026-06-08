import assert from "node:assert/strict";
import test from "node:test";

import {
  buildCurrencyApiUrl,
  extractCadToGhsRate,
  fetchCadToGhsRateFromApi,
} from "./currencyRateService.js";

test("extractCadToGhsRate handles common provider response shapes", () => {
  assert.equal(extractCadToGhsRate({ conversion_rates: { GHS: 8.2 } }), 8.2);
  assert.equal(extractCadToGhsRate({ rates: { GHS: 8.3 } }), 8.3);
  assert.equal(extractCadToGhsRate({ data: { GHS: { value: 8.4 } } }), 8.4);
  assert.equal(extractCadToGhsRate({ quotes: { CADGHS: 8.5 } }), 8.5);
  assert.equal(extractCadToGhsRate({ conversion_rate: 8.6 }), 8.6);
  assert.equal(extractCadToGhsRate({ result: "success" }), null);
});

test("buildCurrencyApiUrl expands placeholders and optional key query param", () => {
  assert.equal(
    buildCurrencyApiUrl({
      CURRENCY_API_URL: "https://example.test/latest?base={base}&symbols={target}&token={apiKey}",
      CURRENCY_API_KEY: "secret-key",
    }),
    "https://example.test/latest?base=CAD&symbols=GHS&token=secret-key"
  );

  assert.equal(
    buildCurrencyApiUrl({
      CURRENCY_API_URL: "https://example.test/latest?base={from}&symbols={to}",
      CURRENCY_API_KEY: "secret-key",
      CURRENCY_API_KEY_QUERY_PARAM: "access_key",
    }),
    "https://example.test/latest?base=CAD&symbols=GHS&access_key=secret-key"
  );
});

test("fetchCadToGhsRateFromApi returns the parsed provider rate", async () => {
  const calls = [];
  const fetcher = async (url, options) => {
    calls.push({ url, options });
    return {
      ok: true,
      status: 200,
      async json() {
        return { data: { GHS: { value: 8.75 } } };
      },
    };
  };

  const rate = await fetchCadToGhsRateFromApi({
    env: {
      CURRENCY_API_URL: "https://example.test/rates?base={base}&target={target}",
      CURRENCY_API_KEY: "secret-key",
      CURRENCY_API_KEY_HEADER: "x-api-key",
    },
    fetcher,
  });

  assert.equal(rate, 8.75);
  assert.equal(calls[0].url, "https://example.test/rates?base=CAD&target=GHS");
  assert.equal(calls[0].options.headers["x-api-key"], "secret-key");
});
