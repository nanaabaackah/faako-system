const SITE_NAME = "REEBS Party Themes";
const SITE_URL = "https://www.reebspartythemes.com";
const DEFAULT_IMAGE = `${SITE_URL}/imgs/promos/banner.jpg`;
const DEFAULT_DESCRIPTION =
  "REEBS Party Themes provides party rentals, decor setup, and party supplies across Ghana with fast delivery and friendly support.";
const DEFAULT_KEYWORDS =
  "kids party rentals Ghana, bouncy castle rental Accra, party decor Tema, party supplies Ghana, event setup services, kids birthday planning";
const DEFAULT_LOCALE = "en_GH";
const DEFAULT_LANGUAGE = "en-GH";
const DEFAULT_TWITTER = "@reebspartythemes_";
const DEFAULT_THEME_COLOR = "#f97316";

const ORGANIZATION_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "Organization",
  "@id": `${SITE_URL}#organization`,
  name: SITE_NAME,
  url: SITE_URL,
  logo: `${SITE_URL}/imgs/brand/reebs_logo2.png`,
  sameAs: [
    "https://www.instagram.com/reebspartythemes_/",
    "https://www.facebook.com/reebspartythemes",
    "https://www.tiktok.com/@reebspartythemes_",
  ],
  contactPoint: [
    {
      "@type": "ContactPoint",
      telephone: "+233244238419",
      contactType: "customer support",
      availableLanguage: ["English"],
    },
  ],
};

const LOCAL_BUSINESS_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "PartySupplyStore",
  "@id": `${SITE_URL}#localbusiness`,
  name: SITE_NAME,
  image: DEFAULT_IMAGE,
  url: SITE_URL,
  telephone: "+233244238419",
  email: "info@reebspartythemes.com",
  address: {
    "@type": "PostalAddress",
    streetAddress: "Sakumono Broadway",
    addressLocality: "Tema",
    addressCountry: "GH",
  },
  openingHoursSpecification: [
    {
      "@type": "OpeningHoursSpecification",
      dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
      opens: "08:30",
      closes: "19:00",
    },
  ],
};

const WEBSITE_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  "@id": `${SITE_URL}#website`,
  name: SITE_NAME,
  url: SITE_URL,
  potentialAction: {
    "@type": "SearchAction",
    target: `${SITE_URL}/shop?search={search_term_string}`,
    "query-input": "required name=search_term_string",
  },
};

const RENTAL_SERVICE_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "Service",
  "@id": `${SITE_URL}/rentals#service`,
  name: "Party Rental and Setup Service",
  serviceType: "Party rentals, decor setup, and event equipment delivery",
  provider: {
    "@id": `${SITE_URL}#organization`,
  },
  areaServed: {
    "@type": "Country",
    name: "Ghana",
  },
  url: `${SITE_URL}/rentals`,
};

const BOOKING_SERVICE_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "Service",
  "@id": `${SITE_URL}/book#service`,
  name: "Event Booking Service",
  serviceType: "Party booking and event planning support",
  provider: {
    "@id": `${SITE_URL}#organization`,
  },
  areaServed: {
    "@type": "Country",
    name: "Ghana",
  },
  url: `${SITE_URL}/book`,
};

const FAQ_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "@id": `${SITE_URL}/faq#faq`,
  mainEntity: [
    {
      "@type": "Question",
      name: "How do I book rentals or a full setup?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Share your date, venue, and theme with REEBS. We confirm availability, send a clear quote, and lock your booking once payment is complete.",
      },
    },
    {
      "@type": "Question",
      name: "Do you deliver and pick up?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes. REEBS delivers and picks up across Accra, Tema, and nearby areas. We confirm timing based on your event schedule.",
      },
    },
    {
      "@type": "Question",
      name: "Can I reschedule my booking?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes, reschedules are available based on item availability. Contact the team quickly so we can secure a new date.",
      },
    },
  ],
};

