// Run with local dev servers only. Uses installed Playwright and local Chrome.
import assert from "node:assert/strict";
const { chromium } = await import(process.env.TWE_PLAYWRIGHT_MODULE || "playwright");
const web = process.env.TWE_TEST_WEB || "http://127.0.0.1:4338";
const portal = process.env.TWE_TEST_PORTAL || "http://127.0.0.1:5198";
for (const url of [web, portal]) assert.ok(["localhost","127.0.0.1"].includes(new URL(url).hostname));
const browser = await chromium.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true });
try {
  const page = await browser.newPage();
  const errors = [], requests = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("request", request => { if (new URL(request.url()).pathname.startsWith("/api/")) requests.push(request.url()); });
  await page.goto(web + "/demo");
  await page.getByRole("button", {name:"Preview enquiry",exact:true}).waitFor();
  const disclosures = page.locator(".twe-accordion");
  assert.equal(await disclosures.count(), 3);
  await disclosures.nth(0).locator("summary").focus();
  await page.keyboard.press("Enter");
  await disclosures.nth(1).locator("summary").focus();
  await page.keyboard.press("Space");
  assert.equal(await disclosures.nth(0).getAttribute("open"), "");
  assert.equal(await disclosures.nth(1).getAttribute("open"), "");
  await page.keyboard.press("Space");
  assert.equal(await disclosures.nth(1).getAttribute("open"), null);
  assert.equal(await page.locator("header nav a:not(.button) .link-arrow, footer nav a .link-arrow").count(),0);
  assert.equal(await page.locator(".footprint-map").count(),2);
  assert.equal(await page.locator("a.twe-content-link").evaluateAll(links => links.every(link => link.querySelectorAll(".link-arrow").length === 1)),true);
  const country = page.locator("#demo-footprint [data-country-code=TZ]");
  await country.focus(); await page.keyboard.press("Enter");
  assert.match(await page.locator("#demo-footprint .footprint-detail").innerText(),/Tanzania: 4 combined trips/);
  assert.match(await page.locator("#demo-footprint .footprint-countries").innerText(),/Tanzania\s+4 demo trips/);
  for (const width of [320,390,768,1440]) {
    await page.setViewportSize({width,height:1000});
    // Scroll images into view so full-page captures include lazy-loaded media.
    await page.locator(".closing-photos").scrollIntoViewIfNeeded();
    await page.locator("footer").scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth > innerWidth),false, "website overflow at " + width);
    await page.screenshot({path:`/tmp/twe-refined-web-${width}.png`,fullPage:true});
  }
  await page.locator("[data-demo-destination=Zanzibar]").click();
  await page.getByRole("heading",{name:"Sample package enquiry"}).waitFor();
  await page.locator("[data-demo-personalised]").click();
  await page.getByRole("heading",{name:"Sample personalised enquiry"}).waitFor();
  await page.clock.install();
  const submit = page.getByRole("button",{name:"Preview enquiry",exact:true});
  await submit.click(); await submit.click();
  assert.equal(await page.locator(".ui-toast-viewport--twe .ui-toast").count(),1);
  assert.match(await page.locator(".ui-toast").innerText(),/Nothing was sent/);
  await page.locator(".ui-toast").hover();
  await page.clock.fastForward(6000);
  assert.equal(await page.locator(".ui-toast").count(),1,"hover pauses dismissal");
  await page.getByRole("button",{name:"Dismiss notification"}).focus();
  await page.mouse.move(0,0); await page.clock.fastForward(6000);
  assert.equal(await page.locator(".ui-toast").count(),1,"focus pauses dismissal");
  await page.keyboard.press("Enter");
  assert.equal(await page.locator(".ui-toast").count(),0);
  await submit.click(); await page.mouse.move(0,0); await page.clock.fastForward(5000);
  assert.equal(await page.locator(".ui-toast").count(),0,"success auto-dismisses");
  assert.deepEqual(requests,[],"demo must not call API");
  const reduced = await browser.newPage({reducedMotion:"reduce",viewport:{width:390,height:844}});
  await reduced.goto(web + "/demo");
  await reduced.locator(".closing-photos").scrollIntoViewIfNeeded();
  assert.equal(await reduced.evaluate(()=>document.getAnimations().filter(a=>a.playState==="running").length),0);
  const noJs = await browser.newPage({javaScriptEnabled:false,viewport:{width:390,height:844}});
  await noJs.goto(web + "/demo");
  assert.equal(await noJs.locator(".footprint-map").count(),2);
  assert.ok(await noJs.getByRole("button",{name:"Preview enquiry",exact:true}).isDisabled());
  assert.ok(await noJs.locator(".closing-copy").isVisible());
  await noJs.locator(".twe-accordion summary").first().click();
  assert.equal(await noJs.locator(".twe-accordion").first().getAttribute("open"), "");
  const touch = await browser.newPage({viewport:{width:390,height:844},hasTouch:true,isMobile:true});
  await touch.goto(web + "/demo");
  await touch.locator(".twe-accordion summary").first().tap();
  assert.equal(await touch.locator(".twe-accordion").first().getAttribute("open"), "");
  await touch.close();
  const staff = await browser.newPage({viewport:{width:1440,height:1000}});
  await staff.goto(portal + "/?demo=1");
  await staff.getByText("Make room for the next journey.").waitFor();
  for (const width of [320,390,768,1440]) {
    await staff.setViewportSize({width,height:1000});
    assert.equal(await staff.evaluate(()=>document.documentElement.scrollWidth > innerWidth),false,"portal overflow at "+width);
    await staff.screenshot({path:`/tmp/twe-refined-portal-${width}.png`,fullPage:true});
  }
  const navigation = staff.getByRole("navigation",{name:"Staff navigation"});
  for (const width of [320,390,768,1440]) {
    await staff.setViewportSize({width,height:1000});
    const nav = width <= 800 ? staff.locator(".twe-bottom-nav") : navigation;
    for (const name of ["Enquiries","Content","Media","Staff"]) {
      await nav.getByRole("button",{name,exact:true}).click();
      if (name === "Enquiries") {
        await staff.getByRole("button",{name:"Demo Traveller",exact:true}).click();
        await staff.getByRole("heading",{name:"Trip request",exact:true}).waitFor();
      }
      await staff.waitForTimeout(250);
      assert.equal(await staff.evaluate(()=>document.documentElement.scrollWidth > innerWidth),false,name+" overflow at "+width);
      await staff.screenshot({path:`/tmp/twe-screen-${name.toLowerCase()}-${width}.png`,fullPage:true});
    }
  }
  await navigation.getByRole("button",{name:"Staff",exact:true}).click();
  await staff.getByLabel("Verified Access subject").fill("demo-do-not-provision");
  await staff.getByRole("button",{name:"Provision Editor",exact:true}).click();
  await staff.locator(".ui-toast--error").waitFor();
  await staff.clock.install(); await staff.clock.fastForward(6000);
  assert.equal(await staff.locator(".ui-toast--error").count(),1,"errors remain until dismissed");
  await staff.getByRole("button",{name:"Dismiss notification"}).click();
  assert.deepEqual(errors,[]);
  console.log("PASS: sizes, arrows, map/list, keyboard, demo journeys, no-send, toast replacement/pause/dismissal, reduced motion, no-JS, portal errors.");
} finally { await browser.close(); }
