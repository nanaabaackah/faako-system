// Run against a local fixture preview. All external requests are intercepted.
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.TTNGH_QA_URL || 'http://127.0.0.1:4177';
const fixture = process.env.TTNGH_FIXTURE_QA === 'true';
if (!['localhost','127.0.0.1'].includes(new URL(base).hostname)) throw Error('Local QA only');
const routes = ['/', '/about', '/programmes', '/events', '/team', '/impact', '/news', '/resources', '/get-involved', '/support-us', '/contact', '/privacy', '/terms', '/cms'];
if (fixture) routes.push('/programmes/fixture-programme','/news/fixture-news','/resources/fixture-resource','/events/test-community-event');
(async()=>{
 const browser = await chromium.launch({headless:true, ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? {executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH} : {})});
 try {
  const context = await browser.newContext({reducedMotion:'reduce'});
  let deliveries=0,fail=false,securityLoads=0;
  await context.route('**/*', async route=>{
   const url = new URL(route.request().url());
   if(url.origin === new URL(base).origin) return route.continue();
   if(url.hostname === 'cdn.sanity.io') return route.fulfill({status:200,contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1067"><rect width="1600" height="1067" fill="#bbb"/></svg>'});
   if(url.hostname === 'challenges.cloudflare.com') {securityLoads++; return route.fulfill({contentType:'text/javascript',body:'window.turnstile={render:(el,o)=>{window.testVerification=o;o.callback("fixture-token");return "widget"},reset:()=>{}};'});}
   if(url.hostname === 'ttngh-api.example.org') {
    const headers={'access-control-allow-origin':new URL(base).origin,'access-control-allow-headers':'content-type,x-request-id','access-control-allow-methods':'POST,OPTIONS'};
    if(route.request().method()==='OPTIONS') return route.fulfill({status:204,headers});
    deliveries++;
    const payload=route.request().postDataJSON(); assert.equal(payload.consent,true); assert.equal(payload.turnstileToken,'fixture-token');
    return route.fulfill({status:fail?503:200,headers,contentType:'application/json',body:JSON.stringify(fail?{ok:false,error:{code:'SERVICE_UNAVAILABLE',message:'Unavailable'}}:{ok:true,data:{accepted:true}})});
   }
   return route.abort();
  });
  const page=await context.newPage();
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  for(const width of [320,390,768,1440]) {
   await page.setViewportSize({width,height:900});
   for(const route of routes) {
    await page.goto(base+route,{waitUntil:'domcontentloaded'});
    await page.evaluate(()=>document.fonts.ready);
    assert.equal(await page.locator('h1').count(),1,route);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`${route}: overflow at ${width}`);
    assert.ok(await page.locator('.ttngh-icon').count()>0);
    await page.evaluate(()=>scrollTo({top:1400,behavior:'instant'}));
    const top=await page.locator('.site-header').evaluate(el=>el.getBoundingClientRect().top);
    assert.ok(top>=0&&top<=17,`${route}: sticky nav at ${width}`);
    for(const href of await page.locator('.page-section-nav a[href^="#"]').evaluateAll(nodes=>nodes.map(el=>el.getAttribute('href')))) assert.equal(await page.locator(href).count(),1,`${route}: ${href}`);
   }
  }
  await page.goto(base+'/about');
  const heading=await page.locator('#story-title').evaluate(el=>({font:getComputedStyle(el).fontFamily,color:getComputedStyle(el).color}));
  assert.match(heading.font,/Kaftan Calligraphy/);assert.equal(heading.color,'rgb(229, 36, 119)');
  await page.screenshot({path:'/private/tmp/ttngh-about-desktop.png',fullPage:true});
  await page.setViewportSize({width:390,height:844});
  await page.locator('.compact-menu summary').click();assert.equal(await page.locator('.compact-menu-panel').isVisible(),true);await page.keyboard.press('Escape');
  await page.goto(base+'/cms');assert.match(await page.locator('meta[name="robots"]').getAttribute('content'),/noindex/);
  await page.goto(base+'/contact');
  const submit=page.locator('[data-contact-form] button[type="submit"]');
  if(fixture) {
   assert.equal(securityLoads,0);assert.equal(await submit.isDisabled(),true);
   await page.locator('[data-load-verification]').click();await page.waitForFunction(()=>window.testVerification);
   await submit.click();assert.equal(deliveries,0);
   await page.locator('[name="name"]').fill('Test sender');await page.locator('[name="email"]').fill('test@example.org');await page.locator('[name="topic"]').selectOption({label:'Other enquiry'});await page.locator('[name="message"]').fill('Non-sensitive synthetic enquiry for local QA.');await page.locator('[name="consent"]').check();
   await page.evaluate(()=>window.testVerification['expired-callback']());assert.equal(await submit.isDisabled(),true);
   await page.evaluate(()=>window.testVerification.callback('fixture-token'));await submit.click();await page.waitForFunction(()=>document.querySelector('[data-form-status]').textContent.includes('has been sent'));
   assert.equal(deliveries,1);assert.equal(await page.locator('[name="message"]').inputValue(),'');assert.equal(await page.locator('[data-form-status]').evaluate(el=>el===document.activeElement),true);
   await page.locator('[name="name"]').fill('Test sender');await page.locator('[name="email"]').fill('test@example.org');await page.locator('[name="topic"]').selectOption({label:'Other enquiry'});await page.locator('[name="message"]').fill('Non-sensitive synthetic enquiry for outage QA.');await page.locator('[name="consent"]').check();
   fail=true;await page.evaluate(()=>window.testVerification.callback('fixture-token'));await submit.click();await page.waitForFunction(()=>document.querySelector('[data-form-status]').textContent.includes('could not be confirmed'));
   assert.equal(deliveries,2);assert.notEqual(await page.locator('[name="message"]').inputValue(),'');
  } else {
   assert.equal(await submit.isDisabled(),true);
   assert.equal(await page.locator('[data-contact-form] fieldset').evaluate(el=>el.disabled),true);
   for (const name of ['name','email','topic','message','consent']) assert.equal(await page.locator(`[data-contact-form] [name="${name}"]`).isDisabled(),true);
  }
  assert.deepEqual(errors,[]);
  await page.emulateMedia({reducedMotion:'no-preference'});
  await page.goto(base+'/about');
  const link=page.locator('.page-section-nav a').first();
  const button=page.locator('.header-search');
  await page.setViewportSize({width:1440,height:900});
  for(const control of [link,button]) {
   await control.hover();await page.waitForTimeout(700);
   assert.notEqual(await control.evaluate(el=>getComputedStyle(el).filter),'none','hover feedback');
   await control.focus();assert.notEqual(await control.evaluate(el=>getComputedStyle(el).outlineStyle),'none','focus feedback');
  }
  await page.emulateMedia({reducedMotion:'reduce'});
  assert.equal(await link.evaluate(el=>getComputedStyle(el).transitionDuration),'0s');
  console.log(`PASS: ${routes.length} routes at four widths, sticky navigation, Iconsax, H2 font/colour, in-page links, mobile menu, CMS noindex; ${fixture?'mock form success/expiry/outage':'unconfigured form disabled'}.`);
 } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1});
