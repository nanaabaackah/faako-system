// Display only. Authoritative enquiry quotes are resolved server-side.
export function formatGhsMinor(value) {
  if (!Number.isSafeInteger(value) || value <= 0) return null;
  const whole = Math.floor(value / 100).toLocaleString("en-GH");
  const cents = value % 100;
  return `GHS ${whole}${cents ? "." + String(cents).padStart(2, "0") : ""}`;
}
export function packageStartingPrice(item) {
  if (item.pricingStatus !== "indicative") return "Price coming soon";
  const amounts = (item.tiers || []).map(tier => tier.amountMinor).filter(value => Number.isSafeInteger(value) && value > 0);
  return amounts.length ? `From ${formatGhsMinor(Math.min(...amounts))}` : "Price coming soon";
}
export function referenceMonthLabel(value) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(value || "")) return "";
  return new Intl.DateTimeFormat("en-GH", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(value + "-01T00:00:00Z"));
}
