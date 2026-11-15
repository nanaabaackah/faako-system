
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
<meta name="theme-color" content="#071438">
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
    <p class="lead">A little more you. Coming soon.</p>
    <h1 id="message-title">The best journeys are worth the wait.</h1>
    <p class="intro">Our website is getting ready for its next adventure.</p>
    <p class="detail">We're creating a more personal way to explore the world. Until then, we're still here to help you plan your next journey.</p>
    <nav class="actions" aria-label="Contact Travel With Ease">
      <a class="primary" href="https://wa.me/233208387020" target="_blank" rel="noopener noreferrer">Chat on WhatsApp <span aria-hidden="true">↗</span></a>
      <a class="secondary" href="mailto:nana@travelwitheasegh.com">Send us an email</a>
    </nav>
  </section>
  <footer class="footer">Travel With Ease <span aria-hidden="true">·</span> Accra, Ghana</footer>
</div>
</main>
</body>
</html>`;

const css = `:root{color-scheme:dark}
*{box-sizing:border-box}
html{min-height:100%}
body{margin:0;min-width:280px;font-family:Inter,Arial,sans-serif;color:#fffaf1;background:#071438}
a:focus-visible{outline:3px solid #e9c78f;outline-offset:5px}
.holding{position:relative;isolation:isolate;min-height:100svh;overflow:hidden;background:#071438}
.photography,.shade{position:absolute;inset:0;width:100%;height:100%;z-index:-1}
.photography img{display:block;width:100%;height:100%;object-fit:cover;object-position:center 48%}
.shade{background:linear-gradient(180deg,rgba(4,13,37,.76),rgba(4,13,37,.8) 60%,#071438)}
.content{width:min(100% - 48px,1120px);min-height:100svh;margin:auto;display:grid;grid-template-rows:auto 1fr auto;align-items:center;text-align:center;gap:2rem}
.brand{padding-top:clamp(2rem,5vh,4rem)}
.brand img{width:clamp(155px,23vw,225px);height:auto;display:block;margin:auto}
.message{max-width:900px;margin:0 auto;padding:2rem 0}
.lead{margin:0 0 2rem;color:#f0d3a4;font-size:clamp(.75rem,1.5vw,.92rem);font-weight:600;letter-spacing:.15em;text-transform:uppercase}
h1{max-width:16ch;margin:0 auto 1.7rem;font-family:Georgia,serif;font-size:clamp(3rem,7.3vw,6.4rem);font-weight:400;line-height:1.06;letter-spacing:-.045em;text-wrap:balance}
.intro{font-size:clamp(1.1rem,2.1vw,1.5rem);line-height:1.55;margin:0 auto 1rem;font-weight:500}
.detail{max-width:47ch;margin:0 auto;color:#e9e8e4;font-size:clamp(.98rem,1.45vw,1.08rem);line-height:1.75}
.actions{margin:2.5rem auto 0;display:flex;flex-wrap:wrap;justify-content:center;align-items:center;gap:.9rem 1.6rem}
.actions a{min-height:48px;padding:13px 21px;display:inline-flex;align-items:center;justify-content:center;gap:.8rem;text-decoration:none;border-radius:999px;font-size:.94rem;font-weight:600}
.primary{background:#edcf9d;color:#091735;border:1px solid #edcf9d}
.primary:hover{background:#fff1d8}
.secondary{color:#fffaf1;border:1px solid rgba(255,250,241,.67)}
.secondary:hover{background:rgba(255,250,241,.13)}
.footer{padding:0 0 max(2rem,env(safe-area-inset-bottom));display:flex;gap:.8rem;align-items:center;justify-content:center;color:#dfd9ce;font-size:.78rem;letter-spacing:.045em}
@media(max-width:640px){.content{width:min(100% - 36px,480px);gap:1rem}.photography img{object-position:center 55%}.lead{margin-bottom:1.3rem}h1{font-size:clamp(2.75rem,11vw,4.2rem)}.actions{flex-direction:column;align-items:stretch;gap:.85rem;max-width:360px}.actions a{width:100%;min-height:52px}.footer{font-size:.75rem}}
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
    "  Content-Security-Policy: default-src 'none'; base-uri 'none'; object-src 'none'; frame-ancestors 'none'; img-src 'self'; style-src 'self'; font-src 'self'; form-action 'none'",
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
