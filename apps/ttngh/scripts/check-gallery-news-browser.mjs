import { chromium } from "playwright";
import assert from "node:assert/strict";
import { localTestServer } from "./local-test-server.mjs";
import { mkdir } from "node:fs/promises";
import { eventStories } from "../src/content/event-stories.js";
const server=await localTestServer();
let browser;
try {
  browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH});
  const screenshots=process.env.TTNGH_GALLERY_SCREENSHOTS;
  if(screenshots) await mkdir(screenshots,{recursive:true});
  for(const width of [375,768,1440]) {
    const context=await browser.newContext({viewport:{width,height:900},reducedMotion:"reduce"});
    await context.route("https://**/*",route=>route.abort());
    const page=await context.newPage();
    for(const path of ["/gallery","/news","/events",...eventStories.map(story => "/events/stories/" + story.slug),"/news/coverage/mental-health-education-odorgonno","/news/coverage/nilee-ttngh-school-engagement"]) {
      await page.goto(server.origin+path);
      await page.locator("main img").evaluateAll(images=>images.forEach(image=>image.loading="eager"));
      await page.waitForFunction(()=>Array.from(document.querySelectorAll("main img")).every(image=>image.complete && image.naturalWidth>0));
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`${path} overflow at ${width}`);
      if(path==="/gallery") assert.equal(await page.locator(".gallery-grid img").count(),10);
      if(path==="/gallery") {
        const gaps = await page.locator(".gallery-grid").evaluateAll(grids => grids.flatMap(grid => {
          const bounds = grid.getBoundingClientRect();
          const rows = [];
          for (const image of grid.querySelectorAll("img")) {
            const box = image.getBoundingClientRect();
            let row = rows.find(row => Math.abs(row[0].top - box.top) < 2);
            if (!row) { row = []; rows.push(row); }
            row.push(box);
          }
          return rows.flatMap(row => [
            Math.abs(row[0].left - bounds.left),
            Math.abs(row.at(-1).right - bounds.right),
            Math.max(...row.map(box => box.bottom)) - Math.min(...row.map(box => box.bottom)),
          ]);
        }));
        assert.ok(gaps.every(gap => gap < 3), `Gallery row gaps at ${width}px: ${JSON.stringify(gaps)}`);
      }
      if(path==="/events") assert.ok(await page.locator("#event-stories .event-card").count() >= 4);
      if(path.startsWith("/events/stories/")) assert.ok(await page.locator(".press-detail figure img").count() >= 2);
      if(path==="/news") {
        assert.equal(await page.locator(".news-card").count(),2);
        await page.locator(".news-card").first().focus();await page.keyboard.press("Enter");
        await page.waitForURL("**/news/coverage/mental-health-education-odorgonno");
        await page.goto(server.origin+path);
      }
      if(path.includes("/coverage/")) {assert.equal(await page.locator(".press-detail figure img").count(),2);assert.match(await page.locator(".press-source a").getAttribute("href"),/^https:\/\/(www.pulse.com.gh|yemmey.com)\//);}
      if(screenshots && path!=="/news") await page.screenshot({path:`${screenshots}/${path.replaceAll("/","-")}-${width}.png`,fullPage:true});
    }
    await context.close();
  }
  console.log("Gallery and news: 375/768/1440px images, links and overflow checks passed");
} finally {await browser?.close();await server.close();}
