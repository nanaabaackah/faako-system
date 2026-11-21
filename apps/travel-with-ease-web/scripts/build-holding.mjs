
import { copyFile, mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const assets = [
  ["brand/Primary gold.png", "brand/logo.png"],
  ["media/kenya-pelicans-9944212dcee2-1280.webp", "media/hero.webp"],
  ["media/zanzibar-pool-da78a2948608-640.webp", "media/mobile.webp"],
  ["favicon.ico", "favicon.ico"],
];

const html = `<!doctype html>
<html lang="en-GH">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#010c33">
<meta name="robots" content="noindex, nofollow, noarchive">
<meta name="googlebot" content="noindex, nofollow, noarchive">
<meta name="description" content="Travel With Ease is preparing a new website. We're still here to help plan your next journey.">
<meta property="og:site_name" content="Travel With Ease">
<meta property="og:title" content="Coming Soon | Travel With Ease">
<meta property="og:description" content="Our new website is on its way. Contact us for personalised travel planning.">
<meta property="og:type" content="website">
<meta property="og:url" content="https://travelwitheasegh.com/">
<title>Coming Soon | Travel With Ease</title>
<link rel="icon" href="/favicon.ico">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@700;800&amp;family=Poiret+One&amp;family=Quicksand:wght@400;500;600;700&amp;family=Sassy+Frass&amp;display=swap">
<link rel="stylesheet" href="/holding.css">
</head>
<body>
<main class="holding">
<picture class="photography" aria-hidden="true">
  <source media="(max-width:640px)" srcset="/media/mobile.webp" type="image/webp">
  <img src="/media/hero.webp" alt="" width="1280" height="860" fetchpriority="high">
</picture>
<div class="shade" aria-hidden="true"></div>
<div class="content">
  <header class="brand"><img src="/brand/logo.png" width="600" height="200" alt="Travel With Ease"></header>
  <section class="message" aria-labelledby="message-title">
    <h1 id="message-title">The best journeys are worth the wait.</h1>
    <p class="signature">A Little More You</p>
    <p class="intro">Our website is currently under construction.</p>
    <p class="detail">We're creating a more personal way to explore the world. Until then, we're still here to help you plan your next journey.</p>
    <nav class="actions" aria-label="Contact Travel With Ease">
      <a class="primary" href="https://wa.me/233208387020" target="_blank" rel="noopener noreferrer">Chat on WhatsApp <svg class="action-icon" aria-hidden="true" focusable="false" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17 17 7M7 7h10v10"/></svg></a>
      <a class="secondary" href="mailto:info@travelwitheasegh.com">Send us an email</a>
    </nav>
  </section>
  <footer class="footer">Travel With Ease <span class="footer-divider" aria-hidden="true"></span> Accra, Ghana</footer>
</div>
</main>
</body>
</html>`;

const css = `
:root {color-scheme:dark;--brand-navy:#010c33;--brand-cream:#f4ede3;--brand-gold:#d8b56a;--brand-ink:#000a1f;--twe-radius-button:6px;--font-display:"Poiret One","Trebuchet MS",Arial,sans-serif;--font-body:"Quicksand","Trebuchet MS",Arial,sans-serif;--font-impact:"Inter",Arial,sans-serif;--font-signature:"Sassy Frass",cursive}
*{box-sizing:border-box}
html{min-height:100%}
body{margin:0;min-width:280px;font-family:var(--font-body);font-size:1rem;line-height:1.65;color:var(--brand-cream);background:var(--brand-navy)}
a:focus-visible{outline:3px solid var(--brand-gold);outline-offset:4px}
.holding{position:relative;isolation:isolate;min-height:100svh;overflow:hidden;background:var(--brand-navy)}
.photography,.shade{position:absolute;inset:0;width:100%;height:100%;z-index:-1}
.photography img{display:block;width:100%;height:100%;object-fit:cover;object-position:65% 60%}
.shade{background:linear-gradient(180deg,rgb(0 10 31 / 70%) 0%,rgb(0 10 31 / 78%) 60%,var(--brand-ink) 100%)}
.content{width:min(100% - 48px,1120px);min-height:100svh;margin:auto;display:grid;grid-template-rows:auto 1fr auto;align-items:center;text-align:center;gap:2rem}
.brand{padding-top:clamp(1.5rem,4vh,3rem)}
.brand img{width:clamp(140px,18vw,165px);height:auto;display:block;margin-inline:auto}
.message{width:100%;max-width:940px;margin:0 auto;padding:2rem 0}
h1{max-width:24ch;margin:0 auto;font-family:var(--font-display);font-size:clamp(2.4rem,4.35vw,4.5rem);font-weight:400;line-height:1.12;letter-spacing:-.025em;-webkit-text-stroke:.03em currentColor;paint-order:stroke fill;text-wrap:balance}
.signature{margin:.2em 0 .25em;font-family:var(--font-signature);font-size:clamp(4rem,10vw,9.5rem);font-weight:400;line-height:1.08;letter-spacing:0;color:var(--brand-gold);text-wrap:balance}
.intro{max-width:48ch;margin:0 auto .75rem;font-size:clamp(1.08rem,1.5vw,1.25rem);font-weight:600;line-height:1.5}
.detail{max-width:48ch;margin:0 auto;color:var(--brand-cream);font-size:clamp(1rem,1.3vw,1.12rem);line-height:1.75}
.actions{margin:2rem auto 0;display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:1rem 1.2rem}
.actions a{display:inline-flex;align-items:center;justify-content:center;gap:.65rem;min-height:48px;padding:13px 20px;border:1px solid var(--brand-cream);border-radius:var(--twe-radius-button);font-family:var(--font-impact);font-size:.875rem;font-weight:800;line-height:1.2;text-decoration:none;transition:background-color .15s ease,color .15s ease,border-color .15s ease}
.primary{background:var(--brand-cream);color:var(--brand-ink)}
.primary:is(:hover,:focus-visible){background:var(--brand-gold);border-color:var(--brand-gold)}
.secondary{background:transparent;color:var(--brand-cream)}
.secondary:is(:hover,:focus-visible){background:var(--brand-cream);color:var(--brand-navy)}
.action-icon{width:18px;height:18px;flex:0 0 18px}
.footer{padding:0 0 max(2rem,env(safe-area-inset-bottom));display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:.9rem;font-family:var(--font-body);font-size:.875rem;font-weight:500;color:var(--brand-cream)}
.footer-divider{width:1px;height:1rem;background:var(--brand-gold)}
@media(max-width:640px){.content{width:min(100% - 36px,480px);gap:1rem}.photography img{object-position:center 58%}.shade{background:linear-gradient(180deg,rgb(0 10 31 / 78%),rgb(0 10 31 / 85%) 65%,var(--brand-ink))}h1{font-size:clamp(2.3rem,9.5vw,3.45rem)}.signature{font-size:clamp(4.25rem,19vw,6.25rem);line-height:1.05}.actions{flex-direction:column;align-items:stretch;width:min(100%,390px);gap:12px}.actions a{width:100%;min-height:52px}}
@media(prefers-reduced-motion:reduce){.actions a{transition:none}}
`;


export async function buildHoldingPage({
  rootDirectory = root,
  outputDirectory = path.join(rootDirectory, "dist"),
} = {}) {
  // This publishes only a small allowlisted artifact, with no normal public
  // routes, CMS snapshot, API client, analytics, scripts or active forms.
  await rm(outputDirectory, { recursive: true, force: true });
  await mkdir(outputDirectory, { recursive: true });
  for (const [source, dest] of assets) {
    const target = path.join(outputDirectory, dest);
    await mkdir(path.dirname(target), { recursive: true });
    await copyFile(path.join(rootDirectory, "public", source), target);
  }
  const headers = [
    "/*",
    "  X-Robots-Tag: noindex, nofollow, noarchive",
    "  Cache-Control: no-store",
    "  Content-Security-Policy: default-src 'none'; base-uri 'none'; object-src 'none'; frame-ancestors 'none'; img-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; connect-src 'none'; form-action 'none'",
    "  Referrer-Policy: strict-origin-when-cross-origin",
    "  X-Content-Type-Options: nosniff",
    "  X-Frame-Options: DENY",
    "  Permissions-Policy: camera=(), geolocation=(), microphone=(), payment=()",
    "",
  ].join("\n");
  await Promise.all([
    writeFile(path.join(outputDirectory, "index.html"), html),
    writeFile(path.join(outputDirectory, "404.html"), html),
    writeFile(path.join(outputDirectory, "holding.css"), css),
    writeFile(path.join(outputDirectory, "_headers"), headers),
    writeFile(path.join(outputDirectory, "_redirects"), "/* /index.html 200\n"),
    // Keep crawlers able to see the explicit noindex directives.
    writeFile(path.join(outputDirectory, "robots.txt"), "User-agent: *\nAllow: /\n"),
  ]);
  console.info("TWE production holding page built: standalone, no API dependency.");
}
