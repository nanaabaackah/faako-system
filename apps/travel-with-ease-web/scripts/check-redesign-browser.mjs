// Real public routes and components. All external requests and submissions blocked.
import { createRequire } from "node:module";
import { mkdtemp } from "node:fs/promises";
import { spawn } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
const require = createRequire(new URL("../../stroane-web/package.json", import.meta.url));
const { chromium } = require("@playwright/test");
const accessibilityRequire = createRequire(new URL("../../reebs-website/package.json", import.meta.url));
const axe = createRequire(accessibilityRequire.resolve("axe-playwright")).resolve("axe-core/axe.min.js");
const cwd = fileURLToPath(new URL("../", import.meta.url));
const directory = await mkdtemp(path.join(tmpdir(), "twe-redesign-"));
const origin = "http://127.0.0.1:4359";
let logs = "", browser;
const server = spawn(process.execPath, ["--input-type=module", "-e",
  'import { dev } from "astro"; await dev({root:process.cwd(),server:{host:"127.0.0.1",port:4359},devToolbar:{enabled:false}});'], {
  cwd, detached: true, env: { ...process.env, ASTRO_TELEMETRY_DISABLED: "1",
    PUBLIC_APP_ENV: "development", TWE_CONTENT_SNAPSHOT: "" },
  stdio: ["ignore", "pipe", "pipe"],
});
server.stdout.on("data", chunk => { logs += chunk; });
server.stderr.on("data", chunk => { logs += chunk; });
try {
  for (let attempt = 0; attempt < 60; attempt++) {
    try { if ((await fetch(origin)).ok) break; } catch { /* Owned server starting. */ }
    if (attempt === 59) throw new Error(logs.slice(-2000));
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  browser = await chromium.launch({headless:true,
    ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? {executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH} : {})});
  for (const width of [320, 375, 390, 768, 1024, 1440]) {
    const context = await browser.newContext({viewport:{width,height:900},hasTouch:width<768,reducedMotion:"reduce"});
    const page = await context.newPage(), errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.route("**/*", route => {
      const request = route.request(), url = new URL(request.url());
      if (url.origin !== origin || request.method() !== "GET" || url.pathname.startsWith("/api/")) return route.abort();
      return route.continue();
    });
    await page.goto(origin, {waitUntil:"networkidle"});
    await page.getByRole("button",{name:"Essential only",exact:true}).click();
    // Navigation: icon only, borderless panel, one vertical column at <=900px.
    const menu = page.getByRole("button", {name:"Menu", exact:true});
    const primaryNav = page.locator("#primary-navigation");
    if (width <= 900) {
      assert.equal(await menu.isVisible(), true);
      assert.equal(await menu.innerText(), "", "Mobile toggle has an SVG, not visible Menu text");
      assert.equal(await menu.locator('svg[aria-hidden="true"]').count(), 2);
      assert.equal(await menu.getAttribute("aria-expanded"), "false");
      assert.equal(await primaryNav.isVisible(), false);
      assert.equal(await menu.evaluate(el=>getComputedStyle(el).borderTopWidth), "0px");
      await menu.click();
      assert.equal(await menu.getAttribute("aria-expanded"), "true");
      assert.equal(await menu.locator(".menu-toggle__close").isVisible(), true);
      assert.equal(await primaryNav.isVisible(), true);
      assert.equal(await primaryNav.evaluate(el=>getComputedStyle(el).flexDirection), "column");
      assert.equal(await primaryNav.evaluate(el=>getComputedStyle(el).borderTopWidth), "0px");
      assert.equal(await primaryNav.locator(".header-links").evaluate(el=>getComputedStyle(el).flexDirection), "column");
      assert.equal(await primaryNav.evaluate(el=>getComputedStyle(el).position), "fixed");
      const menuSize = await primaryNav.boundingBox();
      assert.ok(menuSize.width >= width - 1, "Open menu spans the viewport");
      assert.equal(await primaryNav.evaluate(el=>getComputedStyle(el).backgroundColor), "rgb(1, 12, 51)");
      assert.equal(await page.locator("body").evaluate(el=>getComputedStyle(el).overflow), "hidden",
        "Open mobile menu prevents document scrolling");
      const mobileLabels = await primaryNav.locator(".header-links a:visible").allTextContents();
      assert.deepEqual(mobileLabels.map(label=>label.trim()), [
        "Packages", "Services", "How It Works", "Journal", "About",
      ]);
      const firstNavLink = primaryNav.locator(".header-links a:visible").first();
      const firstNavStyle = await firstNavLink.evaluate(el=>({
        weight:getComputedStyle(el).fontWeight,
        font:getComputedStyle(el).fontFamily,
        border:getComputedStyle(el).borderBottomWidth,
      }));
      assert.equal(firstNavStyle.weight, "800");
      assert.match(firstNavStyle.font, /Inter/);
      assert.equal(firstNavStyle.border, "1px");
      const menuCta = primaryNav.locator(".nav-cta");
      assert.equal(await menuCta.evaluate(el=>getComputedStyle(el).backgroundColor), "rgb(216, 181, 106)");
      assert.equal(await menuCta.evaluate(el=>getComputedStyle(el).fontWeight), "800");
      assert.ok((await menuCta.boundingBox()).width >= width - 72, "Gold CTA fills the menu width");
      const menuLinks = primaryNav.locator("a:visible");
      const boxes = await Promise.all((await menuLinks.all()).map(link=>link.boundingBox()));
      for (let i = 1; i < boxes.length; i++) {
        assert.ok(boxes[i].y >= boxes[i-1].y + boxes[i-1].height - 1, "Mobile links stack vertically without overlap");
      }
      await menuLinks.first().focus();
      await page.keyboard.press("Escape");
      assert.equal(await menu.getAttribute("aria-expanded"), "false");
      assert.equal(await primaryNav.isVisible(), false);
      assert.notEqual(await page.locator("body").evaluate(el=>getComputedStyle(el).overflow), "hidden",
        "Closing mobile menu restores document scrolling");
      assert.equal(await menu.evaluate(el=>el===document.activeElement),true,"Escape returns focus to the icon");
    } else {
      assert.equal(await menu.isVisible(), false, "Desktop navigation does not show a menu toggle");
    }
    const header = page.locator(".site-header");
    const goldLogo = header.locator(".brand__wordmark--gold");
    const whiteLogo = header.locator(".brand__wordmark--light");
    assert.equal(await goldLogo.isVisible(), true, "Unscrolled header uses the gold wordmark");
    assert.equal(await whiteLogo.isVisible(), false, "White logo is reserved for the scrolled state");
    if (width <= 900) {
      assert.ok((await goldLogo.boundingBox()).width <= 118, "Mobile gold logo is compact");
    }
    if (width <= 600) {
      const actions = page.locator(".cinematic-hero__actions > .twe-content-link");
      assert.equal(await actions.count(), 2);
      const first = await actions.nth(0).boundingBox();
      const second = await actions.nth(1).boundingBox();
      assert.ok(first && second && second.y >= first.y + first.height, "Hero actions stack on small screens");
      assert.ok(first.width >= 0.8 * width && second.width >= 0.8 * width,
        "Hero actions have generous mobile width");
      assert.ok(Math.abs(first.width - second.width) <= 1,
        "Hero actions share an equal width");
    }
    assert.equal(await page.locator(".cinematic-hero").count(),1);
    const heroTextColors = await page.locator(".cinematic-hero").evaluate(el=>({
      heading:getComputedStyle(el.querySelector("h1")).color,
      paragraph:getComputedStyle(el.querySelector(".cinematic-hero__copy > p")).color,
      signature:getComputedStyle(el.querySelector(".hero-signature")).color,
    }));
    assert.equal(heroTextColors.heading, "rgb(244, 237, 227)");
    assert.equal(heroTextColors.paragraph, "rgb(244, 237, 227)");
    assert.equal(heroTextColors.signature, "rgb(216, 181, 106)");
    const heroFont = await page.locator(".cinematic-hero h1").evaluate(el=>({
      family:getComputedStyle(el).fontFamily,
      weight:getComputedStyle(el).fontWeight,
      stroke:getComputedStyle(el).webkitTextStrokeWidth,
    }));
    assert.match(heroFont.family, /Poiret One/);
    assert.equal(heroFont.weight, "400");
    assert.ok(parseFloat(heroFont.stroke) >= 0.4, "Poiret headings are optically strengthened");
    const signatureFont = await page.locator(".hero-signature").evaluate(el => ({
      family:getComputedStyle(el).fontFamily,
      stroke:getComputedStyle(el).webkitTextStrokeWidth,
    }));
    assert.match(signatureFont.family, /Sassy Frass/);
    assert.equal(parseFloat(signatureFont.stroke), 0, "Signature remains handwritten without outlined stroke");
    const editorialFont = await page.locator(".journey-introduction h2").evaluate(el => ({
      family:getComputedStyle(el).fontFamily,
      weight:getComputedStyle(el).fontWeight,
      stroke:getComputedStyle(el).webkitTextStrokeWidth,
    }));
    assert.match(editorialFont.family, /Poiret One/);
    assert.equal(editorialFont.weight, "400");
    assert.ok(parseFloat(editorialFont.stroke) > 0);
    const signatureSize = await page.locator(".hero-signature").evaluate(el=>parseFloat(getComputedStyle(el).fontSize));
    assert.ok(signatureSize >= (width <= 480 ? 68 : 64), "Signature is visibly larger");
    if (width <= 480) {
      const signature = page.locator(".hero-signature");
      const signatureBox = await signature.boundingBox();
      const viewportWidth = page.viewportSize().width;
      assert.ok(signatureBox && signatureBox.x >= 0 && signatureBox.x + signatureBox.width <= viewportWidth + 1,
        "Larger mobile signature fits within viewport");
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true,
        "Larger handwritten signature must not cause horizontal page overflow");
    }
    const lightSection = page.locator(".journey-introduction");
    if (await lightSection.count()) {
      const lightColors = await lightSection.evaluate(el => ({
        heading:getComputedStyle(el.querySelector("h2")).color,
        paragraph:getComputedStyle(el.querySelector("p")).color,
      }));
      assert.equal(lightColors.heading, "rgb(1, 12, 51)");
      assert.equal(lightColors.paragraph, "rgb(93, 99, 114)");
    }
    // Option A is scoped to four homepage sections; the protected packages,
    // travel footprint, hero, navigation, and closing/footer remain present.
    const about = page.locator(".journey-introduction--option-a");
    assert.equal(await about.count(), 1);
    assert.equal(await about.locator("h2").count(), 1);
    assert.equal(await about.locator(".journey-introduction__photo").count(), 1,
      "About uses the approved published photo");
    const cards = page.locator(".home-services--option-a .home-services__row");
    assert.equal(await cards.count(), 4, "All four published service choices remain available");
    assert.equal(await page.locator(".home-services--option-a .home-services__fee").count(), 4,
      "Published service fees remain visible");
    assert.equal(await page.locator(".home-services--option-a .home-services__list").evaluate(el => getComputedStyle(el).display), "grid");
    const serviceBoxes = await Promise.all((await cards.all()).map(el => el.boundingBox()));
    assert.ok(serviceBoxes.every(Boolean));
    if (width <= 480) {
      assert.ok(serviceBoxes.slice(1).every(box => Math.abs(box.x - serviceBoxes[0].x) < 1),
        "Small phone service choices stay in a single column");
    } else if (width >= 1100) {
      assert.ok(serviceBoxes.slice(1).every(box => Math.abs(box.y - serviceBoxes[0].y) < 1),
        "Desktop service choices stay in one clean editorial row");
    }
    // The homepage process uses the branded React Bits Stepper, not four static list items.
    // Scroll into view to hydrate Astro's client:visible island before asserting controls.
    const process = page.locator(".journey-process--option-a");
    // Astro islands can use display:contents; scroll to their rendered content.
    await process.locator(".journey-process__interactive").scrollIntoViewIfNeeded();
    await page.waitForFunction(() => {
      const element = document.querySelector(".journey-process--option-a astro-island");
      return Boolean(element && !element.hasAttribute("ssr"));
    }, null, {timeout:20000});
    const journeyStepper = process.locator(".journey-process__interactive");
    const indicators = journeyStepper.locator(".stepper__segment");
    await indicators.first().waitFor({state:"visible",timeout:15000});
    assert.equal(await indicators.count(), 4, "Keep all four published planning steps");
    assert.equal(await indicators.first().getAttribute("aria-current"), "step");
    assert.equal(await journeyStepper.locator(".journey-process__step-copy h3").last().isVisible(), true);
    const next = journeyStepper.locator(".stepper__button--next");
    const back = journeyStepper.locator(".stepper__button--back");
    await next.click();
    assert.equal(await indicators.nth(1).getAttribute("aria-current"), "step",
      "Next advances to the second published planning step");
    await back.click();
    assert.equal(await indicators.first().getAttribute("aria-current"), "step",
      "Back returns to the first step");
    for (let index = 1; index < 4; index++) {
      await next.click();
      assert.equal(await indicators.nth(index).getAttribute("aria-current"), "step");
    }
    await next.click();
    const finalAction = journeyStepper.getByRole("link", {name:"Plan my trip"});
    await finalAction.waitFor({state:"visible"});
    assert.equal(await finalAction.getAttribute("href"), "#plan",
      "Completing the four steps opens the existing enquiry CTA");
    await indicators.first().click();
    assert.equal(await indicators.first().getAttribute("aria-current"), "step",
      "Visitors can revisit the guide after completion");
    const tips = page.locator(".travel-tips--option-a");
    assert.equal(await tips.count(), 1);
    assert.equal(await tips.locator(".travel-tips__grid article").count(), 3,
      "Three published travel tips remain visible");
    if (width <= 760) {
      const tipBoxes = await Promise.all((await tips.locator(".travel-tips__grid article").all()).map(el => el.boundingBox()));
      assert.ok(tipBoxes.slice(1).every(box => Math.abs(box.x - tipBoxes[0].x) < 1),
        "Travel tips stack cleanly on mobile");
    }
    assert.equal(await page.locator("#our-world.cream-footprint .travel-footprint").count(), 1,
      "Keep the existing verified footprint section");
    assert.equal(await page.locator("#our-world .footprint-map").count(), 1,
      "Preserve the interactive map");
    assert.equal(await page.locator(".featured-journeys").count(), 1,
      "Keep the published package section");
    assert.equal(await page.locator(".closing-cta .mockup").count(),3);
    assert.equal(await page.locator(".closing-scene").count(),1);
    assert.equal(await page.locator(".public-enquiry-form").count(),1);
    assert.equal(await page.locator("footer.twe-public-footer").count(),1);
    assert.equal(await page.locator('[href^="/demo"],[data-demo-personalised]').count(),0);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    await page.evaluate(()=>scrollTo(0,600));
    await page.waitForFunction(()=>document.querySelector(".site-header")?.classList.contains("is-scrolled"));
    assert.equal(await header.evaluate(el=>getComputedStyle(el).backgroundColor), "rgb(1, 12, 51)",
      "Scrolled navbar uses brand navy");
    assert.equal(await whiteLogo.isVisible(), true, "Scrolled navbar shows approved white wordmark");
    assert.equal(await goldLogo.isVisible(), false, "Scrolled navbar hides gold wordmark");
    const logoSrc = await whiteLogo.getAttribute("src");
    assert.equal(logoSrc, "/brand/midnight primary.png");
    assert.ok((await whiteLogo.boundingBox()).height <= 48);
    await page.locator(".site-header nav").evaluate(el => el.scrollTop = 0);
    if (width <= 900) {
      await menu.click();
      assert.equal(await primaryNav.evaluate(el=>getComputedStyle(el).backgroundColor),
        "rgb(1, 12, 51)", "Expanded scrolled nav remains navy");
      await menu.click();
    }
    assert.equal(await page.locator(".closing-scene__image").evaluate(node=>getComputedStyle(node).objectPosition),
      width<=760?"50% 50%":"50% 60%");
    // Regression: the featured journey cards are navy inside a light
    // editorial wrapper; paragraph colors must not inherit the slate palette.
    const featuredCards = page.locator(".featured-journeys .journey-preview");
    if (await featuredCards.count()) {
      const cardColors = await featuredCards.first().evaluate(el=>({
        duration:getComputedStyle(el.querySelector(".featured-journeys__duration")).color,
        tagline:getComputedStyle(el.querySelector(".journey-preview__tagline")).color,
        heading:getComputedStyle(el.querySelector("h3")).color,
      }));
      assert.equal(cardColors.duration, "rgb(216, 181, 106)");
      assert.equal(cardColors.tagline, "rgb(244, 237, 227)");
      assert.equal(cardColors.heading, "rgb(244, 237, 227)");
    }
    await page.addScriptTag({path:axe});
    const violations = await page.evaluate(async()=> (await window.axe.run(document,{
      runOnly:{type:"tag",values:["wcag2a","wcag2aa","wcag21aa"]},
    })).violations.map(item=>({id:item.id,impact:item.impact,nodes:item.nodes.map(node=>node.target)})));
    assert.deepEqual(violations,[]);
    await page.screenshot({path:path.join(directory,"home-"+width+".png"),fullPage:true});
    await page.goto(origin+"/faqs",{waitUntil:"networkidle"});
    const disclosure=page.locator(".twe-accordion").first(),summary=disclosure.locator("summary");
    await summary.focus(); await page.keyboard.press("Enter");
    assert.equal(await disclosure.getAttribute("open"),"");
    await page.keyboard.press("Space");
    assert.equal(await disclosure.getAttribute("open"),null);
    await summary.tap({force:true}).catch(()=>summary.click());
    assert.equal(await disclosure.getAttribute("open"),"");
    await page.screenshot({path:path.join(directory,"faqs-"+width+".png"),fullPage:true});
    assert.deepEqual(errors,[]);
    await context.close();
  }
  // Keep the no-JavaScript regression deterministic: a native <summary>
  // responds to Enter/Space even when the long FAQ page or fixed header makes
  // an automated pointer click report "outside of the viewport".
  const noJs=await browser.newContext({
    javaScriptEnabled:false,
    viewport:{width:390,height:844},
    reducedMotion:"reduce",
  });
  const page=await noJs.newPage();
  await page.goto(origin+"/faqs",{waitUntil:"domcontentloaded"});
  const disclosure=page.locator(".twe-accordion").first();
  const summary=disclosure.locator("summary");
  await summary.focus();
  assert.equal(await summary.evaluate(el=>el===document.activeElement),true,
    "FAQ summary is keyboard-focusable without JavaScript");
  await page.keyboard.press("Enter");
  assert.equal(await disclosure.getAttribute("open"),"",
    "Native FAQ opens with Enter when scripting is disabled");
  await page.keyboard.press("Space");
  assert.equal(await disclosure.getAttribute("open"),null,
    "Native FAQ closes with Space when scripting is disabled");
  assert.ok(await page.locator("nav a").count()>0);
  await page.goto(origin, {waitUntil:"domcontentloaded"});
  assert.equal(await page.locator(".journey-process--option-a .journey-process__fallback > li").count(), 4,
    "All four published planning steps remain readable without JavaScript");
  await noJs.close();
  console.log(JSON.stringify({passed:true,widths:[320,375,390,768,1024,1440],accessibility:true,noJavaScript:true,screenshots:directory}));
} finally {
  await browser?.close();
  try {process.kill(-server.pid,"SIGTERM");} catch { /* Already stopped. */ }
}
