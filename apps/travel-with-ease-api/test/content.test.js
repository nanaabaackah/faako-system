import test from "node:test";
import assert from "node:assert/strict";
import {
  contentBodySchema,
  contentForPage,
  footprintCountryCodes,
  pageSchema,
  saveContentSchema,
} from "../src/content/schema.js";
import { readFileSync } from "node:fs";
import { createApp } from "../src/app.js";

test("CMS uses fixed page names, bounded fields and code-owned CTA destinations", () => {
  const body = {
    heading: "Synthetic heading",
    body: "Literal <script> text, never executable HTML",
    seoTitle: "Synthetic title",
    seoDescription: "Synthetic description",
  };
  assert.equal(contentBodySchema.parse(body).ctaPath, "/#plan");
  for (const extra of [
    { ctaPath: "javascript:alert(1)" },
    { ctaPath: "https://attacker.invalid" },
    { layout: "custom-script" },
    { imageId: "../../file" },
    { heading: "x".repeat(121) },
    { entries: [{ heading: "", text: "" }] },
    { contactEmail: "not-an-email" },
  ])
    assert.equal(
      contentBodySchema.safeParse({ ...body, ...extra }).success,
      false,
    );
  assert.equal(pageSchema.safeParse("arbitrary-layout").success, false);
  assert.equal(
    saveContentSchema.safeParse({ body, expectedVersion: -1 }).success,
    false,
  );
});

test("CMS cannot be mounted without staff session protection", () => {
  assert.throws(
    () => createApp({ contentRepository: {} }),
    /CMS requires staff sessions/,
  );
});

test("journal and map content validates public URLs, dates, unique records and page placement", () => {
  const base = {
    heading: "Heading",
    body: "",
    seoTitle: "Title",
    seoDescription: "Description",
  };
  const article = {
    slug: "travel-preparation",
    title: "Travel preparation",
    excerpt: "A short introduction",
    body: "Approved article text",
    date: "2026-10-30",
  };
  assert.equal(
    contentForPage("journal", { ...base, articles: [article] }).articles.length,
    1,
  );
  for (const extra of [{ slug: "../private" }, { date: "2026-02-30" }])
    assert.throws(() =>
      contentForPage("journal", {
        ...base,
        articles: [{ ...article, ...extra }],
      }),
    );
  assert.throws(() =>
    contentForPage("journal", { ...base, articles: [article, article] }),
  );
  assert.throws(() => contentForPage("home", { ...base, articles: [article] }));
  const row = { countryCode: "TZ", total: 4, status: "verified" };
  assert.equal(
    contentForPage("travel-footprint", { ...base, footprint: [row] })
      .footprint[0].total,
    4,
  );
  for (const extra of [
    { countryCode: "Zanzibar" },
    { total: -1 },
    { total: 1.5 },
    { status: "demo" },
  ])
    assert.throws(() =>
      contentForPage("travel-footprint", {
        ...base,
        footprint: [{ ...row, ...extra }],
      }),
    );
  assert.throws(() =>
    contentForPage("travel-footprint", { ...base, footprint: [row, row] }),
  );
  assert.throws(() => contentForPage("about", { ...base, footprint: [row] }));
  const countries = JSON.parse(
    readFileSync(
      new URL(
        "../../travel-with-ease-web/src/lib/footprint-countries.json",
        import.meta.url,
      ),
    ),
  );
  assert.deepEqual(
    [...footprintCountryCodes].sort(),
    countries.map((country) => country.code).sort(),
  );
});
