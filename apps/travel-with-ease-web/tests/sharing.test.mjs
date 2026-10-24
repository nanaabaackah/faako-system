import test from "node:test";
import assert from "node:assert/strict";
import { sharingMetadata } from "../src/lib/sharing.js";

test("default and country sharing URLs use the configured public origin", () => {
  for (const name of ["default", "kenya", "zanzibar"]) {
    const result = sharingMetadata({ site: "https://travelwitheasegh.com", image: `/og/${name}.jpg`, imageAlt: `Reviewed ${name} card` });
    assert.equal(result.image, `https://travelwitheasegh.com/og/${name}.jpg`);
    assert.equal(result.width, 1200); assert.equal(result.height, 630);
  }
});
test("sharing metadata rejects remote/private URLs, query strings and empty alt text", () => {
  for (const image of ["https://drive.google.com/private.jpg", "//evil.invalid/x.jpg", "/x.jpg?token=private", "/x.svg", "/\\evil.invalid/x.jpg"]) {
    assert.throws(() => sharingMetadata({ site: "https://travelwitheasegh.com", image }));
  }
  assert.throws(() => sharingMetadata({ site: "https://travelwitheasegh.com", imageAlt: "" }));
});
