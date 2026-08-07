/* eslint-disable no-undef */
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const appRoot = fileURLToPath(new URL("..", import.meta.url));
const outputRoot = join(appRoot, "dist", "storefront");
const siteUrl = "https://stroanesolutions.com";
const defaultImage = `${siteUrl}/assets/logos/logo_long.png`;
const template = await readFile(join(outputRoot, "index.html"), "utf8");
const catalogue = JSON.parse(
  await readFile(join(appRoot, "src", "data", "stroaneCatalogue.json"), "utf8"),
);

const escapeHtml = (value) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");

const escapeScriptJson = (value) =>
  JSON.stringify(value).replaceAll("<", "\\u003c");

const replaceMeta = (html, selector, content) => {
  const escaped = escapeHtml(content);
  const pattern = new RegExp(`(<meta\\s+${selector}\\s+content=")[^"]*(")`, "i");
  return pattern.test(html)
    ? html.replace(pattern, `$1${escaped}$2`)
    : html.replace("</head>", `  <meta ${selector} content="${escaped}" />\n  </head>`);
};

const replaceCanonical = (html, href) =>
  html.replace(
    /<link\s+rel="canonical"\s+href="[^"]*"\s*\/?>/i,
    `<link rel="canonical" href="${escapeHtml(href)}" />`,
  );

const renderRoute = ({
  path,
  title,
  description,
  noIndex = false,
  type = "website",
  image = defaultImage,
  schema,
}) => {
  const canonical = `${siteUrl}${path === "/" ? "/" : path}`;
  let html = template.replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(title)}</title>`);
  html = replaceMeta(html, 'name="description"', description);
  html = replaceMeta(html, 'name="robots"', noIndex ? "noindex, nofollow" : "index, follow");
  html = replaceMeta(html, 'property="og:title"', title);
  html = replaceMeta(html, 'property="og:description"', description);
  html = replaceMeta(html, 'property="og:type"', type);
  html = replaceMeta(html, 'property="og:url"', canonical);
  html = replaceMeta(html, 'property="og:image"', image);
  html = replaceMeta(html, 'name="twitter:title"', title);
  html = replaceMeta(html, 'name="twitter:description"', description);
  html = replaceMeta(html, 'name="twitter:image"', image);
  html = replaceCanonical(html, canonical);
  if (schema) {
    html = html.replace(
      "</head>",
      `  <script type="application/ld+json">${escapeScriptJson(schema)}</script>\n  </head>`,
    );
  }
  return html;
};

const routes = [
  {
    path: "/",
    title: "Stroane | Food Safety Advisory & Compliance Ghana",
    description: "Stroane helps food businesses, manufacturers, and institutions in Ghana strengthen food safety, compliance, and operations.",
    schema: {
      "@context": "https://schema.org",
      "@type": "Organization",
      name: "Stroane",
      url: `${siteUrl}/`,
      logo: defaultImage,
    },
  },
  { path: "/about", title: "About Stroane | Food Safety Support Ghana", description: "Learn about Stroane's food safety advisory, compliance, training, and supply work in Ghana." },
  { path: "/services", title: "Food Safety Services Ghana | Stroane", description: "Explore Stroane's food safety advisory, compliance support, training, and operational services." },
  { path: "/catalogue", title: "Stroane Product Catalogue", description: "Browse Stroane food safety equipment and operational supplies for businesses in Ghana." },
  { path: "/shop", title: "Food Safety Equipment & Supplies Ghana | Stroane Store", description: "Browse thermometers, hygiene supplies, cold-chain equipment, and food safety resources available from Stroane." },
  { path: "/products", title: "Stroane Products", description: "Browse Stroane's public catalogue of food safety and operational products." },
  { path: "/resources", title: "Food Safety Resources | Stroane", description: "Read practical answers and resources about food safety, compliance, and safer operations." },
  { path: "/contact", title: "Contact Stroane", description: "Contact Stroane about food safety advisory, supplies, partnerships, or product enquiries." },
  { path: "/terms", title: "Terms | Stroane", description: "Read the terms that apply when using Stroane's website and services." },
  { path: "/privacy", title: "Privacy | Stroane", description: "Read how Stroane handles website and service information." },
  { path: "/cookies", title: "Cookie Policy | Stroane", description: "Read how Stroane uses essential and optional website cookies." },
  { path: "/sitemap", title: "Website Sitemap | Stroane", description: "Browse links to Stroane's public website pages." },
  { path: "/search", title: "Search | Stroane", description: "Search Stroane services, resources, and products.", noIndex: true },
  { path: "/checkout", title: "Checkout | Stroane", description: "Review and submit a Stroane order request securely.", noIndex: true },
  { path: "/checkout/return", title: "Payment Status | Stroane", description: "Check the status of a Stroane checkout payment.", noIndex: true },
  { path: "/account", title: "Customer Account | Stroane", description: "Access your Stroane customer account.", noIndex: true },
  { path: "/orders", title: "Customer Orders | Stroane", description: "Access your Stroane customer orders.", noIndex: true },
  { path: "/quotes", title: "Customer Quotes | Stroane", description: "Access your Stroane customer quotes.", noIndex: true },
  { path: "/sign", title: "Customer Sign In | Stroane", description: "Sign in to the Stroane customer area.", noIndex: true },
  { path: "/signup", title: "Create Customer Account | Stroane", description: "Create a Stroane customer account.", noIndex: true },
  { path: "/forgot-password", title: "Reset Password | Stroane", description: "Request a Stroane customer password reset.", noIndex: true },
  { path: "/reset-password", title: "Set New Password | Stroane", description: "Set a new Stroane customer password.", noIndex: true },
];

for (const product of catalogue.products || []) {
  const isPublic = typeof product.price === "number" && product.quoteOnly !== true;
  const path = `/products/${encodeURIComponent(product.id)}`;
  const image = product.imageUrl || product.image || "/imgs/products/product-placeholder.webp";
  routes.push({
    path,
    title: `${product.name} | Stroane Store`,
    description: product.description || `${product.name} from Stroane's food safety catalogue.`,
    noIndex: !isPublic,
    type: "product",
    image: image.startsWith("http") ? image : `${siteUrl}${image}`,
    schema: isPublic
      ? {
          "@context": "https://schema.org",
          "@type": "Product",
          name: product.name,
          description: product.description,
          sku: product.sku,
          category: product.category,
          image: image.startsWith("http") ? image : `${siteUrl}${image}`,
          offers: {
            "@type": "Offer",
            priceCurrency: product.currency || "GHS",
            price: product.price,
            url: `${siteUrl}${path}`,
          },
        }
      : undefined,
  });
}

for (const route of routes) {
  const target = route.path === "/"
    ? join(outputRoot, "index.html")
    : join(outputRoot, route.path.slice(1), "index.html");
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, renderRoute(route), "utf8");
}

const sitemapRoutes = routes.filter((route) => !route.noIndex);
const sitemap = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  ...sitemapRoutes.map(
    (route) => `  <url><loc>${siteUrl}${route.path === "/" ? "/" : route.path}</loc></url>`,
  ),
  "</urlset>",
  "",
].join("\n");
await writeFile(join(outputRoot, "sitemap.xml"), sitemap, "utf8");
await rm(join(outputRoot, "stroane-portal-sw.js"), { force: true });

console.log(`Finalized ${routes.length} Stroane storefront route shells (${sitemapRoutes.length} indexable).`);
