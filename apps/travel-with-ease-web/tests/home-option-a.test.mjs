import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (relative) => readFileSync(new URL(relative, import.meta.url), "utf8");
const home = read("../src/components/PublishedHome.astro");
const services = read("../src/components/HomeServices.astro");
const process = read("../src/components/JourneyProcess.astro");
const tips = read("../src/components/TravelTips.astro");
const css = read("../src/styles/components/home-option-a.css");
const stepper = read("../src/components/HomeJourneyStepper.jsx");
const serviceTicket = read("../src/components/ServiceTicketCard.jsx");
const ticketSkin = read("../src/styles/components/service-ticket.css");
const reactBitsTilt = read("../src/components/reactbits/TiltedCard.jsx");
const stepperSkin = read("../src/styles/components/home-journey-stepper.css");
const reactBits = read("../src/components/reactbits/Stepper.jsx");
const globalCSS = read("../src/styles/global.css");
const controlsCSS = read("../src/styles/components/public-controls.css");
const navigationCSS = read("../src/styles/components/scroll-navigation.css");

test("Option A changes four editorial homepage sections only", () => {
  assert.match(home, /journey-introduction--option-a/);
  assert.match(services, /home-services--option-a/);
  assert.match(process, /"journey-process--option-a": !page/);
  assert.match(tips, /"travel-tips--option-a": homepage/);
  assert.match(home, /import "\.\.\/styles\/components\/home-option-a\.css";/);

  const activeCSS = css.replace(/\/\*[\s\S]*?\*\//g, "");
  assert.doesNotMatch(activeCSS, /\.cream-footprint|\.footprint-totals|\.travel-footprint|\.site-header|\.cinematic-hero|\.featured-journeys|\.closing-cta|\.twe-public-footer/);
  assert.doesNotMatch(css, /\.eyebrow|text-transform:\s*uppercase/);
});

test("protected hero, packages, footprint and closing CTA are preserved", () => {
  assert.match(home, /<CinematicHero heading=\{content\.heading\} body=\{content\.body\} image=\{content\.image\} placement=\{content\.imagePlacements\?\.hero\} \/>/);
  assert.match(home, /\{packages\?\.packages\?\.length > 0 && <FeaturedJourneys items=\{packages\.packages\} \/>\}/);
  assert.match(home, /<section id="our-world" class="cream-footprint">[\s\S]*?<TravelFootprint heading=\{footprint\?\.heading\} description=\{footprint\?\.body\}>/);
  assert.match(home, /footprint\.entries\.map/);
  assert.match(home, /<ClosingCta enquiryAvailable=\{Boolean\(contact\)\} \/>/);
  assert.ok(home.indexOf("<TravelFootprint") < home.indexOf("<TravelTips"), "Footprint stays before tips");
  assert.equal((home.match(/<TravelFootprint/g) || []).length, 1);
});

test("About uses the approved story content and available media, without new claims", () => {
  assert.match(home, /<h2>\{about\.heading\}<\/h2>/);
  assert.match(home, /<p>\{about\.body\}<\/p>/);
  assert.match(home, /<EditorialPhoto[\s\S]*?image=\{about\.image\}/);
  assert.match(home, /\{about\.image && \(/);
  assert.match(home, /<ContentLink href="\/about">Meet Travel With Ease<\/ContentLink>/);
});

test("services keep published labels, prices, currency formatting and direct links", () => {
  assert.match(services, /entries\.map\(\(entry, index\) =>/);
  assert.match(services, /serviceSlug\(entry\.heading\)/);
  assert.match(services, /price=\{price\}/);
  assert.match(services, /summary=\{summary\}/);
  assert.match(services, /<CurrencyAttribution \/>/);
  assert.match(services, /<ul class="home-services__list">/);
  assert.doesNotMatch(services, /home-services__number|padStart\(2/);
  assert.match(css, /\.home-services--option-a \.home-services__list[\s\S]*?grid-template-columns: repeat\(2/);
});

test("process keeps all approved steps and detailed page layout separate", () => {
  assert.match(process, /content\.entries\.map\(\(step, index\) =>/);
  assert.match(process, /steps=\{content\.entries\.map/);
  assert.match(process, /summaries\[index\] \|\| step\.text/);
  assert.match(process, /"planning-process": page/);
  assert.match(process, /<HomeJourneyStepper[\s\S]*?client:visible/);
  assert.match(process, /<noscript>[\s\S]*?journey-process__fallback/);
  assert.match(css, /grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
});

test("travel tips use approved articles and original non-homepage behavior", () => {
  assert.match(tips, /const items = homepage \? ordered\.slice\(0, 3\) : ordered;/);
  assert.match(tips, /"travel-tips--option-a": homepage/);
  assert.match(tips, /href=\{`\/travel-tips\/\$\{tip\.slug\}`\}/);
  assert.match(tips, /\{tip\.excerpt\}/);
  assert.match(css, /\.travel-tips--option-a \.travel-tips__grid[\s\S]*?repeat\(3, minmax\(0, 1fr\)\)/);
  assert.match(css, /font-family: var\(--font-journal\) !important/);
});

test("responsive cards and editorial layouts retain single-column mobile reflow", () => {
  assert.match(css, /@media \(max-width: 760px\)/);
  assert.match(css, /@media \(max-width: 480px\)/);
  assert.match(css, /\.journey-introduction--option-a \.journey-introduction__inner/);
  assert.match(css, /\.home-services--option-a \.home-services__list/);
  assert.match(css, /\.travel-tips--option-a \.travel-tips__grid/);
});

test("React Bits stepper uses original CMS copy, accessible controls and TWE styling", () => {
  assert.match(stepper, /import Stepper, \{ Step \} from "\.\/reactbits\/Stepper\.jsx"/);
  assert.match(stepper, /steps\.map\(\(entry, index\) =>/);
  assert.match(stepper, /accentColor="#010c33"/);
  assert.match(stepper, /frame=\{false\}/);
  assert.match(stepper, /theme="light"/);
  assert.match(stepper, /href="#plan"/);
  assert.match(stepperSkin, /--twe-radius-button/);
  assert.match(stepperSkin, /--font-display/);
  assert.match(reactBits, /@hugeicons\/react/);
  assert.match(reactBits, /@hugeicons\/core-free-icons/);
});
test("all public controls and surface families use compact, shared radius tokens", () => {
  assert.match(globalCSS, /--twe-radius-button: 6px/);
  assert.match(globalCSS, /--twe-radius-card: 8px/);
  assert.match(globalCSS, /--twe-radius-control: 6px/);
  assert.match(controlsCSS, /border-radius: var\(--twe-radius-control\)/);
  assert.match(navigationCSS, /border-radius: var\(--twe-radius-nav\)/);
  assert.doesNotMatch(css, /home-services__number/);
});

test("services use the real React Bits ticket demo, preserving published content and access", () => {
  assert.match(services, /servicePhotos = \[photography\.park, photography\.coast, photography\.garden, photography\.elephants\]/);
  assert.match(services, /cardImage = entry\.imagePlacement\?\.image \|\| servicePhotos/);
  assert.match(services, /<ServiceTicketCard[\s\S]*?client:load/);
  assert.match(services, /href=\{`\/services\/\$\{serviceSlug\(entry\.heading\)\}`\}/);
  assert.match(services, /description=\{entry\.text\}/);
  assert.match(serviceTicket, /import TiltedCard, \{ TiltedCardLayer \} from "\.\/reactbits\/TiltedCard\.jsx"/);
  assert.match(serviceTicket, /moneySegments\(text\)/);
  assert.match(serviceTicket, /data-twe-money=\{segment\.minor\}/);
  assert.match(serviceTicket, /backContent=\{/);
  assert.match(serviceTicket, /rotateAmplitude=\{9\}/);
  assert.match(serviceTicket, /glare=\{0\.22\}/);
  assert.match(serviceTicket, /flipped=\{flipped\}/);
  assert.match(serviceTicket, /<a[\s\S]*?href=\{href\}[\s\S]*?className="twe-ticket__link"/);
  assert.match(serviceTicket, /import \{ ArrowRight4 \} from "@faako\/ui"/);
  assert.match(serviceTicket, /<h3><a href=\{href\}>\{title\}<\/a><\/h3>/);
  assert.match(serviceTicket, /aria-label=\{`View \$\{title\} details`\}/);
  assert.match(serviceTicket, /aria-label=\{`Back to \$\{title\} ticket`\}/);
  assert.match(serviceTicket, /aria-label=\{`Explore \$\{title\} service`\}/);
  assert.match(serviceTicket, /<ArrowRight4 size=\{20\}/);
  assert.doesNotMatch(serviceTicket, /Travel With Ease · Your planning pass|Your journey, your way|twe-ticket__label|twe-ticket__back-label|↗|twe-ticket__monogram|twe-ticket__stub-text/);
  assert.match(ticketSkin, /twe-ticket__main \.twe-ticket__content h3/);
  assert.match(ticketSkin, /twe-ticket__flip--back svg/);
  assert.match(ticketSkin, /twe-ticket__barcode/);
  assert.match(ticketSkin, /-webkit-mask: none/);
  assert.match(ticketSkin, /mask: none/);
  assert.match(ticketSkin, /tilted-card__face::before/);
  assert.match(ticketSkin, /tilted-card__face::after/);
  assert.match(ticketSkin, /background-color: var\(--brand-navy\)/);
  assert.match(ticketSkin, /background-color: var\(--brand-cream\)/);
  assert.match(ticketSkin, /twe-ticket--front \.twe-ticket__main h3 a/);
  assert.match(ticketSkin, /twe-ticket--back \.twe-ticket__back-main h3/);
  assert.match(serviceTicket, /intro=\{false\}/);
  assert.doesNotMatch(ticketSkin, /mask-composite:/);
  assert.match(ticketSkin, /border-left: 1px dashed/);
  assert.match(ticketSkin, /--twe-radius-card/);
  assert.match(reactBitsTilt, /const TiltedCard =/);
  assert.match(css, /twe-service-ticket/);
  assert.match(css, /prefers-reduced-motion: reduce/);
});
