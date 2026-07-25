import assert from "node:assert/strict";
import test from "node:test";
import { serializeJsonLd } from "./serializeJsonLd.js";

test("serializeJsonLd neutralizes script-closing and HTML-significant characters", () => {
  const schema = {
    malicious: "</script><script>alert(1)</script>",
    symbols: "<product> & company",
  };
  const serialized = serializeJsonLd(schema);

  assert.equal(serialized.includes("<"), false);
  assert.equal(serialized.includes(">"), false);
  assert.equal(serialized.includes("&"), false);
  assert.equal(serialized.toLowerCase().includes("</script"), false);
  assert.deepEqual(JSON.parse(serialized), schema);
});

test("serializeJsonLd escapes Unicode line and paragraph separators", () => {
  const schema = { description: `line\u2028separator\u2029paragraph` };
  const serialized = serializeJsonLd(schema);

  assert.equal(serialized.includes("\u2028"), false);
  assert.equal(serialized.includes("\u2029"), false);
  assert.match(serialized, /\\u2028/);
  assert.match(serialized, /\\u2029/);
  assert.deepEqual(JSON.parse(serialized), schema);
});

test("serializeJsonLd preserves normal product structured data semantics", () => {
  const productSchema = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: "Executive desk",
    offers: { "@type": "Offer", price: 1200, priceCurrency: "GHS" },
  };

  assert.deepEqual(JSON.parse(serializeJsonLd(productSchema)), productSchema);
});
