import React, { useMemo } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { EmptyState } from "@faako/ui";
import Layout from "../../components/Layout";
import useSEOMeta from "../../hooks/useSEOMeta";
import { categories, isPricedProduct, products } from "../../data/products";
import "../styles/Search.css";

type SearchCategory = "Page" | "Service" | "Resource" | "Product";

interface SearchIndexItem {
  category: SearchCategory;
  title: string;
  description: string;
  href: string;
  keywords?: string[];
}

type Result = SearchIndexItem & {
  score: number;
};

const PRIMARY_RESULT_THRESHOLD = 4;
const RELATED_RESULT_LIMIT = 6;

const STOREFRONT_PAGES: SearchIndexItem[] = [
  {
    category: "Page",
    title: "Home",
    description:
      "Stroane food safety advisory, compliance support, audits, training, and food safety products in Ghana.",
    href: "/",
    keywords: ["food safety", "ghana", "stroane", "homepage", "consultation"],
  },
  {
    category: "Page",
    title: "About Stroane",
    description:
      "Our story, mission, values, local expertise, and the types of food businesses Stroane works with.",
    href: "/about",
    keywords: ["company", "mission", "values", "food businesses", "local knowledge"],
  },
  {
    category: "Page",
    title: "Services",
    description:
      "Food safety audits, HACCP systems, Ghana FDA compliance, training, GMP audits, label reviews, and import/export support.",
    href: "/services",
    keywords: ["consulting", "audit", "haccp", "fda", "gmp", "training", "label review"],
  },
  {
    category: "Page",
    title: "Shop",
    description:
      "Browse food safety equipment, thermometers, signage, aprons, and professional supplies.",
    href: "/shop",
    keywords: ["catalogue", "store", "products", "equipment", "thermometers"],
  },
  {
    category: "Page",
    title: "Products",
    description:
      "View the full Stroane product catalogue and individual food safety product details.",
    href: "/products",
    keywords: ["catalogue", "shop", "store", "product list"],
  },
  {
    category: "Page",
    title: "Resources",
    description:
      "Plain-language guides, FAQs, food safety standards, Ghana FDA information, HACCP basics, and kitchen safety topics.",
    href: "/resources",
    keywords: ["guides", "faqs", "standards", "knowledge", "learning"],
  },
  {
    category: "Page",
    title: "Contact Stroane",
    description:
      "Contact Stroane, request a consultation, send an enquiry, and tell us about your food business.",
    href: "/contact",
    keywords: ["contact", "consultation", "enquiry", "email", "phone", "quote"],
  },
  {
    category: "Page",
    title: "Sign Up",
    description:
      "Register interest and prepare for future Stroane customer account and quote workflows.",
    href: "/signup",
    keywords: ["register", "signup", "account", "customer"],
  },
  {
    category: "Page",
    title: "Checkout",
    description:
      "Review your food safety product cart and prepare an order request for available products.",
    href: "/checkout",
    keywords: ["cart", "order", "payment", "paystack", "purchase"],
  },
  {
    category: "Page",
    title: "Account",
    description:
      "Customer account placeholder for future profile, saved requests, and order access.",
    href: "/account",
    keywords: ["customer", "profile", "account"],
  },
  {
    category: "Page",
    title: "Orders",
    description:
      "Future customer orders area for viewing product orders and order requests.",
    href: "/orders",
    keywords: ["customer", "orders", "purchases", "requests"],
  },
  {
    category: "Page",
    title: "Quotes",
    description:
      "Future customer quotes area for service enquiries, product quotes, and request tracking.",
    href: "/quotes",
    keywords: ["quote", "quotation", "enquiry", "request"],
  },
  {
    category: "Page",
    title: "Terms and Conditions",
    description:
      "Storefront terms covering use of the Stroane website, services, and product ordering flow.",
    href: "/terms",
    keywords: ["terms", "conditions", "legal"],
  },
  {
    category: "Page",
    title: "Privacy Policy",
    description:
      "How Stroane handles customer information, enquiries, analytics, privacy, and data protection.",
    href: "/privacy",
    keywords: ["privacy", "data", "personal information", "policy"],
  },
  {
    category: "Page",
    title: "Cookie Policy",
    description:
      "How Stroane uses cookies, browser storage, analytics, and related website technologies.",
    href: "/cookies",
    keywords: ["cookies", "browser storage", "analytics", "policy"],
  },
  {
    category: "Page",
    title: "Sitemap",
    description:
      "A structured list of public Stroane storefront pages, services, product categories, and products.",
    href: "/sitemap",
    keywords: ["site map", "navigation", "all pages"],
  },
];

