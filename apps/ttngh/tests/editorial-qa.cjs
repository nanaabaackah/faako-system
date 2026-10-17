// Local-only visual/structural QA. Screenshots are generated artifacts, not source assets.
const assert = require('node:assert/strict');
const {mkdirSync,writeFileSync} = require('node:fs');
const {chromium} = require('playwright');
const base = process.env.TTNGH_QA_URL || 'http://127.0.0.1:5177';
if (!['localhost','127.0.0.1'].includes(new URL(base).hostname)) throw Error('Local QA only');
const out = process.env.TTNGH_QA_OUTPUT || '/private/tmp/ttngh-editorial-qa';
mkdirSync(out,{recursive:true});
const routes = ['/', '/about', '/programmes', '/events', '/impact', '/team', '/get-involved', '/support-us', '/news', '/resources', '/contact', '/cms', '/privacy', '/terms', '/404'];
(async()=>{
 const browser = await chromium.launch({headless:true});
 const failures=[],errors=[],views=[],accessibility=[];
 try {
  const context = await browser.newContext({reducedMotion:'reduce'});
  // Browser checks must not submit enquiries or load analytics.
  await context.route('**/*',route=>new URL(route.request().url()).origin===new URL(base).origin?route.continue():route.abort());
  const page = await context.newPage();
  page.on('pageerror',e=>errors.push(e.message));
  for(const width of [320,390,430,768,1024,1440]) {
   await page.setViewportSize({width,height:900});
   for(const route of routes) {
    await page.goto(base+route,{waitUntil:'domcontentloaded'});
    await page.evaluate(()=>document.fonts.ready);
    const result=await page.evaluate(()=>({
     h1:document.querySelectorAll('h1').length,
     headers:document.querySelectorAll('.site-header').length,
     heroTop:document.querySelector('main > .page-hero, .error-page')?.getBoundingClientRect().top,
     overflow:document.documentElement.scrollWidth>innerWidth+1,
     missingAlt:[...document.images].filter(i=>!i.hasAttribute('alt')).length,
     brokenAnchors:[...document.querySelectorAll('main a[href^="#"]')].map(a=>a.getAttribute('href')).filter(h=>h.length>1&&!document.getElementById(h.slice(1))),
     heading:getComputedStyle(document.querySelector('main h2')||document.querySelector('h1')).fontFamily
    }));
    if(result.h1!==1||result.headers!==1||result.heroTop>1||result.overflow||result.missingAlt||result.brokenAnchors.length)failures.push({width,route,...result});
    await page.evaluate(()=>scrollTo({top:1400,behavior:'instant'}));
    const nav=await page.locator('.site-header').evaluate(el=>el.getBoundingClientRect().top);
    if(nav<0||nav>40) failures.push({width,route,stickyTop:nav});
    await page.evaluate(()=>scrollTo({top:0,behavior:'instant'}));
    if([390,1440].includes(width)&&['/','/about','/events','/contact','/cms','/404'].includes(route)) {
     const essential=page.getByRole('button',{name:'Essential only',exact:true});
     if(await essential.isVisible()) await essential.click();
     await page.evaluate(async()=>{ for(const i of document.images)i.loading='eager'; await Promise.all([...document.images].map(i=>i.decode().catch(()=>{}))); });
     await page.screenshot({path:out+'/'+(route.slice(1)||'home')+'-'+width+'.png',fullPage:true});
     views.push({width,route});
     if(process.env.TTNGH_AXE_PATH) {
       await page.addScriptTag({path:process.env.TTNGH_AXE_PATH});
       const results=await page.evaluate(()=>axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa']}}));
       accessibility.push({width,route,violations:results.violations.map(v=>({id:v.id,impact:v.impact,description:v.description,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary}))}))});
     }
    }
   }
   console.log('Checked '+routes.length+' routes at '+width+'px');
  }
  await page.goto(base+'/about');
  const summary=page.locator('.faq-list summary').first();
  await summary.focus();await page.keyboard.press('Enter');
  assert.equal(await summary.evaluate(el=>el.parentElement.open),true);
  await page.keyboard.press('Space');
  assert.equal(await summary.evaluate(el=>el.parentElement.open),false);
  await page.setViewportSize({width:390,height:844});
  await page.locator('.compact-menu summary').click();
  assert.equal(await page.locator('.compact-menu-panel').isVisible(),true);
  await page.keyboard.press('Escape');
  await page.goto(base+'/events');
  assert.equal(await page.locator('.photo-ribbon-clone').getAttribute('aria-hidden'),'true');
  assert.equal(await page.locator('.photo-ribbon-clone').isVisible(),false);
  await page.emulateMedia({reducedMotion:'no-preference'});
  const toggle=page.locator('[data-ribbon-toggle]');
  await toggle.click();
  assert.equal(await toggle.getAttribute('aria-pressed'),'true');
  await page.locator('.scroll-expand a').focus();
  assert.equal(await page.locator('.scroll-expand__overlay').evaluate(el=>Number(getComputedStyle(el).opacity)),1);
  await page.goto(base+'/');
  assert.equal(await page.locator('.month-calendar,.home-calendar').count(),0);
  await page.goto(base+'/cms');
  assert.match(await page.locator('meta[name="robots"]').getAttribute('content'),/noindex/);
  const report={routes:routes.length,widths:[320,390,430,768,1024,1440],failures,errors,screenshots:views,accessibility,checks:['H1','overflow','image alt','in-page links','sticky nav','FAQ keyboard','mobile menu','reduced-motion gallery','gallery pause','Scroll Expand focus','homepage no month calendar','CMS noindex']};
  writeFileSync(out+'/results.json',JSON.stringify(report,null,2));
  console.log(JSON.stringify(report,null,2));
  assert.deepEqual(failures,[]);assert.deepEqual(errors,[]);
  assert.deepEqual(accessibility.filter(result=>result.violations.length),[], 'Accessibility violations must be resolved');
 } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exitCode=1});
