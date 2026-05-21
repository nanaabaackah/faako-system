import React, { useMemo } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { EmptyState } from "@faako/ui";
import Layout from "../components/Layout";
import useSEOMeta from "../hooks/useSEOMeta";
import { categories, products } from "../data/products";
import "../styles/pages/Search.css";

const SEARCH_INDEX = [
  {
    category: "Service",
    title: "Food Safety Audits",
    description:
      "We visit your premises, spot hygiene and safety issues, and give you a clear plan for fixing them.",
    href: "/services",
  },
  {
    category: "Service",
    title: "Food Risk Systems HACCP",
    description:
      "We help you set up a system that identifies where food safety risks happen and prevents them.",
    href: "/services",
  },
  {
    category: "Service",
    title: "Ghana FDA Compliance",
    description:
      "We guide you through licensing, product registration, label reviews, and inspections.",
    href: "/services",
  },
  {
    category: "Service",
    title: "Food Handler Training",
    description:
      "Training on hygiene, temperatures, cleaning, allergens, and contamination prevention.",
    href: "/services",
  },
  {
    category: "Resource",
    title: "The 5 Keys to Safer Food",
    description:
      "Keep clean, separate raw and cooked food, cook thoroughly, keep food safe, and use safe water.",
    href: "/resources",
  },
  {
    category: "Resource",
    title: "What Is HACCP and Do You Need It?",
    description:
      "A plain-language explanation of HACCP and how food businesses use it.",
    href: "/resources",
  },
  {
    category: "Resource",
    title: "How to Register a Food Product with Ghana FDA",
    description:
      "A walkthrough of documents, labels, timelines, and common application issues.",
    href: "/resources",
  },
  ...categories.map((category) => ({
    category: "Product",
    title: category.name,
    description: category.description,
    href: `/shop?category=${encodeURIComponent(category.name)}`,
  })),
  ...products.map((product) => ({
    category: "Product",
    title: product.name,
    description: product.description,
    href: `/products/${product.id}`,
  })),
  {
    category: "Page",
    title: "About Stroane",
    description:
      "Our story, mission, values, and the types of businesses we work with.",
    href: "/about",
  },
  {
    category: "Page",
    title: "All Services",
    description: "The full list of food safety advisory services Stroane offers.",
    href: "/services",
  },
  {
    category: "Page",
    title: "Resources & Guides",
    description:
      "Plain-language guides, FAQs, and regulatory information for Ghanaian food businesses.",
    href: "/resources",
  },
  {
    category: "Page",
    title: "Shop Food Safety Products",
    description:
      "Professional food safety equipment and supplies available in Ghana.",
    href: "/shop",
  },
];

type Result = (typeof SEARCH_INDEX)[number] & { score: number };

const Search: React.FC = () => {
  const [params] = useSearchParams();
  const q = params.get("q") ?? "";

  useSEOMeta({
    title: q ? `Search: "${q}" | Stroane` : "Search | Stroane",
    description: "Search Stroane for food safety services, products, guides, and resources.",
    noIndex: true,
  });

  const results = useMemo<Result[]>(() => {
    if (!q.trim()) return [];

    const terms = q.toLowerCase().split(/\s+/).filter(Boolean);

    return SEARCH_INDEX.map((item) => {
      const haystack =
        `${item.title} ${item.description} ${item.category}`.toLowerCase();

      const score = terms.filter((term) => haystack.includes(term)).length;

      return { ...item, score };
    })
      .filter((result) => result.score > 0)
      .sort((a, b) => b.score - a.score);
  }, [q]);

  const grouped = useMemo(() => {
    const order = ["Service", "Resource", "Product", "Page"];
    const map: Record<string, Result[]> = {};

    results.forEach((result) => {
      if (!map[result.category]) map[result.category] = [];
      map[result.category].push(result);
    });

    return order
      .filter((category) => map[category])
      .map((category) => ({
        category,
        items: map[category],
      }));
  }, [results]);

  return (
    <Layout>
      <div className="search-page">
        <section className="search-header">
          <span className="search-kicker">Search</span>
          <h1>{q ? `Results for "${q}"` : "Search Stroane"}</h1>

          {q ? (
            <p>
              {results.length} result{results.length !== 1 ? "s" : ""} found
            </p>
          ) : (
            <p>
              Use the search bar in the navigation to find services, guides,
              products, and pages.
            </p>
          )}
        </section>

        {q && results.length === 0 && (
          <EmptyState
            className="search-empty"
            title="No matching results found."
            message={
              <>
                Try a simpler word like <strong>audit</strong>,{" "}
                <strong>fridge</strong>, <strong>training</strong>, or{" "}
                <strong>licence</strong>.
              </>
            }
          />
        )}

        {grouped.map(({ category, items }) => (
          <section key={category} className="search-group">
            <h2 className="search-group__title">{category}s</h2>

            <div className="search-results">
              {items.map((item) => (
                <Link key={item.title} to={item.href} className="search-card">
                  <span className="search-card__category">{item.category}</span>
                  <h3>{item.title}</h3>
                  <p>{item.description}</p>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </Layout>
  );
};

export default Search;