const SERVICES: SearchIndexItem[] = [
  {
    category: "Service",
    title: "Food Safety Audits",
    description:
      "We walk your premises and tell you what's working, what's risky, and what to fix first.",
    href: "/services",
    keywords: ["inspection", "risk", "hygiene", "restaurants", "caterers", "schools", "hospitals"],
  },
  {
    category: "Service",
    title: "HACCP Food Risk Management",
    description:
      "We map where risk hides in your operation and build practical controls to stop it.",
    href: "/services",
    keywords: ["hazard analysis", "critical control point", "processors", "exporters", "risk system"],
  },
  {
    category: "Service",
    title: "Ghana FDA Compliance",
    description:
      "Licensing, registration, label reviews, and inspection preparation explained step by step.",
    href: "/services",
    keywords: ["licence", "license", "registration", "approval", "inspection", "fda"],
  },
  {
    category: "Service",
    title: "Food Handler Training",
    description:
      "Hands-on staff training on hygiene, temperatures, allergens, and contamination.",
    href: "/services",
    keywords: ["staff", "kitchen", "hygiene", "allergens", "contamination", "certificate"],
  },
  {
    category: "Service",
    title: "Good Manufacturing Practice Audits",
    description:
      "We assess your factory floor against stronger manufacturing and packaged food standards.",
    href: "/services",
    keywords: ["gmp", "factory", "manufacturer", "beverage", "packaged food"],
  },
  {
    category: "Service",
    title: "Food Label Reviews",
    description:
      "Label checks against Ghana FDA rules before you submit or print packaging.",
    href: "/services",
    keywords: ["labels", "packaging", "ingredients", "allergens", "claims", "fda"],
  },
  {
    category: "Service",
    title: "Cold Storage Checks",
    description:
      "Confirming fridges, freezers, and delivery vehicles keep food at safe temperatures.",
    href: "/services",
    keywords: ["fridge", "freezer", "temperature", "cold chain", "delivery", "thermometer"],
  },
  {
    category: "Service",
    title: "Import and Export Support",
    description:
      "Navigating documents, approvals, and standards for cross-border food trade.",
    href: "/services",
    keywords: ["import", "export", "documents", "trade", "approvals", "standards"],
  },
  {
    category: "Service",
    title: "Consultation and Site Visit Process",
    description:
      "Free consultation, clear proposal, site visit or review, report, fix list, and ongoing support.",
    href: "/services",
    keywords: ["proposal", "site visit", "report", "fix list", "support", "retainer"],
  },
];

const RESOURCES: SearchIndexItem[] = [
  {
    category: "Resource",
    title: "The 5 Keys to Safer Food",
    description:
      "Keep clean, separate raw and cooked food, cook thoroughly, keep food at safe temperatures, and use safe water.",
    href: "/resources#guide-safer-food-keys",
    keywords: ["food handlers", "kitchen teams", "safe water", "cleaning"],
  },
  {
    category: "Resource",
    title: "What Is HACCP and Do You Need It?",
    description:
      "A plain-language explanation of HACCP, why it matters, and how food businesses prevent food safety risks.",
    href: "/resources#guide-haccp-basics",
    keywords: ["hazard analysis", "critical control point", "processors", "exporters"],
  },
  {
    category: "Resource",
    title: "How to Register a Food Product with Ghana FDA",
    description:
      "Product registration documents, labels, timelines, and common reasons applications get delayed.",
    href: "/resources#guide-ghana-fda-registration",
    keywords: ["ghana fda", "registration", "documents", "labels", "approval"],
  },
  {
    category: "Resource",
    title: "Safe Food Temperatures in Ghana",
    description:
      "Fridge, freezer, cooking, holding, and delivery temperatures for Ghana's hot climate.",
    href: "/resources#guide-safe-food-temperatures",
    keywords: ["fridge", "freezer", "cooking", "holding", "delivery", "temperature"],
  },
  {
    category: "Resource",
    title: "How Germs Spread in Ghanaian Kitchens",
    description:
      "Common contamination risks in local food environments and how to prevent them.",
    href: "/resources#guide-kitchen-contamination",
    keywords: ["germs", "contamination", "kitchens", "storage", "boards", "hygiene"],
  },
  {
    category: "Resource",
    title: "Food Allergens: What You Need to Declare",
    description:
      "Major allergens food businesses should identify clearly on labels, menus, and customer-facing materials.",
    href: "/resources#guide-food-allergens",
    keywords: ["allergens", "labels", "menus", "packaged food", "bakeries"],
  },
  {
    category: "Resource",
    title: "Food Safety FAQs",
    description:
      "Answers about Ghana FDA licences, Stroane audits, annual checks, and fridge temperature records.",
    href: "/resources#resources-faq",
    keywords: ["faq", "licence", "license", "audit", "fridge", "temperature", "inspection"],
  },
  {
    category: "Resource",
    title: "Standards We Reference",
    description:
      "Ghana Food and Drugs Authority, Ghana Standards Authority, Codex Alimentarius, HACCP, ISO 22000, and GMP.",
    href: "/resources#resources-standards",
    keywords: ["standards", "codex", "iso 22000", "gmp", "ghana standards authority"],
  },
];

