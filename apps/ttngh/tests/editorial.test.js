import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { verifiedImpact } from "../src/lib/verified-impact.js";
const read = path => readFileSync(new URL(path, import.meta.url), "utf8");
test("empty CMS team shows an explanation without silently republishing repository profiles", () => {
  const grid = read("../src/components/TeamGrid.astro");
  assert.match(grid, /team.length > 0/);
  assert.match(grid, /class="team-empty"/);
  assert.match(grid, /href="\/contact"/);
  const source = read("../src/content/team.js");
  assert.match(source, /cmsConfigured \?/);
  assert.doesNotMatch(source, /team\.length\s*\?|\.length\s*\?\s*.*originalTeam/);
});
test("impact requires a verified value, label, source and measurement period", () => {
  const stat = {value:"10",label:"Test count",period:"Test period",source:"Test source",verificationStatus:"verified"};
  assert.deepEqual(verifiedImpact([stat]),[stat]);
  for(const key of Object.keys(stat)) assert.deepEqual(verifiedImpact([{...stat,[key]:""}]),[]);
  assert.deepEqual(verifiedImpact([{...stat,verificationStatus:"pending"}]),[]);
  assert.deepEqual(verifiedImpact([{value:"1,000+",label:"Unsourced fixture"}]),[]);
  assert.deepEqual(verifiedImpact(),[]);
});
test("home keeps its own hero and a single event feature, not a calendar",()=>{
  const source=read("../src/pages/index.astro");
  assert.match(source,/home-hero/);assert.match(source,/<FeaturedEvent/);
  assert.doesNotMatch(source,/<PageHero|<EventCalendar|<MonthCalendar/);
  assert.equal((source.match(/<ScrollExpandSection/g)||[]).length,1);
});
test("FAQ and photograph ribbon have semantic controls and hidden clones",()=>{
  const faq=read("../src/components/FaqList.astro");
  assert.match(faq,/<details>/);assert.match(faq,/<summary/);assert.match(faq,/aria-controls/);
  assert.doesNotMatch(faq,/bubble-card|glass-card/);
  const ribbon=read("../src/components/EventGalleryRail.astro");
  assert.match(ribbon,/aria-hidden="true" inert/);
  assert.match(ribbon,/aria-pressed/);
  assert.match(ribbon,/prefers-reduced-motion/);
});
