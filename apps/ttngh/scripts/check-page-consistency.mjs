import { chromium } from "playwright";
import { readdir, mkdir } from "node:fs/promises";
import assert from "node:assert/strict";
import { localTestServer } from "./local-test-server.mjs";
const server = await localTestServer();
const folder = process.env.TTNGH_AUDIT_DIR || "/private/tmp/ttngh-consistency";
await mkdir(folder, {recursive:true});
const browser = await chromium.launch({headless:true, executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH});
try {
  const files = (await readdir(new URL("../dist/", import.meta.url), {recursive:true})).filter(file => file.endsWith(".html"));
  for (const width of [390,1440]) {
    const page = await browser.newPage({viewport:{width,height:900},reducedMotion:"reduce"});
    await page.route("https://**/*", route => route.abort());
    for (const file of files) {
      const path = "/" + file.replace(/index.html$/, "");
      await page.goto(server.origin + path);
      const consent = page.locator("[data-cookie-essential]");
      if (await consent.isVisible()) await consent.click();
      if (!process.env.TTNGH_AUDIT_BEFORE) {
        assert.equal(await page.locator("figcaption").count(), 0, path + " photo captions");
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), path + " overflow");
        for (const cta of await page.locator("scroll-expand-section").all()) {
          assert.equal(await cta.locator(".scroll-expand__media").count(),1,path + " CTA background");
          assert.equal(await cta.locator(".button-primary").innerText(),"Donate",path + " CTA action");
          await cta.scrollIntoViewIfNeeded();
          await cta.locator("img").evaluate(image => image.loading = "eager");
          await page.waitForFunction(() => [...document.querySelectorAll(".scroll-expand__media")].every(image => image.complete && image.naturalWidth > 0));
          await cta.locator("img").evaluate(image => image.decode());
        }
      }
      if (path === "/support-us/" || path === "/news/") {
        await page.locator("scroll-expand-section").scrollIntoViewIfNeeded();
        await page.screenshot({path:folder + "/" + path.split("/")[1] + "-" + width + ".png", animations:"disabled",timeout:15000});
      }
    }
    await page.close();
  }
  console.log("All built page routes checked at 390 and 1440px.");
} finally { await browser.close(); await server.close(); }