const productSpecificationText = (specifications: SearchIndexItem["keywords"]) =>
  specifications || [];

const getProductSpecificationTerms = (product: (typeof products)[number]) => {
  if (!product.specifications) return [];

  if (Array.isArray(product.specifications)) {
    return product.specifications.flatMap((specification) => [
      specification.group || "",
      specification.label,
      specification.value,
    ]);
  }

  return Object.entries(product.specifications).flatMap(([label, value]) => [
    label,
    value,
  ]);
};

const PRICED_PRODUCTS = products.filter(isPricedProduct);
const PRICED_PRODUCT_CATEGORY_KEYS = new Set(
  PRICED_PRODUCTS.flatMap((product) => [product.category, product.categorySlug])
);

const PRODUCT_ITEMS: SearchIndexItem[] = [
  ...categories
    .filter(
      (category) =>
        !category.isGroup &&
        (PRICED_PRODUCT_CATEGORY_KEYS.has(category.name) ||
          PRICED_PRODUCT_CATEGORY_KEYS.has(category.id))
    )
    .map((category) => ({
      category: "Product" as const,
      title: category.name,
      description: category.description,
      href: `/shop?category=${encodeURIComponent(category.name)}`,
      keywords: [
        "category",
        "catalogue",
        "shop",
        ...(category.tags || []),
        "products",
      ],
    })),
  ...PRICED_PRODUCTS.map((product) => ({
    category: "Product" as const,
    title: product.name,
    description: product.description,
    href: `/products/${product.id}`,
    keywords: [
      product.category,
      product.categorySlug,
      product.subcategory || "",
      product.brand || "",
      product.sku,
      product.stock,
      product.availability || "",
      product.inquiryCta || "",
      ...(product.tags || []),
      ...(product.features || []),
      ...(product.useCases || []),
      ...productSpecificationText(getProductSpecificationTerms(product)),
      ...(product.variants || []).flatMap((variant) => [
        variant.name,
        variant.sku,
        variant.priceLabel || "",
        ...Object.values(variant.options || {}),
      ]),
    ],
  })),
];

const SEARCH_INDEX: SearchIndexItem[] = [
  ...STOREFRONT_PAGES,
  ...SERVICES,
  ...RESOURCES,
  ...PRODUCT_ITEMS,
];

const CATEGORY_LABELS: Record<SearchCategory, string> = {
  Page: "Pages",
  Service: "Services",
  Resource: "Resources",
  Product: "Products",
};

const CATEGORY_ORDER: SearchCategory[] = ["Service", "Resource", "Product", "Page"];

const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "for",
  "from",
  "how",
  "in",
  "is",
  "of",
  "or",
  "the",
  "to",
  "what",
  "with",
  "you",
  "your",
]);

const normalizeSearchText = (value = "") =>
  value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const tokenize = (value = "") =>
  normalizeSearchText(value)
    .split(/\s+/)
    .filter((term) => term && !STOP_WORDS.has(term));

const searchableText = (item: SearchIndexItem) =>
  [item.category, item.title, item.description, ...(item.keywords || [])].join(" ");

const itemKey = (item: SearchIndexItem) => `${item.category}:${item.title}:${item.href}`;

const levenshteinDistance = (left: string, right: string) => {
  const width = right.length + 1;
  const distances = Array.from({ length: left.length + 1 }, (_, row) =>
    Array.from({ length: width }, (_, column) => (row === 0 ? column : column === 0 ? row : 0))
  );

  for (let row = 1; row <= left.length; row += 1) {
    for (let column = 1; column <= right.length; column += 1) {
      const cost = left[row - 1] === right[column - 1] ? 0 : 1;
      distances[row][column] = Math.min(
        distances[row - 1][column] + 1,
        distances[row][column - 1] + 1,
        distances[row - 1][column - 1] + cost
      );
    }
  }

  return distances[left.length][right.length];
};

const isNearTerm = (term: string, word: string) =>
  term.length >= 4 &&
  word.length >= 4 &&
  Math.abs(term.length - word.length) <= 2 &&
  term[0] === word[0] &&
  levenshteinDistance(term, word) <= 2;

