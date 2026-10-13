import test from "node:test";
import assert from "node:assert/strict";
import { contentBodySchema, pageSchema, saveContentSchema } from "../src/content/schema.js";
import { createApp } from "../src/app.js";

test("CMS uses fixed page names, bounded fields and code-owned CTA destinations", () => {
  const body = { heading: "Synthetic heading", body: "Literal <script> text, never executable HTML", seoTitle: "Synthetic title", seoDescription: "Synthetic description" };
  assert.equal(contentBodySchema.parse(body).ctaPath, "/#plan");
  for (const extra of [
    { ctaPath: "javascript:alert(1)" }, { ctaPath: "https://attacker.invalid" },
    { layout: "custom-script" }, { imageId: "../../file" }, { heading: "x".repeat(121) },
    { entries: [{ heading: "", text: "" }] }, { contactEmail: "not-an-email" },
  ]) assert.equal(contentBodySchema.safeParse({ ...body, ...extra }).success, false);
  assert.equal(pageSchema.safeParse("arbitrary-layout").success, false);
  assert.equal(saveContentSchema.safeParse({ body, expectedVersion: -1 }).success, false);
});

test("CMS cannot be mounted without staff session protection", () => {
  assert.throws(() => createApp({ contentRepository: {} }), /CMS requires staff sessions/);
});
