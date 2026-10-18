import assert from "node:assert/strict";
import test from "node:test";
import {
  absoluteDiscoveryUrl,
  buildBreadcrumbList,
  buildFaqPage,
  buildRobotsText,
  canonicalUrl,
  normalizeDiscoveryPath,
  serializeJsonLd,
  validateDiscoveryPage,
} from "../src/index.js";

test("normalizes routes and creates query-free canonical URLs", () => {
  assert.equal(normalizeDiscoveryPath("solutions/?utm_source=test#top"), "/solutions");
  assert.equal(canonicalUrl("/solutions/?q=1", "https://example.com/subpath"), "https://example.com/solutions");
  assert.equal(absoluteDiscoveryUrl("/social.png", "https://example.com"), "https://example.com/social.png");
});

test("serializes JSON-LD without allowing a script closing tag", () => {
  const output = serializeJsonLd({ value: "</script><script>alert(1)</script>" });
  assert.ok(!output.includes("<"));
  assert.match(output, /\\u003c\/script\\u003e/);
});

test("builds exact FAQ and breadcrumb schema without adding claims", () => {
  const faq = buildFaqPage([{ question: "Where?", answer: "Ghana." }]);
  const breadcrumbs = buildBreadcrumbList(
    [{ name: "Home", path: "/" }, { name: "Services", path: "/services" }],
    "https://example.com",
  );
  assert.equal(faq.mainEntity[0].acceptedAnswer.text, "Ghana.");
  assert.equal(breadcrumbs.itemListElement[1].item, "https://example.com/services");
});

test("robots output fails closed and excludes configured public routes", () => {
  assert.equal(buildRobotsText(), "User-agent: *\nDisallow: /\n");
  assert.equal(
    buildRobotsText({ indexable: true, sitemapUrl: "https://example.com/sitemap.xml", disallow: ["/checkout/"] }),
    "User-agent: *\nAllow: /\nDisallow: /checkout\n\nSitemap: https://example.com/sitemap.xml\n",
  );
});

test("validates the minimum discovery page contract", () => {
  assert.deepEqual(
    validateDiscoveryPage({
      title: "Services",
      description: "A useful summary.",
      canonical: "https://example.com/services",
      h1Count: 1,
      indexable: true,
      noIndex: false,
      status: 200,
    }),
    { valid: true, errors: [] },
  );
  const invalid = validateDiscoveryPage({ canonical: "/relative", h1Count: 2, indexable: true, status: 404 });
  assert.equal(invalid.valid, false);
  assert.ok(invalid.errors.includes("indexable page must return status 200"));
});