const PAGE_META = [
  {
    match: (path) => path === "/",
    title: "Party Rentals, Decor and Supplies in Ghana | REEBS Party Themes",
    description:
      "Plan your event with REEBS. Rent bouncy castles, decor, and party equipment, then shop balloons and supplies with delivery across Ghana.",
    keywords:
      "party rentals Ghana, kids party setup Accra, bouncy castles Tema, party decor and supplies Ghana",
    schema: [RENTAL_SERVICE_SCHEMA],
  },
  {
    match: (path) => path.startsWith("/about"),
    title: "About REEBS Party Themes",
    description:
      "Learn how REEBS Party Themes helps families and brands run fun, stress-free events with modern styling and reliable logistics.",
    keywords: "about REEBS Party Themes, event styling company Ghana, party planners Ghana",
  },
  {
    match: (path) => path.startsWith("/rentals/"),
    title: "Rental Details | REEBS Party Themes",
    description:
      "View party rental details, pricing, and booking options for REEBS equipment and setup services.",
    keywords: "rental details REEBS, bouncy castle pricing Ghana, event equipment rental Accra",
  },
  {
    match: (path) => path.startsWith("/rentals"),
    title: "Party Rental Equipment | REEBS Party Themes",
    description:
      "Browse REEBS rental categories including bouncy castles, games, and event setup essentials for birthdays and celebrations.",
    keywords: "party rentals Accra, kids equipment rental Ghana, bouncy castles Ghana",
    schema: [RENTAL_SERVICE_SCHEMA],
  },
  {
    match: (path) => path.startsWith("/shop"),
    title: "Party Supplies Shop | REEBS Party Themes",
    description:
      "Shop party supplies, balloons, gifts, and celebration extras from REEBS Party Themes.",
    keywords: "party supplies Ghana, balloons shop Tema, birthday decorations Accra",
  },
  {
    match: (path) => path.startsWith("/contact"),
    title: "Contact REEBS Party Themes",
    description:
      "Call, WhatsApp, or email REEBS to plan rentals, decor, and full event setup. Quick responses during business hours.",
    keywords: "contact party rental Ghana, WhatsApp REEBS, event planning contact Tema",
    schema: [LOCAL_BUSINESS_SCHEMA],
  },
  {
    match: (path) => path.startsWith("/faq"),
    title: "Frequently Asked Questions | REEBS Party Themes",
    description:
      "Get quick answers about booking, delivery, setup, pricing, and policy details before your event.",
    keywords: "party rental FAQ Ghana, booking questions REEBS, delivery and setup FAQ",
    schema: [FAQ_SCHEMA],
  },
  {
    match: (path) => path.startsWith("/book"),
    title: "Book a Party Setup | REEBS Party Themes",
    description:
      "Submit your event details and let REEBS prepare a clear booking plan with rentals, decor, and delivery support.",
    keywords: "book party rentals Ghana, reserve bouncy castle Accra, event booking REEBS",
    schema: [BOOKING_SERVICE_SCHEMA],
  },
  {
    match: (path) => path.startsWith("/website-template"),
    title: "Website Template Editor | REEBS Party Themes",
    description:
      "Preview and edit website template settings for REEBS Party Themes.",
    keywords: "website template editor REEBS, REEBS configuration",
    noIndex: true,
  },
  {
    match: (path) => path.startsWith("/cart"),
    title: "Cart | REEBS Party Themes",
    description: "Review selected items before checkout.",
    noIndex: true,
  },
  {
    match: (path) => path.startsWith("/checkout"),
    title: "Checkout | REEBS Party Themes",
    description: "Confirm your order details and payment information.",
    noIndex: true,
  },
  {
    match: (path) => path === "/home",
    title: "REEBS Party Themes",
    description: DEFAULT_DESCRIPTION,
    noIndex: true,
  },
  {
    match: (path) => path.startsWith("/customer-login"),
    title: "Customer Access | REEBS Party Themes",
    description: "Customer access route for booking support.",
    noIndex: true,
  },
  {
    match: (path) => path.startsWith("/privacy-policy"),
    title: "Privacy Policy | REEBS Party Themes",
    description: "Read how REEBS Party Themes collects, uses, and protects customer information.",
    keywords: "REEBS privacy policy, party rental privacy Ghana",
  },
  {
    match: (path) => path.startsWith("/refund-policy"),
    title: "Refund Policy | REEBS Party Themes",
    description: "Review REEBS refund terms and how cancellations or payment adjustments are handled.",
    keywords: "REEBS refund policy, party rental cancellation Ghana",
  },
  {
    match: (path) => path.startsWith("/delivery-policy"),
    title: "Delivery Policy | REEBS Party Themes",
    description: "Review REEBS delivery areas, windows, and service expectations for event rentals.",
    keywords: "REEBS delivery policy, party rental delivery Ghana",
  },
  {
    match: (path) => path.startsWith("/terms-of-service"),
    title: "Terms of Service | REEBS Party Themes",
    description: "Read REEBS terms of service for bookings, rentals, and website use.",
    keywords: "REEBS terms of service, event rental terms Ghana",
  },
];

