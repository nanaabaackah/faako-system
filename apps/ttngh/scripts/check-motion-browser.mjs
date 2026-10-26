import { chromium } from "playwright";
import assert from "node:assert/strict";
import { readdir, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { localTestServer } from "./local-test-server.mjs";
const server = await localTestServer();
let browser;
try {
  browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } : {}) });
  let checks = 0;
  const screenshots = process.env.TTNGH_MOTION_SCREENSHOT_DIR;
  if (screenshots) await mkdir(screenshots, { recursive: true });
  const paths = ["/", "/about", "/programmes", "/events", "/impact", "/team", "/get-involved", "/contact", "/news", "/resources", "/support-us", "/cms", "/privacy", "/terms", "/404.html"];
  paths.push(...(await readdir(new URL("../dist/events/", import.meta.url), { withFileTypes: true })).filter(entry => entry.isDirectory()).map(entry => "/events/" + entry.name));
  const widths=process.env.TTNGH_QA_WIDTHS ? process.env.TTNGH_QA_WIDTHS.split(',').map(Number) : [320,375,390,430,768,1024,1440];
  assert.ok(widths.every(width=>Number.isInteger(width)&&width>=320&&width<=1920));
  for (const reducedMotion of process.env.TTNGH_CONTACT_QA_ONLY ? [] : ["no-preference", "reduce"]) for (const width of widths) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion, hasTouch: width < 768 });
    const page = await context.newPage();
    page.setDefaultTimeout(15000);
    page.setDefaultNavigationTimeout(15000);
    await page.route("https://**/*", route => route.abort()); // Never contact real APIs/providers.
    for (const path of paths) {
      await page.goto(server.origin + path, { waitUntil: "load" });
      const essential = page.getByRole("button", { name: "Essential only", exact: true });
      if (await essential.isVisible()) await essential.click();
      const heading = page.locator('h1');
      assert.ok(Number(await heading.evaluate(el => getComputedStyle(el).opacity)) >= .85, path + ' hero stays readable');
      assert.equal(await page.locator('.home-hero[data-reveal-pending],.page-hero[data-reveal-pending]').count(), 0);
      if (reducedMotion === 'reduce') {
        assert.equal(await heading.evaluate(el => getComputedStyle(el).animationName), 'none');
        assert.equal(await heading.evaluate(el => getComputedStyle(el).translate), 'none');
      }
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), path + " overflow at " + width);
      for (const element of await page.locator("[data-reveal]").all()) {
        await element.scrollIntoViewIfNeeded();
        // A neighbouring composition can legitimately be below its 8% threshold.
        await page.waitForFunction(el => !el.hasAttribute('data-reveal-pending'), await element.elementHandle());
        if (reducedMotion === "reduce") assert.equal(await element.evaluate(el => getComputedStyle(el).opacity), "1");
      }
      const scroll = page.locator("scroll-expand-section").first();
      if (await scroll.count()) {
        await scroll.locator("a").focus();
        assert.equal(await scroll.locator(".scroll-expand__overlay").evaluate(el => getComputedStyle(el).opacity), "1");
        if ((width < 700 || reducedMotion === "reduce") && await scroll.locator(".scroll-expand__media").count()) assert.equal(await scroll.locator(".scroll-expand__media").first().evaluate(el => getComputedStyle(el).transform), "none");
      }
      if (path === '/') {
        const row=page.locator('.programme-row').first();
        await page.keyboard.press('Tab'); // Exercise keyboard :focus-visible, not pointer focus.
        await row.focus();
        await page.waitForTimeout(300);
        assert.notEqual(await row.evaluate(el=>getComputedStyle(el).outlineStyle),'none');
        assert.equal(await row.locator('.ttngh-icon').evaluate(el=>getComputedStyle(el).translate),reducedMotion==='reduce'?'none':'3px');
        await row.press('Enter');
        await page.waitForURL('**/programmes');
        await page.goBack();
      }
      if (screenshots && reducedMotion==='no-preference' && [390,768,1440].includes(width)) {
        for (const element of await page.locator('[data-reveal]').all()) await element.scrollIntoViewIfNeeded();
        await page.waitForFunction(()=>document.querySelectorAll('[data-reveal-pending]').length===0);
        await page.evaluate(()=>scrollTo({top:0,behavior:'instant'}));
        await page.waitForTimeout(800);
        await page.screenshot({path:join(screenshots,`${path.replace(/[^a-z0-9]/gi,'-')||'home'}-${width}.png`),fullPage:true});
        if(path==='/') {
          for(const [name,selector] of [['hero','.home-hero'],['intro','.home-intro'],['programmes','.home-programmes'],['impact','.home-impact'],['event','.featured-event']]) {
            const section=page.locator(selector);
            await section.scrollIntoViewIfNeeded();
            await section.screenshot({path:join(screenshots,`home-${name}-${width}.png`)});
          }
        }
      }
      checks++;
    }
    await context.close();
    console.log(`Checked ${width}px / ${reducedMotion}`);
  }
  // No-JS content and signature CTA remain readable.
  const nojs = await browser.newContext({ javaScriptEnabled: false });
  const staticPage = await nojs.newPage();
  await staticPage.route('https://**/*',route=>route.abort());
  for(const path of paths) {
    await staticPage.goto(server.origin + path);
    assert.equal(await staticPage.locator("[data-reveal-pending]").count(), 0);
    for(const element of await staticPage.locator('[data-reveal]').all()) assert.equal(await element.evaluate(el=>getComputedStyle(el).opacity),'1');
    assert.ok(Number(await staticPage.locator('h1').evaluate(el=>getComputedStyle(el).opacity))>=.85);
  }
  await nojs.close();
  // Local-only fixtures exercise linked CMS/team images even when CMS collections are empty.
  const imagePage=await browser.newPage();
  await imagePage.route('https://**/*',route=>route.abort());
  await imagePage.goto(server.origin+'/');
  await imagePage.evaluate(()=>{
    const fixture=document.createElement('section'); fixture.id='qa-image-interaction';
    for(const name of ['content-entry','event-card','team-member','informational']) {
      const item=document.createElement('article'); item.className=name;
      const img=document.createElement('img'); img.src='/images/refresh/vision-community-640.webp'; img.alt='Local QA image'; img.width=120;
      item.append(img);
      if(name!=='informational') { const link=document.createElement('a'); link.href='#qa-image-interaction'; link.textContent='QA link'; item.append(link); }
      fixture.append(item);
    }
    document.querySelector('main').prepend(fixture);
  });
  for(const mode of ['no-preference','reduce']) {
    await imagePage.emulateMedia({reducedMotion:mode});
    for(const name of ['content-entry','event-card','team-member']) {
      const item=imagePage.locator(`#qa-image-interaction .${name}`);
      await item.locator('a').focus();
      await imagePage.waitForTimeout(700);
      const transform=await item.locator('img').evaluate(el=>getComputedStyle(el).transform);
      assert.equal(transform,mode==='reduce'?'none':'matrix(1.015, 0, 0, 1.015, 0, 0)');
    }
    const still=imagePage.locator('#qa-image-interaction .informational img');
    await still.hover();
    assert.equal(await still.evaluate(el=>getComputedStyle(el).transform),'none');
  }
  await imagePage.close();
  // Simulate missing and broken observers independently of the normal scroll run.
  for(const mode of ['missing','constructor','observe']) {
    const context=await browser.newContext();
    await context.addInitScript(mode=>{
      if(mode==='missing') delete window.IntersectionObserver;
      else window.IntersectionObserver=class {
        constructor(){if(mode==='constructor')throw new Error('QA observer failure');}
        observe(){throw new Error('QA observation failure');}
        disconnect(){} unobserve(){}
      };
    },mode);
    const page=await context.newPage();
    await page.route('https://**/*',route=>route.abort());
    await page.goto(server.origin+'/');
    assert.equal(await page.locator('[data-reveal-pending]').count(),0,mode+' fails open');
    await context.close();
  }
  for (const reducedMotion of ["no-preference", "reduce"]) {
    const page = await browser.newPage({ viewport: { width: 390, height: 900 }, reducedMotion });
    await page.route('https://**/*',route=>route.abort());
    let verifyLoads = 0, requests = 0, resolveRequest, failure = false;
    await page.route("**/turnstile/v0/api.js?*", route => {
      verifyLoads++;
      return route.fulfill({ contentType: "text/javascript", body: 'window.turnstile={render:(el,options)=>{window.testVerify=()=>options.callback("fixture-token");return "fixture-widget"},reset:()=>{window.testResets=(window.testResets||0)+1}};' });
    });
    await page.route("**/api/enquiries", async route => {
      requests++; await new Promise(resolve => { resolveRequest = resolve; });
      await route.fulfill({ status: failure ? 503 : 200, contentType: "application/json", body: JSON.stringify(failure ? { error: { message: "Unavailable" } } : { data: { accepted: true } }) });
    });
    await page.goto(server.origin + "/contact");
    const essential = page.getByRole("button", { name: "Essential only", exact: true });
    if (await essential.isVisible()) await essential.click();
    assert.equal(verifyLoads, 0, "Turnstile must remain manually loaded");
    await page.locator("[data-load-verification]").click();
    await page.waitForFunction(() => typeof window.testVerify === "function");
    const form = page.locator("[data-contact-form]"), button = form.locator('[type="submit"]');
    await page.evaluate(() => window.testVerify());
    await button.click();
    assert.equal(requests,0,'invalid form must not reach API');
    assert.match(await form.locator('[data-form-status]').innerText(),/required fields/);
    const fill = async () => {
      await form.locator('[name="name"]').fill("QA Visitor");
      await form.locator('[name="email"]').fill("qa@example.org");
      await form.locator('[name="topic"]').selectOption("Events");
      await form.locator('[name="message"]').fill("This is a local test enquiry with mocked delivery only.");
      await form.locator('[name="consent"]').check();
      await page.evaluate(() => window.testVerify());
    };
    for (failure of [false, true]) {
      await fill();
      const before = await button.boundingBox(), prior = requests;
      await button.click();
      await page.waitForFunction(() => document.querySelector("[data-async-state]").dataset.asyncState === "working");
      assert.equal(await button.getAttribute("aria-busy"), "true");
      assert.equal(await button.isDisabled(), true);
      assert.ok(Math.abs((await button.boundingBox()).width - before.width) < 1, JSON.stringify({ before: before.width, working: (await button.boundingBox()).width }));
      if (reducedMotion === "reduce") assert.equal(await button.locator(".async-spinner").evaluate(el => getComputedStyle(el).animationName), "none");
      await form.evaluate(el => el.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
      await page.waitForTimeout(100);
      assert.equal(requests, prior + 1, "duplicate submit must not reach API");
      resolveRequest();
      await page.waitForFunction(state => document.querySelector("[data-async-state]").dataset.asyncState === state, failure ? "error" : "success");
      assert.equal(await button.getAttribute("aria-busy"), "false");
      if (failure) assert.equal(await button.isDisabled(), false);
    }
    assert.equal(await page.evaluate(() => window.testResets), 2);
    await page.close();
  }
  console.log(JSON.stringify({ routeViewportMotionChecks: checks, contactStateChecks: "passed", noJs: "passed" }));
} finally { await browser?.close(); await server.close(); }
