export class ExchangeRateProvider {
  async getLatestRate(_baseCurrency, _quoteCurrency) { throw new Error("Not implemented"); }
  async convertCurrency(_amountMinor, _baseCurrency, _quoteCurrency) { throw new Error("Not implemented"); }
  async getSupportedCurrencies() { throw new Error("Not implemented"); }
  async getHistoricalRate(_baseCurrency, _quoteCurrency, _date) { throw new Error("Not implemented"); }
  async getLastUpdated() { throw new Error("Not implemented"); }
}

import { convertMinorUnits } from "../domain/money.js";

const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

export class ExchangeRateApiProvider extends ExchangeRateProvider {
  constructor({ baseUrl = "https://open.er-api.com/v6/latest", apiKey = "", timeoutMs = 5000, retries = 1, fetchImpl = fetch } = {}) {
    super();
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.apiKey = apiKey;
    this.timeoutMs = timeoutMs;
    this.retries = retries;
    this.fetchImpl = fetchImpl;
    this.lastUpdated = null;
  }

  async request(baseCurrency) {
    const suffix = this.apiKey ? `/${encodeURIComponent(this.apiKey)}` : "";
    const url = `${this.baseUrl}${suffix}/${encodeURIComponent(baseCurrency)}`;
    let lastError;
    for (let attempt = 0; attempt <= this.retries; attempt += 1) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
      try {
        const response = await this.fetchImpl(url, { signal: controller.signal, headers: { accept: "application/json" } });
        if (!response.ok) throw new Error(`Exchange-rate provider returned ${response.status}.`);
        const payload = await response.json();
        if (payload.result && payload.result !== "success") throw new Error("Exchange-rate provider rejected the request.");
        if (!payload.rates || typeof payload.rates !== "object") throw new Error("Exchange-rate provider response is invalid.");
        this.lastUpdated = payload.time_last_update_utc || new Date().toISOString();
        return payload;
      } catch (error) {
        lastError = error;
        if (attempt < this.retries) await wait(100 * (attempt + 1));
      } finally {
        clearTimeout(timeout);
      }
    }
    throw lastError;
  }

  async getLatestRate(baseCurrency, quoteCurrency) {
    if (baseCurrency === quoteCurrency) return { rate: "1", providerTimestamp: new Date().toISOString() };
    const payload = await this.request(baseCurrency);
    const rawRate = payload.rates[quoteCurrency];
    if (typeof rawRate !== "number" && typeof rawRate !== "string") throw new Error(`Provider does not support ${quoteCurrency}.`);
    const rate = String(rawRate);
    if (!/^\d+(?:\.\d+)?$/.test(rate) || rate === "0") throw new Error("Provider returned an invalid rate.");
    return { rate, providerTimestamp: this.lastUpdated, provider: "exchange-rate-api" };
  }

  async convertCurrency(amountMinor, baseCurrency, quoteCurrency) {
    const result = await this.getLatestRate(baseCurrency, quoteCurrency);
    return { ...result, amountMinor: String(convertMinorUnits(amountMinor, result.rate)), currency: quoteCurrency };
  }

  async getSupportedCurrencies() {
    const payload = await this.request("USD");
    return Object.keys(payload.rates).sort();
  }

  async getHistoricalRate() {
    throw new Error("Historical rates are not available from this adapter.");
  }

  async getLastUpdated() { return this.lastUpdated; }
}
