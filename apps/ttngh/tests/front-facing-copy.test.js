import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = (path) => readFileSync(new URL(`../src/${path}`, import.meta.url), "utf8");

test("public templates do not show internal publication or editorial-status instructions", () => {
  for (const [path, unwanted] of [
    ["pages/index.astro", /Approved news and reviewed educational resources will appear/],
    ["pages/news.astro", /The first approved publications will appear|This space will bring together/],
    ["pages/resources.astro", /once approved by the team|Read with the context behind the guidance/],
    ["pages/gallery.astro", /Approved photographs will appear here/],
    ["pages/cms.astro", /Approved editors only|Sign-in and account recovery are handled securely/],
    ["pages/contact.astro", /Enquire with the TTNGH team/],
    ["components/SiteSearch.astro", /Explore TTN GH/],
    ["components/ScrollExpandSection.astro", /Scroll to open/],
  ]) {
    assert.doesNotMatch(source(path), unwanted, path);
  }
});

test("donation prompts stay accurate while donation payment details remain unverified", () => {
  const cta = source("components/ScrollExpandSection.astro");
  const donation = source("pages/support-us.astro");
  assert.match(cta, /linkLabel = "Support our work"/);
  assert.doesNotMatch(cta, /linkLabel = "Donate"/);
  assert.match(donation, /linkLabel="Ask about giving"/);
  assert.match(donation, /Contact TTNGH before sending funds/);
  for (const name of ["index","about","events","news","resources","programmes","team","impact","get-involved"]) {
    assert.doesNotMatch(source(`pages/${name}.astro`), / text="Donate to support/);
  }
});

test("contact form retains consent and safeguarding while using Faako visual tokens", () => {
  const form = source("components/ContactForm.astro");
  const css = source("styles/components/contact-form.css");
  const field = source("components/SiteSearch.astro");
  assert.match(form, /name="consent" type="checkbox" required/);
  assert.match(form, /privacy notice/);
  assert.match(form, /avoid medical records or sensitive health details/);
  assert.match(form, /class="contact-form-select-wrap"/);
  assert.match(css, /var\(--sys-border-strong\)/);
  assert.match(css, /appearance: none/);
  assert.match(field, /class="site-search-label"/);
  assert.match(source("styles/components/site-search.css"), /clip-path: inset\(50%\)/);
});

test("Faako shared icon and reduced-motion calendar support remain", () => {
  assert.match(source("components/Icon.jsx"), /import \{ ArrowRight4 \} from "@faako\/ui"/);
  assert.match(source("components/MonthCalendar.astro"), /month-calendar-sr-only/);
  assert.match(source("styles/components/month-calendar.css"), /prefers-reduced-motion/);
  assert.match(source("components/ScrollExpandSection.astro"), /prefers-reduced-motion/);
});
