// Run only against the explicit tests/fixtures/events-build.mjs local QA build.
import { chromium } from "playwright";
import assert from "node:assert/strict";
import { readFile, mkdir } from "node:fs/promises";
import { localTestServer } from "./local-test-server.mjs";
const html = await readFile(new URL("../dist/events/index.html", import.meta.url), "utf8");
assert.ok(html.includes("qa-event-0") && html.includes("noindex"), "Requires non-indexable fixture build");
const server = await localTestServer();
let browser;
try {
  browser = await chromium.launch({headless:true, executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH});
  const screenshots = process.env.TTNGH_EVENTS_SCREENSHOTS;
  if (screenshots) await mkdir(screenshots, {recursive:true});
  const image = await readFile(new URL("../public/images/refresh/vision-reflection-960.webp", import.meta.url));
  const widths = process.env.TTNGH_EVENTS_QA_WIDTHS?.split(",").map(Number) || [320,375,390,430,768,1024,1440];
  assert.ok(widths.every(width=>Number.isInteger(width) && width>=320 && width<=1920));
  for (const width of widths) {
    for (const reducedMotion of ["reduce", "no-preference"]) {
      const context = await browser.newContext({viewport:{width,height:900}, reducedMotion});
      const page = await context.newPage();
      await page.route("https://**/*", async route => {
        if (route.request().url().includes("cdn.sanity.io/images/")) return route.fulfill({contentType:"image/webp",body:image});
        if (route.request().url().includes("/api/calendar/events?")) {
          const from = new URL(route.request().url()).searchParams.get("from");
          const base = {id:"linked",uid:"qa-only",title:"Live schedule title differs",start:from,end:from,allDay:true,timezone:"Africa/Accra",location:"QA venue",status:"confirmed"};
          return route.fulfill({json:{data:{events:[base,{...base,id:"unlinked",uid:"no-editorial-record"}],freshnessSeconds:300}}});
        }
        return route.abort();
      });
      await page.goto(server.origin+"/events");
      const consent = page.getByRole("button", {name:"Essential only",exact:true});
      if (await consent.isVisible()) await consent.click();
      assert.equal(await page.locator("#next-up h3").textContent(), "QA event 0 — editorial layout verification");
      assert.equal(await page.locator("#upcoming-events .event-card").count(), 3);
      assert.deepEqual(await page.locator("#upcoming-events .event-card").evaluateAll(els=>els.map(el=>el.getAttribute("href"))), ["/events/qa-event-1","/events/qa-event-2","/events/qa-event-3"]);
      assert.match(await page.locator("#previous-event").innerText(), /QA event 6/);
      assert.match(await page.locator("#previous-event").innerText(), /Event completed/);
      for (const target of ["#next-up", "#upcoming-events", "#previous-event", ".event-calendar-section", ".events-recurring"]) {
        await page.locator(target).scrollIntoViewIfNeeded();
        await page.waitForFunction(selector=>!document.querySelector(selector)?.hasAttribute("data-reveal-pending"),target);
        assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1), `${target} overflow at ${width}`);
      }
      await page.locator("[data-day$='-01']").click();
      assert.equal(await page.locator(".month-agenda-event").count(),2);
      assert.equal(await page.locator(".month-agenda-event a").count(),1);
      assert.equal(await page.locator(".month-agenda-event a").getAttribute("href"),"/events/qa-event-0");
      await page.locator(".month-agenda-event a").focus();
      await page.keyboard.press("Enter");
      await page.waitForURL("**/events/qa-event-0");
      assert.equal(await page.getByRole("link",{name:"Register for this event"}).count(),1);
      await page.goto(server.origin+"/events/qa-event-6");
      assert.equal(await page.getByRole("link",{name:/Register for this event|Add to Google Calendar|Download calendar event/}).count(),0);
      assert.match(await page.locator(".event-detail-body").innerText(),/Test description/);
      if(screenshots && reducedMotion==="reduce") {
        await page.goto(server.origin+"/events");
        await page.locator("main img").evaluateAll(images => images.forEach(img => { img.loading = "eager"; }));
        for (const img of await page.locator("main img").all()) {
          await img.evaluate(el => Promise.race([el.decode().catch(() => {}), new Promise(resolve => setTimeout(resolve, 3000))]));
        }
        await page.evaluate(() => scrollTo(0,0));
        await page.screenshot({path:`${screenshots}/events-${width}.png`,fullPage:true});
      }
      await context.close();
    }
  }
  const context = await browser.newContext({javaScriptEnabled:false});
  const page = await context.newPage();
  await page.route("https://**/*",route=>route.abort());
  await page.goto(server.origin+"/events");
  assert.equal(await page.locator("#next-up").isVisible(),true);
  assert.equal(await page.locator("#upcoming-events .event-card").count(),3);
  await context.close();
  console.log(`Events QA passed: ${widths.join(", ")}; normal/reduced motion, UID linking, past actions and no-JS.`);
} finally {
  await browser?.close();
  await server.close();
}
