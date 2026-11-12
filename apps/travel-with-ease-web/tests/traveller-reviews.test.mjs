import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = relative => readFileSync(new URL(relative, import.meta.url), "utf8");
const home = read("../src/components/PublishedHome.astro");
const reviews = read("../src/components/TravellerReviews.astro");
const styles = read("../src/styles/components/traveller-reviews.css");

test("homepage places traveller reviews after its CTA and before the shared enquiry/footer", () => {
  assert.match(home, /import TravellerReviews from "\.\/TravellerReviews\.astro"/);
  assert.match(home, /<ClosingCta enquiryAvailable=\{Boolean\(contact\)\} \/>[\s\S]*?<TravellerReviews \/>/);
  assert.match(read("../src/pages/index.astro"), /<PublishedHome content=\{content\} \/>/);
  assert.match(read("../src/components/CinematicEnquiry.astro"), /<PublicFooter cinematic \/>/);
});

test("review section has exactly three anonymous first-hand testimonials with expanded originals", () => {
  assert.match(reviews, /What Travellers Say/);
  assert.match(reviews, /I had an exceptional experience with TWE/);
  assert.match(reviews, /Overall, I really enjoyed my Rwanda trip/);
  assert.match(reviews, /The Kenya Airways cancellation and long Nairobi layover/);
  assert.match(reviews, /One thing I would suggest is having fewer generic activities/);
  assert.match(reviews, /When I got my visa, I honestly didn't know where to start/);
  assert.match(reviews, /I will definitely use Travel with Ease again/);
  assert.match(reviews, /the four Instagram story frames form one continuous testimonial/);
  assert.match(reviews, /<details class="traveller-reviews__details">/);
  assert.match(reviews, /<summary>Read full review<\/summary>/);
  assert.doesNotMatch(reviews, /Client Love|CLIENT LOVE|Jennifer H|reviewerName|avatar|<img/);
  assert.doesNotMatch(reviews, /<a[^>]+href="\/reviews"/);
});

test("review navigation respects mobile scroll snapping and keeps the accessible dots functional", () => {
  assert.match(reviews, /aria-labelledby="traveller-reviews-heading"/);
  assert.match(reviews, /aria-label=\{`Show review \$\{index \+ 1\}\`\}/);
  assert.match(reviews, /track\.scrollTo/);
  assert.match(reviews, /aria-current/);
  assert.match(styles, /grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/);
  assert.match(styles, /scroll-snap-type: x mandatory/);
  assert.match(styles, /@media \(max-width: 600px\)/);
  assert.match(styles, /--brand-cream/);
  assert.match(styles, /--brand-navy/);
  assert.match(styles, /--twe-radius-card/);
  assert.doesNotMatch(styles, /box-shadow|linear-gradient|\.eyebrow/);
});
