// Actual Astro templates and Faako controls; synthetic local content only.
import { createRequire } from "node:module";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
const require = createRequire(new URL("../../stroane-web/package.json", import.meta.url));
const { chromium, expect } = require("@playwright/test");
const cwd = fileURLToPath(new URL("../", import.meta.url));
const output = await mkdtemp(path.join(tmpdir(), "twe-collections-"));
const origin = process.env.TWE_TEST_WEB_ORIGIN || "http://127.0.0.1:4361";
assert.equal(new URL(origin).hostname, "127.0.0.1");
let server, browser, logs = "";
try {
  if (!process.env.TWE_TEST_WEB_ORIGIN) {
    server = spawn(process.execPath, ["--input-type=module", "-e", 'import { dev } from "astro"; await dev({ root: process.cwd(), server: { host: "127.0.0.1", port: 4361 }, devToolbar: { enabled: false } });'], {
      cwd, detached: true, env: { ...process.env, PUBLIC_APP_ENV: "development", TWE_CONTENT_SNAPSHOT: "", ASTRO_TELEMETRY_DISABLED: "1" }, stdio: ["ignore", "pipe", "pipe"],
    });
    server.stdout.on("data", chunk => { logs += chunk; });
    server.stderr.on("data", chunk => { logs += chunk; });
  }
  for (let i = 0; i < 60; i++) {
    try { if ((await fetch(origin)).ok) break; } catch { /* owned server starting */ }
    if (i === 59) throw new Error(logs.slice(-2000));
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } : {}) });
  for (const width of [320, 390, 768, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: "reduce", hasTouch: width < 768 });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.route("**/*", route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
    await page.goto(origin + "/packages", { waitUntil: "networkidle" });
    const publicConsent = page.getByRole("button", { name: "Essential only", exact: true });
    if (await publicConsent.isVisible()) await publicConsent.click();
    await page.getByRole("status").filter({ hasText: "4 entries shown" }).waitFor();
    assert.equal(await page.locator("[data-collection-item]").count(), 4);
    const tickets = page.locator("[data-collection-item] .twe-package-ticket");
    assert.equal(await tickets.count(), 4, "All published packages render as tickets");
    assert.equal(await tickets.locator(".tilted-card__img").count(), 4,
      "Each package retains its approved photograph");
    assert.equal(await tickets.locator(".twe-ticket__barcode").count(), 4,
      "Each package has the ticket stub design");
    assert.equal(await tickets.locator(".twe-ticket--front h2 a").count(), 4,
      "All ticket fronts expose direct native package links");
    const fieldStyle = await page.getByRole("button", { name: "Destination", exact: true }).evaluate(element => {
      const style = getComputedStyle(element);
      return { border: parseFloat(style.borderTopWidth), font: parseFloat(style.fontSize) };
    });
    assert.ok(fieldStyle.border >= 1);
    assert.ok(fieldStyle.font >= 16);
    assert.equal(await page.locator(".closing-scene").count(), 1);
    assert.equal(await page.locator(".cinematic-enquiry").count(), 1);
    assert.equal(await page.locator("footer.twe-public-footer").count(), 1);
    assert.equal(await page.locator(".closing-scene__image").evaluate(element => getComputedStyle(element).objectFit),
      "cover");
    assert.equal(await page.locator(".closing-scene__image").evaluate(element=>getComputedStyle(element).objectPosition),width<=760?'50% 50%':'50% 60%','Approved responsive footer crop remains the default');
    await page.getByRole("button", { name: "Occasion", exact: true }).click();
    await page.getByRole("option", { name: "Family", exact: true }).click();
    await page.getByText("No entries match. Clear the filters to see everything.", { exact: true }).waitFor();
    await page.getByRole("button", { name: "Occasion", exact: true }).click();
    await page.getByRole("option", { name: "All occasions", exact: true }).click();
    await page.getByRole("status").filter({ hasText: "4 entries shown" }).waitFor();
    await page.screenshot({ path: path.join(output, `approved-packages-${width}.png`), fullPage: true });
    const firstTicket = tickets.first().locator(".tilted-card");
    await firstTicket.locator(".twe-ticket--front .twe-ticket__flip").click();
    await expect(firstTicket).toHaveAttribute("data-flipped", "");
    await expect(firstTicket.locator(".twe-ticket--back .twe-ticket__description")).toContainText("Zanzibar");
    await firstTicket.locator(".twe-ticket--back .twe-ticket__flip").click();
    await expect(firstTicket).not.toHaveAttribute("data-flipped");
    await firstTicket.locator(".twe-ticket--front h2 a").click();
    await page.waitForURL("**/packages/zanzibar");
    await page.getByRole("heading", { name: "Zanzibar", exact: true }).waitFor();
    // Package detail now has the approved static day-by-day content inside
    // a semantic React Bits AnimatedList, rather than accordion disclosures.
    const itinerary = page.locator(".twe-package-itinerary [role=list]");
    await itinerary.scrollIntoViewIfNeeded();
    assert.equal(await itinerary.locator('[role="listitem"]').count(), 6);
    await expect(itinerary).toContainText("Arrive on the north coast");
    await expect(itinerary).toContainText("Homeward");
    await page.waitForFunction(() => {
      const island = document.querySelector("#package-itinerary astro-island");
      return Boolean(island && !island.hasAttribute("ssr"));
    }, null, { timeout: 20000 });
    const daysViewport = itinerary; // role=list is AnimatedList's scroll viewport
    await expect(daysViewport).toHaveCSS("overflow-y", "auto");
    assert.equal(await daysViewport.evaluate(el => el.scrollHeight > el.clientHeight), true,
      "The published itinerary has a dedicated scroll window for the fade reveal");
    await daysViewport.evaluate(el => { el.scrollTop = el.scrollHeight; });
    await expect(itinerary.locator('[role="listitem"]').last()).toHaveAttribute("data-state", "in");
    // Masonry hydrates after its island becomes visible; its SSR gallery links
    // remain readable and clickable while the layout and images load.
    const gallery = page.locator(".twe-package-gallery");
    await gallery.locator("astro-island").scrollIntoViewIfNeeded();
    const firstPhoto = gallery.locator(".masonry__item [data-card]").first();
    await firstPhoto.waitFor({ state: "visible", timeout: 20000 });
    assert.equal(await gallery.locator(".masonry__item").count(), 3);
    await firstPhoto.click();
    const lightbox = page.locator(".masonry-lightbox[role=dialog]");
    await lightbox.waitFor();
    await expect(lightbox.locator("[data-box-image]")).toHaveAttribute(
      "src", "/media/zanzibar-beach-club-b60ec1e6297a-1280.webp"
    );
    await page.keyboard.press("ArrowRight");
    await expect(lightbox.locator("[data-box-image]")).toHaveAttribute(
      "src", "/media/zanzibar-pool-da78a2948608-1242.webp"
    );
    await page.keyboard.press("Escape");
    await lightbox.waitFor({ state: "detached" });
    await expect(firstPhoto).toBeFocused();
    await page.getByText("Reference month: June 2027", { exact: true }).waitFor();
    const quoteLinks = page.getByRole("link", { name: "Check dates & Get a Quote", exact: true });
    await quoteLinks.first().waitFor();
    assert.equal(await quoteLinks.count(), 1, "The updated package detail has one accessible quote CTA at every viewport");
    assert.equal(await quoteLinks.first().getAttribute("href"), "#plan", "The quote CTA points to the shared enquiry form");
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.screenshot({ path: path.join(output, `approved-package-detail-${width}.png`), fullPage: true });
    await page.goto(origin + "/packages/singapore", { waitUntil: "domcontentloaded" });
    await page.getByRole("heading", { name: "Price coming soon", exact: true }).waitFor();
    assert.equal(await page.locator(".package-tiers").innerText().then(text => /GHS/.test(text)), false);
    let submissions = 0;
    await page.route("**/api/public/enquiries", async route => {
      const headers = {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, X-Request-Id",
      };
      if (route.request().method() === "OPTIONS") {
        await route.fulfill({ status: 204, headers });
        return;
      }
      submissions++;
      const body = route.request().postDataJSON();
      assert.equal(body.name, "Synthetic Browser Traveller");
      assert.equal(body.enquiryType, "group");
      assert.equal(body.service, "full_planning");
      assert.equal(body.travellers, 2);
      assert.equal(body.consent, true);
      assert.ok(body.submissionId);
      await route.fulfill({ status: 201, headers, contentType: "application/json",
        body: JSON.stringify({ ok: true,
          data: { inquiryId: "30000000-0000-4000-8000-000000000099", status: "received", replayed: false },
          meta: { requestId: "synthetic-browser-only" } }) });
    });
    const form = page.locator(".public-enquiry-form");
    await page.waitForFunction(() => {
      const submit = document.querySelector(".public-enquiry-form button[type=submit]");
      return submit instanceof HTMLButtonElement && !submit.disabled;
    });
    // Faako SelectField emits a value, not a native event with target.name.
    // Assert the visible label AND submitted state so a silently reset select fails.
    await form.getByRole("button", { name: "Enquiry type", exact: true }).click();
    await page.getByRole("option", { name: "Group", exact: true }).click();
    assert.equal(await form.locator('select[name="enquiryType"]').inputValue(), "group");
    await form.getByRole("button", { name: "Planning support", exact: true }).focus();
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await expect(form.getByRole("button", { name: "Planning support", exact: true })).toBeFocused();
    await page.keyboard.press("Enter");
    const planningOption = page.getByRole("option", { name: "Full Trip Planning", exact: true });
    await planningOption.focus();
    // Let the select's deferred initial-focus frame run. It must not steal
    // an option focus already established by keyboard/assistive navigation.
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await expect(planningOption).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(form.locator('select[name="service"]')).toHaveValue("full_planning");
    await expect(form.getByRole("button", { name: "Planning support", exact: true })).toContainText("Full Trip Planning");
    await form.locator('input[name="destination"]').fill("Help me choose");
    await form.locator('input[name="travelTimeframe"]').fill("Exploring next year");
    await form.locator('input[name="name"]').fill("Synthetic Browser Traveller");
    await form.locator('input[name="email"]').fill("browser@example.invalid");
    await form.locator('input[name="phone"]').fill("+233200000000");
    assert.equal(await form.locator('select[name="enquiryType"]').inputValue(), "group");
    assert.equal(await form.locator('select[name="service"]').inputValue(), "full_planning");
    await form.locator('input[name="consent"]').check();
    await form.getByRole("button", { name: "Send enquiry", exact: true }).click();
    await form.getByRole("status").filter({ hasText: "Your enquiry is received" }).waitFor();
    assert.equal(submissions, 1);
    assert.equal(await form.locator('select[name="enquiryType"]').inputValue(), "trip");
    assert.equal(await form.locator('select[name="service"]').inputValue(), "not_sure");
    await page.goto(origin + "/services", { waitUntil: "networkidle" });
    assert.equal(await page.locator(".service-panel").count(), 4);
    assert.equal(await page.locator(".service-panel").first().evaluate(element => getComputedStyle(element).boxShadow), "none");
    assert.equal(await page.locator(".service-panel__photo").first().evaluate(element => getComputedStyle(element).boxShadow), "none");
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.screenshot({ path: path.join(output, `approved-services-${width}.png`), fullPage: true });
    await page.locator(".service-panel").first().click({ position: { x: 25, y: 50 } });
    await page.waitForURL("**/services/travel-readiness-session");
    await page.getByRole("heading", { name: "Travel Readiness Session", exact: true }).waitFor();
    assert.equal(await page.locator(".service-detail__fee").innerText(), "GH₵400");
    assert.equal(await page.getByRole("link", { name: "Enquire about this service", exact: true }).getAttribute("href"), "#plan");
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.screenshot({ path: path.join(output, `approved-service-detail-${width}.png`), fullPage: true });
    for (const slug of ["full-trip-planning", "premium-concierge", "group-trip-planning"]) {
      const response = await page.request.get(origin + "/services/" + slug);
      assert.equal(response.status(), 200);
      assert.match(await response.text(), /service-detail__fee/);
    }
    await page.goto(origin + "/how-it-works", { waitUntil: "networkidle" });
    assert.equal(await page.locator(".planning-process__guidance").count(), 4);
    assert.equal(await page.locator(".planning-example__steps li").count(), 4);
    assert.equal(await page.getByRole("link", { name: "Explore the Nairobi package", exact: true }).getAttribute("href"), "/packages/nairobi");
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.screenshot({ path: path.join(output, `approved-process-${width}.png`), fullPage: true });
    await page.goto(origin + "/journal", { waitUntil: "domcontentloaded" });
    assert.equal(await page.locator("[data-collection-item]").count(), 2);
    assert.equal(await page.getByText(/Demonstration editorial/).count(), 0);
    await page.locator(".journal-card").first().click();
    await page.waitForURL("**/journal/*");
    const paragraphs = page.locator(".journal-reading .collection-reading > p");
    assert.ok(await paragraphs.count() >= 2, "Journal has an introduction and article paragraphs");
    for (const paragraph of await paragraphs.all()) {
      const font = await paragraph.evaluate(el => {
        const style = getComputedStyle(el);
        return { family: style.fontFamily, size: parseFloat(style.fontSize), lineHeight: parseFloat(style.lineHeight) };
      });
      assert.match(font.family, /Caveat/, "Full journal body uses the handwriting font");
      assert.ok(font.size >= 24, "Journal handwriting is large enough for extended reading");
      assert.ok(font.lineHeight >= 1.3 * font.size, "Handwriting retains generous line spacing");
    }
    assert.match(
      await page.locator(".journal-reading .collection-detail-heading > p").first().evaluate(el => getComputedStyle(el).fontFamily),
      /Quicksand/,
      "Journal metadata remains in the UI font"
    );
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.screenshot({ path: path.join(output, `approved-journal-reading-${width}.png`), fullPage: true });
    await page.goto(origin + "/", { waitUntil: "networkidle" });
    assert.equal(await page.locator(".public-enquiry-form").count(), 1);
    assert.equal(await page.getByText(/placeholder|Online enquiry.*not available|Enquiry availability/i).count(), 0);
    assert.equal(await page.locator('.travel-footprint svg [data-country-detail]').count(), 21);
    await page.getByRole("button", { name: "United Kingdom: 25+ visits", exact: true }).first().focus();
    await page.keyboard.press("Enter");
    await page.locator(".footprint-detail").filter({ hasText: "United Kingdom: 25+ visits" }).waitFor();
    assert.equal(await page.locator('[aria-label="Travel tips"] article').count(), 3);
    const travellerReviews = page.locator("#traveller-reviews");
    await travellerReviews.getByRole("heading", { name: "What Travellers Say" }).waitFor();
    assert.equal(await travellerReviews.locator("article").count(), 3,
      "The homepage renders three anonymous traveller testimonials");
    assert.equal(await travellerReviews.locator("img").count(), 0,
      "Reviewer portraits are not included");
    await travellerReviews.locator("article").nth(1).locator("summary").click();
    await expect(travellerReviews.locator("article").nth(1)).toContainText("Kenya Airways cancellation");
    if (width <= 900) {
      const dots = travellerReviews.locator("[data-review-jump]");
      assert.equal(await dots.count(), 3);
      await dots.nth(2).click();
      await expect(dots.nth(2)).toHaveAttribute("aria-current", "true");
    }
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.screenshot({ path: path.join(output, `approved-home-${width}.png`), fullPage: true });
    const featuredTickets = page.locator(".featured-journeys__card .twe-package-ticket");
    assert.equal(await featuredTickets.count(), 2, "Homepage shows both published featured package tickets");
    await featuredTickets.first().locator(".twe-ticket--front h3 a").click();
    await page.waitForURL("**/packages/zanzibar");
    assert.deepEqual(errors, []);
    await context.close();
  }
  const noJs = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } });

  const published = await noJs.newPage();
  await published.goto(origin + "/packages");
  assert.equal(await published.locator("[data-collection-item]").count(), 4);
  await published.goto(origin + "/packages/nairobi");
  assert.equal(await published.locator(".twe-package-itinerary [role=listitem]").count(), 4,
    "All four Nairobi itinerary days remain readable without scripting");
  assert.equal(await published.locator(".twe-package-gallery__fallback a").count(), 3,
    "Approved package photographs remain accessible as native links without scripting");
  await expect(published.locator(".twe-package-itinerary")).toContainText("Arrive in Nairobi");
  await published.goto(origin + "/how-it-works");
  assert.equal(await published.locator(".planning-example__steps li").count(), 4);
  await published.getByRole("link", { name: "Explore the Nairobi package", exact: true }).click();
  assert.equal(new URL(published.url()).pathname, "/packages/nairobi");
  await published.goto(origin + "/services");
  await published.locator("#service-2 h2 a").click();
  assert.equal(new URL(published.url()).pathname, "/services/full-trip-planning");
  await published.close();
  await noJs.close();
  console.log(JSON.stringify({ passed: true, widths: [320, 390, 768, 1440], noJavaScript: true, screenshots: output, scope: "Local synthetic Astro pages; no provider or real enquiry requests" }));
} finally {
  await browser?.close();
  if (server) { try { process.kill(-server.pid, "SIGTERM"); } catch { /* already closed */ } }
}