const normalizePath = (pathname = "/") => {
  if (!pathname) return "/";
  const withSlash = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return withSlash.toLowerCase();
};

const toTitleCase = (value = "") =>
  value
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

const breadcrumbLabel = (segment = "") => {
  const labelMap = {
    about: "About",
    rentals: "Rentals",
    shop: "Shop",
    gallery: "Gallery",
    contact: "Contact",
    faq: "FAQ",
    book: "Book",
    "privacy-policy": "Privacy Policy",
    "refund-policy": "Refund Policy",
    "delivery-policy": "Delivery Policy",
    "terms-of-service": "Terms of Service",
    cart: "Cart",
    checkout: "Checkout",
    login: "Sign in",
    admin: "Admin",
  };

  if (!segment) return "Page";
  if (labelMap[segment]) return labelMap[segment];
  return toTitleCase(segment.replace(/-/g, " "));
};

const ensureMeta = (attribute, key) => {
  let element = document.head.querySelector(`meta[${attribute}="${key}"]`);
  if (!element) {
    element = document.createElement("meta");
    element.setAttribute(attribute, key);
    document.head.appendChild(element);
  }
  return element;
};

const ensureLink = (rel) => {
  let element = document.head.querySelector(`link[rel="${rel}"]`);
  if (!element) {
    element = document.createElement("link");
    element.setAttribute("rel", rel);
    document.head.appendChild(element);
  }
  return element;
};

const ensureAlternateLink = (hreflang) => {
  let element = document.head.querySelector(`link[rel="alternate"][hreflang="${hreflang}"]`);
  if (!element) {
    element = document.createElement("link");
    element.setAttribute("rel", "alternate");
    element.setAttribute("hreflang", hreflang);
    document.head.appendChild(element);
  }
  return element;
};

const getRouteMeta = (pathname) => {
  const normalizedPath = normalizePath(pathname);
  const match = PAGE_META.find((item) => item.match(normalizedPath));
  return {
    title: match?.title || SITE_NAME,
    description: match?.description || DEFAULT_DESCRIPTION,
    keywords: match?.keywords || DEFAULT_KEYWORDS,
    schema: match?.schema || null,
    noIndex: Boolean(match?.noIndex),
  };
};

const getWebPageType = (pathname) => {
  if (pathname === "/") return "WebPage";
  if (pathname.startsWith("/about")) return "AboutPage";
  if (pathname.startsWith("/contact")) return "ContactPage";
  if (pathname.startsWith("/faq")) return "FAQPage";
  if (pathname.startsWith("/shop")) return "CollectionPage";
  if (pathname.startsWith("/rentals")) return "CollectionPage";
  return "WebPage";
};

const buildBreadcrumbSchema = (pathname, canonical) => {
  const normalizedPath = normalizePath(pathname);
  const segments = normalizedPath.split("/").filter(Boolean);
  const crumbs = [{ name: "Home", item: SITE_URL }];
  let currentPath = "";
  segments.forEach((segment) => {
    currentPath += `/${segment}`;
    crumbs.push({
      name: breadcrumbLabel(segment),
      item: `${SITE_URL}${currentPath}`,
    });
  });

  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "@id": `${canonical}#breadcrumb`,
    itemListElement: crumbs.map((crumb, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: crumb.name,
      item: crumb.item,
    })),
  };
};

const buildWebPageSchema = ({ pathname, canonical, title, description }) => ({
  "@context": "https://schema.org",
  "@type": getWebPageType(pathname),
  "@id": `${canonical}#webpage`,
  url: canonical,
  name: title,
  description,
  inLanguage: DEFAULT_LANGUAGE,
  isPartOf: {
    "@id": `${SITE_URL}#website`,
  },
  about: {
    "@id": `${SITE_URL}#organization`,
  },
  breadcrumb: {
    "@id": `${canonical}#breadcrumb`,
  },
});

