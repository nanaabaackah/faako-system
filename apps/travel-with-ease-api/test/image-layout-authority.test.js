import test from "node:test";
import assert from "node:assert/strict";
import { assertImageLayoutAuthority } from "../src/content/image-layout-authority.js";

const owner = { role: "owner" };
const editor = { role: "editor" };
const admin = { role: "platform_admin" };
const img = "40000000-0000-4000-8000-000000000001";
const other = "40000000-0000-4000-8000-000000000002";
const old = {
  imagePlacements: { hero: { imageId: img, focalX: 20, focalY: 45, layout: "default", alt: "Before" } },
  entries: [{ id: img, heading: "Service", text: "Details",
    imagePlacement: { imageId: img, focalX: 33, alt: "Before" } }],
};
test("Owners and Editors can replace images and alt text without changing technical layouts", () => {
  const next = structuredClone(old);
  next.imagePlacements.hero.imageId = other;
  next.imagePlacements.hero.alt = "After";
  next.entries[0].imagePlacement.imageId = other;
  next.entries[0].imagePlacement.alt = "After";
  assert.doesNotThrow(() => assertImageLayoutAuthority(old, next, owner));
  assert.doesNotThrow(() => assertImageLayoutAuthority(old, next, editor));
});
test("Only Superadmin can change focal points or layout through direct API writes", () => {
  const hero = structuredClone(old);
  hero.imagePlacements.hero.focalX = 75;
  assert.throws(() => assertImageLayoutAuthority(old, hero, owner), /Only Superadmin/);
  const record = structuredClone(old);
  record.entries[0].imagePlacement.focalX = 75;
  assert.throws(() => assertImageLayoutAuthority(old, record, editor), /Only Superadmin/);
  const layout = structuredClone(old);
  layout.imagePlacements.hero.layout = "left";
  assert.throws(() => assertImageLayoutAuthority(old, layout, owner), /Only Superadmin/);
  assert.doesNotThrow(() => assertImageLayoutAuthority(old, hero, admin));
  assert.doesNotThrow(() => assertImageLayoutAuthority(old, record, admin));
});
test("Removing a custom placement is also reserved for Superadmin", () => {
  const next = structuredClone(old);
  delete next.imagePlacements.hero;
  assert.throws(() => assertImageLayoutAuthority(old, next, owner), /Only Superadmin/);
  assert.doesNotThrow(() => assertImageLayoutAuthority(old, next, admin));
});
