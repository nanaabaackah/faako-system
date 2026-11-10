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
    assert.equal(await page.locator(".cinematic-hero").count(),1);
    assert.equal(await page.locator(".closing-cta .mockup").count(),3);
    assert.equal(await page.locator(".closing-scene").count(),1);
    assert.equal(await page.locator(".public-enquiry-form").count(),1);
    assert.equal(await page.locator("footer.twe-public-footer").count(),1);
    assert.equal(await page.locator('[href^="/demo"],[data-demo-personalised]').count(),0);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    await page.evaluate(()=>scrollTo(0,600));
    await page.waitForFunction(()=>document.querySelector(".site-header")?.classList.contains("is-scrolled"));
    assert.equal(await page.locator(".closing-scene__image").evaluate(node=>getComputedStyle(node).objectPosition),
      width<=760?"50% 50%":"50% 60%");
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
  const noJs=await browser.newContext({javaScriptEnabled:false,viewport:{width:390,height:844}});
  const page=await noJs.newPage();
  await page.goto(origin+"/faqs");
  const summary=page.locator(".twe-accordion summary").first();
  await summary.click();
  assert.equal(await page.locator(".twe-accordion").first().getAttribute("open"),"");
  assert.ok(await page.locator("nav a").count()>0);
  await noJs.close();
  console.log(JSON.stringify({passed:true,widths:[320,375,390,768,1024,1440],accessibility:true,noJavaScript:true,screenshots:directory}));
} finally {
  await browser?.close();
  try {process.kill(-server.pid,"SIGTERM");} catch { /* Already stopped. */ }
}