const normalizeSchemaPayload = (schema) => {
  const pending = Array.isArray(schema) ? [...schema] : [schema];
  const flat = [];

  while (pending.length) {
    const current = pending.shift();
    if (!current) continue;
    if (Array.isArray(current)) {
      pending.push(...current);
      continue;
    }
    if (typeof current === "object") {
      flat.push(current);
    }
  }

  const seen = new Set();
  return flat.filter((entry, index) => {
    const key = entry["@id"] || `${entry["@type"] || "Schema"}-${index}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const updateSchema = (schema) => {
  const existing = document.head.querySelector("script[data-seo-schema='true']");
  if (!schema) {
    if (existing) existing.remove();
    return;
  }

  const payload = Array.isArray(schema) ? schema : [schema];
  const script = existing || document.createElement("script");
  script.setAttribute("type", "application/ld+json");
  script.setAttribute("data-seo-schema", "true");
  script.textContent = JSON.stringify(payload);
  if (!existing) {
    document.head.appendChild(script);
  }
};

export const applySeo = ({
  pathname = "/",
  title,
  description,
  keywords,
  image = DEFAULT_IMAGE,
  noIndex,
  type = "website",
  locale = DEFAULT_LOCALE,
  schema,
} = {}) => {
  if (typeof document === "undefined") return;

  const normalizedPath = normalizePath(pathname);
  const routeMeta = getRouteMeta(normalizedPath);
  const finalTitle = title || routeMeta.title;
  const finalDescription = description || routeMeta.description;
  const finalKeywords = keywords || routeMeta.keywords || DEFAULT_KEYWORDS;
  const finalNoIndex = typeof noIndex === "boolean" ? noIndex : routeMeta.noIndex;
  const canonical = normalizedPath === "/" ? SITE_URL : `${SITE_URL}${normalizedPath}`;
  const routeSchema = schema ?? routeMeta.schema ?? null;

  const finalSchema = finalNoIndex
    ? null
    : normalizeSchemaPayload([
        ORGANIZATION_SCHEMA,
        LOCAL_BUSINESS_SCHEMA,
        WEBSITE_SCHEMA,
        routeSchema,
        buildWebPageSchema({
          pathname: normalizedPath,
          canonical,
          title: finalTitle,
          description: finalDescription,
        }),
        buildBreadcrumbSchema(normalizedPath, canonical),
      ]);

  document.title = finalTitle;

  ensureMeta("name", "description").setAttribute("content", finalDescription);
  ensureMeta("name", "keywords").setAttribute("content", finalKeywords);
  ensureMeta("name", "robots").setAttribute(
    "content",
    finalNoIndex ? "noindex, nofollow" : "index, follow"
  );
  ensureMeta("name", "googlebot").setAttribute(
    "content",
    finalNoIndex ? "noindex, nofollow" : "index, follow"
  );
  ensureMeta("name", "author").setAttribute("content", SITE_NAME);

  ensureMeta("property", "og:title").setAttribute("content", finalTitle);
  ensureMeta("property", "og:description").setAttribute("content", finalDescription);
  ensureMeta("property", "og:type").setAttribute("content", type);
  ensureMeta("property", "og:url").setAttribute("content", canonical);
  ensureMeta("property", "og:image").setAttribute("content", image);
  ensureMeta("property", "og:image:alt").setAttribute(
    "content",
    "REEBS Party Themes event setup and rental showcase"
  );
  ensureMeta("property", "og:site_name").setAttribute("content", SITE_NAME);
  ensureMeta("property", "og:locale").setAttribute("content", locale);

  ensureMeta("name", "twitter:card").setAttribute("content", "summary_large_image");
  ensureMeta("name", "twitter:title").setAttribute("content", finalTitle);
  ensureMeta("name", "twitter:description").setAttribute("content", finalDescription);
  ensureMeta("name", "twitter:image").setAttribute("content", image);
  ensureMeta("name", "twitter:site").setAttribute("content", DEFAULT_TWITTER);
  ensureMeta("name", "twitter:url").setAttribute("content", canonical);

  ensureMeta("name", "theme-color").setAttribute("content", DEFAULT_THEME_COLOR);

  ensureLink("canonical").setAttribute("href", canonical);
  ensureAlternateLink("en-GH").setAttribute("href", canonical);
  ensureAlternateLink("x-default").setAttribute("href", canonical);
  updateSchema(finalSchema);
};
