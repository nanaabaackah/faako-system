import React from "react";
import { Link } from "react-router-dom";
import { HiArrowRight } from "react-icons/hi";
import Layout from "../../components/Layout";
import useSEOMeta from "../../hooks/useSEOMeta";
import { products, categoryOptions } from "../../data/products";
import "../../styles/pages/Sitemap.css";

interface SiteLink {
  label: string;
  to: string;
  description?: string;
}

interface SiteGroup {
  heading: string;
  blurb: string;
  links: SiteLink[];
}

const GROUPS: SiteGroup[] = [
  {
    heading: "Company",
    blurb: "Who we are and how to reach us.",
    links: [
      { label: "Home", to: "/", description: "Stroane overview and what we do." },
      { label: "About Us", to: "/about", description: "Our story, mission, and team." },
      { label: "Services", to: "/services", description: "Audits, HACCP, FDA compliance, training, and more." },
      { label: "Resources", to: "/resources", description: "Guides, FAQs, and reference standards." },
      { label: "Contact", to: "/contact", description: "Send a message or book a consultation." },
    ],
  },
  {
    heading: "Store",
    blurb: "Shop food safety supplies and product details.",
    links: [
      { label: "Shop All Products", to: "/shop", description: "Browse the full Stroane catalogue." },
      ...categoryOptions
        .filter((c) => c !== "All")
        .map((category) => ({
          label: category,
          to: `/shop?category=${encodeURIComponent(category)}`,
          description: `Products in the ${category} category.`,
        })),
    ],
  },
  {
    heading: "Products",
    blurb: "Individual product detail pages.",
    links: products.map((p) => ({
      label: p.name,
      to: `/products/${p.id}`,
      description: `${p.category} — from ${p.sku}.`,
    })),
  },
  {
    heading: "Legal",
    blurb: "Policies that govern your use of the site.",
    links: [
      { label: "Terms & Conditions", to: "/terms", description: "Rules for using our website and services." },
      { label: "Privacy Policy", to: "/privacy", description: "How we collect, use, and protect data." },
      { label: "Cookie Policy", to: "/cookies", description: "Cookies we use and how to manage them." },
      { label: "Sitemap", to: "/sitemap", description: "This page — an index of everything." },
    ],
  },
];

const Sitemap: React.FC = () => {
  useSEOMeta({
    title: "Sitemap | Stroane",
    description:
      "Sitemap for stroanesolutions.com — every page on the Stroane website, organised by area.",
    canonical: "https://stroanesolutions.com/sitemap",
  });

  return (
    <Layout>
      <div className="sitemap-page">
        <header className="sitemap-header">
          <div className="sitemap-header__inner">
            <span className="sitemap-kicker">Sitemap</span>
            <h1>Everything on the Stroane site, in one place.</h1>
            <p>
              An index of every page, organised by section. If you can&rsquo;t
              find what you&rsquo;re looking for, please{" "}
              <Link to="/contact">contact us</Link>.
            </p>
          </div>
        </header>

        <div className="sitemap-body">
          <div className="sitemap-body__inner">
            {GROUPS.map((group) => (
              <section key={group.heading} className="sitemap-group">
                <div className="sitemap-group__intro">
                  <h2>{group.heading}</h2>
                  <p>{group.blurb}</p>
                </div>

                <ul className="sitemap-group__links">
                  {group.links.map((link) => (
                    <li key={link.to + link.label}>
                      <Link to={link.to} className="sitemap-link">
                        <div>
                          <strong>{link.label}</strong>
                          {link.description ? <span>{link.description}</span> : null}
                        </div>
                        <HiArrowRight size={16} aria-hidden="true" />
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Sitemap;
