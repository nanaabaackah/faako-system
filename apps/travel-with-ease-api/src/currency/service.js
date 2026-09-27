import { convertMinorUnits } from "../domain/money.js";

export class CurrencyService {
  constructor({ provider, supportedCurrencies = ["GHS", "USD", "EUR", "GBP", "CAD", "AED", "TRY", "ZAR"], ttlMs = 21_600_000, now = () => new Date() }) {
    this.provider = provider;
    this.ttlMs = ttlMs;
    this.now = now;
    this.supportedCurrencies = [...new Set(supportedCurrencies)];
    this.cache = new Map();
  }

  async getLatestRate(baseCurrency, quoteCurrency) {
    const key = `${baseCurrency}:${quoteCurrency}`;
    const cached = this.cache.get(key);
    const nowMs = this.now().getTime();
    if (cached && cached.expiresAt > nowMs) return { ...cached.value, cached: true, stale: false };
    try {
      const value = await this.provider.getLatestRate(baseCurrency, quoteCurrency);
      const record = { ...value, baseCurrency, quoteCurrency, retrievedAt: this.now().toISOString() };
      this.cache.set(key, { value: record, expiresAt: nowMs + this.ttlMs });
      return { ...record, cached: false, stale: false };
    } catch (error) {
      if (cached) return { ...cached.value, cached: true, stale: true };
      throw error;
    }
  }

  async convertCurrency(amountMinor, originalCurrency, convertedCurrency = "GHS") {
    const rate = await this.getLatestRate(originalCurrency, convertedCurrency);
    return {
      originalAmountMinor: String(amountMinor),
      originalCurrency,
      exchangeRate: rate.rate,
      convertedAmountMinor: String(convertMinorUnits(amountMinor, rate.rate)),
      convertedCurrency,
      rateTimestamp: rate.providerTimestamp,
      cached: rate.cached,
      stale: rate.stale,
      provider: rate.provider,
    };
  }

  getSupportedCurrencies() { return [...this.supportedCurrencies]; }
  getHistoricalRate(baseCurrency, quoteCurrency, date) { return this.provider.getHistoricalRate(baseCurrency, quoteCurrency, date); }
  getLastUpdated() { return this.provider.getLastUpdated(); }
}
