export class EstimatorService {
  constructor({ currencyService, configuration }) { this.currencyService = currencyService; this.configuration = configuration; }

  async estimate(input) {
    const travellers = BigInt(input.travellers);
    const nights = BigInt(input.nights);
    const accommodation = this.configuration.accommodation[input.accommodation].map(BigInt);
    const style = this.configuration.tripStyle[input.tripStyle].map(BigInt);
    const flight = this.configuration.flightPreference[input.flightPreference].map(BigInt);
    const activityFactor = BigInt(this.configuration.activities[input.activities]);
    const lowUsdMinor = (flight[0] * travellers + accommodation[0] * nights + style[0] * nights * travellers + activityFactor * travellers) * 100n;
    const highUsdMinor = (flight[1] * travellers + accommodation[1] * nights + style[1] * nights * travellers + activityFactor * travellers * 2n) * 100n;
    const [low, high] = await Promise.all([
      this.currencyService.convertCurrency(lowUsdMinor, "USD", "GHS"),
      this.currencyService.convertCurrency(highUsdMinor, "USD", "GHS"),
    ]);
    return {
      currency: "GHS",
      lowMinor: low.convertedAmountMinor,
      highMinor: high.convertedAmountMinor,
      rate: low.exchangeRate,
      rateTimestamp: low.rateTimestamp,
      stale: low.stale || high.stale,
      disclaimer: "Estimated prices are provided as a guide and may change due to availability, exchange rates, travel dates and supplier pricing.",
    };
  }
}
