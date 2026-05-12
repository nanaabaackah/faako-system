import React from "react";
import Layout from "../components/Layout";
import useSEOMeta from "../hooks/useSEOMeta";
import StructuredData from "../components/StructuredData";
import "../styles/pages/Resources.css";

const guides = [
  {
    title: "The 5 Keys to Safer Food",
    description:
      "A simple guide to the food safety habits every food handler should know: keep clean, separate raw and cooked food, cook thoroughly, keep food at safe temperatures, and use safe water.",
    audience: "Food handlers, business owners, kitchen teams.",
  },
  {
    title: "What Is HACCP and Do You Need It?",
    description:
      "A plain-language explanation of HACCP, why it matters, and how food businesses can use it to prevent food safety risks.",
    audience: "Food producers, processors, caterers, exporters.",
  },
  {
    title: "How to Register a Food Product with Ghana FDA",
    description:
      "A step-by-step overview of the product registration process, including documents, labels, timelines, and common reasons applications get delayed.",
    audience: "Food and beverage manufacturers, importers.",
  },
  {
    title: "Safe Food Temperatures in Ghana",
    description:
      "A practical guide to fridge, freezer, cooking, holding, and delivery temperatures — especially important in Ghana's hot climate.",
    audience: "Restaurants, caterers, supermarkets, hospitals.",
  },
  {
    title: "How Germs Spread in Ghanaian Kitchens",
    description:
      "Common ways contamination happens in local food environments, from shared boards to poor storage, and how to prevent it.",
    audience: "Restaurant kitchens, chop bars, catering teams.",
  },
  {
    title: "Food Allergens: What You Need to Declare",
    description:
      "A guide to the major allergens food businesses should identify clearly on labels, menus, and customer-facing materials.",
    audience: "Packaged food producers, bakeries, caterers.",
  },
];

const faqs = [
  {
    q: "Do I need a Ghana FDA licence to sell food?",
    a: "Most food businesses that make, import, distribute, or sell food in Ghana need the right Ghana FDA approvals. The exact requirement depends on what you sell and how your business operates.",
  },
  {
    q: "What is the difference between a Stroane audit and an FDA inspection?",
    a: "An FDA inspection is an official regulatory visit. A Stroane audit is a private review that helps you prepare, identify risks, and fix issues before they become bigger problems.",
  },
  {
    q: "How often should a food business do a food safety check?",
    a: "At least once a year is a good starting point. Higher-risk businesses such as schools, hospitals, large caterers, and manufacturers may need more frequent checks.",
  },
  {
    q: "What temperature should a fridge be?",
    a: "Commercial fridges should usually stay at 5°C or colder, while freezers should stay at -18°C or colder. Regular checks and records are important.",
  },
];

const standards = [
  "Ghana Food and Drugs Authority",
  "Ghana Standards Authority",
  "Codex Alimentarius",
  "HACCP",
  "ISO 22000",
  "Good Manufacturing Practice",
];

const FAQ_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "@id": "https://stroanesolutions.com/resources",
  name: "Food Safety FAQs for Ghana",
  breadcrumb: {
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: "https://stroanesolutions.com/" },
      { "@type": "ListItem", position: 2, name: "Resources", item: "https://stroanesolutions.com/resources" },
    ],
  },
  mainEntity: faqs.map((faq) => ({
    "@type": "Question",
    name: faq.q,
    acceptedAnswer: {
      "@type": "Answer",
      text: faq.a,
    },
  })),
};

const Resources: React.FC = () => {
  useSEOMeta({
    title: "Food Safety Resources & Guides Ghana | Stroane",
    description:
      "Free food safety guides, FAQs, and practical tools for Ghanaian food businesses. Plain-language guides on HACCP, Ghana FDA registration, safe temperatures, allergens, and more.",
    keywords:
      "food safety guides Ghana, Ghana FDA licence requirements, HACCP explained, safe food temperatures Ghana, food safety FAQ",
    canonical: "https://stroanesolutions.com/resources",
  });

  return (
    <Layout>
      <StructuredData schema={FAQ_SCHEMA} id="resources-faq-schema" />
      <div className="resources-page">
        <section className="resources-hero">
          <img
            src="/imgs/bg_imgs/resources_hero.png"
            alt=""
            aria-hidden="true"
            className="resources-hero__bg"
          />
          <div className="resources-hero__overlay" />

          <div className="resources-hero__content">
            <h1 className="resources-hero__heading">
              Food Safety Resources
            </h1>
            <p className="resources-hero__para">
              Plain-language guides, FAQs, and practical tools to help Ghanaian
              food businesses stay safe, compliant, and prepared.
            </p>
          </div>
        </section>

        <section className="resources-guides">
          <div className="resources-intro">
            <span className="resources-kicker">Guides & Explainers</span>
            <h2 className="section__heading">
              Learn the rules without getting lost in the wording.
            </h2>
            <p className="section__sub resources-intro__sub">
              These guides break food safety topics into simple actions your team
              can understand and use.
            </p>
          </div>

          <div className="resources-grid">
            {guides.map((guide, index) => (
              <article key={guide.title} className="resource-card">
                <span className="resource-card__number">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <h3>{guide.title}</h3>
                <p>{guide.description}</p>
                <span className="resource-card__audience">
                  For: {guide.audience}
                </span>
              </article>
            ))}
          </div>
        </section>

        <section className="resources-faq">
          <div className="resources-faq__intro">
            <span className="resources-kicker">FAQs</span>
            <h2 className="section__heading">
              Common questions from food businesses.
            </h2>
          </div>

          <div className="resources-faq__list">
            {faqs.map((faq) => (
              <article key={faq.q} className="faq-card">
                <h3>{faq.q}</h3>
                <p>{faq.a}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="resources-standards">
          <div>
            <span className="resources-kicker">Standards We Reference</span>
            <h2 className="section__heading">
              Local compliance, global food safety thinking.
            </h2>
          </div>

          <div className="resources-standards__tags">
            {standards.map((standard) => (
              <span key={standard}>{standard}</span>
            ))}
          </div>
        </section>

        <section className="resources-cta">
          <div>
            <span className="resources-kicker">Need something specific?</span>
            <h2 className="section__heading">
              We can prepare custom checklists, templates, and training notes for
              your team.
            </h2>
          </div>

          <a href="mailto:info@stroanesolutions.com" className="resources-cta__button">
            Request a Resource
          </a>
        </section>
      </div>
    </Layout>
  );
};

export default Resources;