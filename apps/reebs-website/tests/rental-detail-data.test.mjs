import assert from "node:assert/strict";
import test from "node:test";
import { findRentalDetail, normalizePublishedRental } from "../src/utils/rentalDetailData.js";

const published = normalizePublishedRental({
  id: 1257, slug: "bouncycastle-1257", name: "Published rental",
  category: "Bouncy Castles", availability: "check-date", price: 950,
});

test("an unrelated, non-empty inventory response retains the published rental detail", () => {
  const other = { id: 101, name: "Mini Bouncy Castle", page: "/rentals/mini-bouncy-castle" };
  assert.equal(findRentalDetail([other], published.slug, published), published);
  assert.equal(findRentalDetail([], published.slug, published), published);
});

test("matching live data takes precedence over published data", () => {
  const live = { ...published, price: 1000 };
  assert.equal(findRentalDetail([live], published.slug, published), live);
});

test("a published rental is never substituted for a different detail URL", () => {
  assert.equal(findRentalDetail([], "unknown-rental", published), null);
  assert.equal(findRentalDetail([], published.slug, null), null);
  assert.equal(findRentalDetail([], String(published.id), published), published);
});

test("published stock status is normalized without changing the catalogue source", () => {
  const source = { id: 1, availability: "out-of-stock", category: "Rentals", image: "/item.png" };
  const result = normalizePublishedRental(source);
  assert.equal(result.status, false);
  assert.equal(result.quantity, 0);
  assert.equal(result.imageUrl, source.image);
  assert.equal(result.specificCategory, source.category);
  assert.equal(source.quantity, undefined);
  assert.equal(normalizePublishedRental(null), null);
});