const scoreItem = (item: SearchIndexItem, query: string) => {
  const phrase = normalizeSearchText(query);
  const terms = tokenize(query);
  if (!phrase || terms.length === 0) return 0;

  const title = normalizeSearchText(item.title);
  const haystack = normalizeSearchText(searchableText(item));
  const titleWords = tokenize(item.title);
  const words = tokenize(searchableText(item));

  let score = 0;
  if (title === phrase) score += 28;
  else if (title.includes(phrase)) score += 18;
  else if (haystack.includes(phrase)) score += 10;

  terms.forEach((term) => {
    if (titleWords.includes(term)) score += 10;
    else if (titleWords.some((word) => word.startsWith(term))) score += 6;

    if (words.includes(term)) score += 4;
    else if (words.some((word) => word.startsWith(term))) score += 3;
    else if (haystack.includes(term)) score += 2;
    else if (words.some((word) => isNearTerm(term, word))) score += 2;
  });

  return score;
};

const getRelatedScore = (
  item: SearchIndexItem,
  queryScore: number,
  seedTerms: Set<string>
) => {
  const itemTerms = new Set(tokenize(searchableText(item)));
  const overlap = [...seedTerms].filter((term) => itemTerms.has(term)).length;
  return queryScore + overlap;
};

const Search: React.FC = () => {
  const [params] = useSearchParams();
  const q = params.get("q") ?? "";
  const hasQuery = Boolean(q.trim());

  useSEOMeta({
    title: q ? `Search: "${q}" | Stroane` : "Search | Stroane",
    description: "Search Stroane for food safety services, products, guides, and resources.",
    noIndex: true,
  });

  const scored = useMemo<Result[]>(
    () =>
      SEARCH_INDEX.map((item) => ({ ...item, score: scoreItem(item, q) }))
        .filter((result) => result.score > 0)
        .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title)),
    [q]
  );

  const results = useMemo(
    () => scored.filter((result) => result.score >= PRIMARY_RESULT_THRESHOLD),
    [scored]
  );

  const relatedResults = useMemo<Result[]>(() => {
    if (!hasQuery) return [];

    const resultKeys = new Set(results.map(itemKey));
    const seedTerms = new Set(
      results.length
        ? results.slice(0, 4).flatMap((result) => tokenize(searchableText(result)))
        : tokenize(q)
    );

    return SEARCH_INDEX.map((item) => ({ ...item, score: scoreItem(item, q) }))
      .filter((result) => !resultKeys.has(itemKey(result)))
      .map((result) => ({
        ...result,
        score: getRelatedScore(result, result.score, seedTerms),
      }))
      .filter((result) => result.score > 0)
      .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title))
      .slice(0, RELATED_RESULT_LIMIT);
  }, [hasQuery, q, results]);

  const grouped = useMemo(() => {
    const map: Partial<Record<SearchCategory, Result[]>> = {};

    results.forEach((result) => {
      map[result.category] = [...(map[result.category] || []), result];
    });

    return CATEGORY_ORDER.filter((category) => map[category]?.length).map((category) => ({
      category,
      items: map[category] || [],
    }));
  }, [results]);

  return (
    <Layout>
      <div className="search-page">
        <section className="search-header">
          <span className="search-kicker">Search</span>
          <h1>{q ? `Results for "${q}"` : "Search Stroane"}</h1>

          {hasQuery ? (
            <p>
              {results.length} direct result{results.length !== 1 ? "s" : ""} found
              across the public Stroane website.
            </p>
          ) : (
            <p>
              Use the search bar in the navigation to find public pages, services,
              guides, products, legal information, and support flows.
            </p>
          )}
        </section>

        {hasQuery && results.length === 0 && (
          <EmptyState
            className="search-empty"
            title="No direct matches found."
            message={
              <>
                Try a simpler word like <strong>audit</strong>,{" "}
                <strong>fridge</strong>, <strong>training</strong>, or{" "}
                <strong>licence</strong>. Similar topics are shown below when available.
              </>
            }
          />
        )}

        {grouped.map(({ category, items }) => (
          <section key={category} className="search-group">
            <h2 className="search-group__title">{CATEGORY_LABELS[category]}</h2>

            <div className="search-results">
              {items.map((item) => (
                <Link key={itemKey(item)} to={item.href} className="search-card">
                  <span className="search-card__category">{item.category}</span>
                  <h3>{item.title}</h3>
                  <p>{item.description}</p>
                </Link>
              ))}
            </div>
          </section>
        ))}

        {hasQuery && relatedResults.length > 0 && (
          <section className="search-group search-group--related">
            <div className="search-group__header">
              <h2 className="search-group__title">Similar Topics And Items</h2>
              <p>These are close matches or nearby topics from the public storefront.</p>
            </div>

            <div className="search-results search-results--compact">
              {relatedResults.map((item) => (
                <Link key={itemKey(item)} to={item.href} className="search-card search-card--compact">
                  <span className="search-card__category">{item.category}</span>
                  <h3>{item.title}</h3>
                  <p>{item.description}</p>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </Layout>
  );
};

export default Search;
