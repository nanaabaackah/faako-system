import React, { useState } from "react";
import { HiArrowRight, HiChevronDown } from "react-icons/hi";
import Layout from "../../components/Layout";
import useSEOMeta from "../../hooks/useSEOMeta";
import StructuredData from "../../components/StructuredData";
import "../../styles/pages/Resources.css";

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
  const [openFaq, setOpenFaq] = useState<number>(-1);
  const featured = guides[0];
  const rest = guides.slice(1);

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
            <h2 className="section__heading">
              Learn the rules without getting lost in the wording.
            </h2>
            <p className="section__sub resources-intro__sub">
              These guides break food safety topics into simple actions your team
              can understand and use.
            </p>
          </div>

          <div className="guides-feature">
            <article className="guides-feature__card">
              <div className="guides-feature__media">
                <img
                  src="/imgs/bg_imgs/bg_2.png"
                  alt=""
                  aria-hidden="true"
                />
                <span className="guides-feature__badge">Featured Guide</span>
              </div>
              <div className="guides-feature__body">
                <span className="guides-feature__number">01</span>
                <h3 className="guides-feature__title">{featured.title}</h3>
                <p className="guides-feature__desc">{featured.description}</p>
                <p className="guides-feature__audience">
                  For {featured.audience}
                </p>
                <a href="#" className="guides-feature__cta">
                  Read guide
                  <HiArrowRight size={16} aria-hidden="true" />
                </a>
              </div>
            </article>

            <ol className="guides-list" aria-label="More guides">
              {rest.map((guide, i) => (
                <li key={guide.title}>
                  <a href="#" className="guides-list__item">
                    <span className="guides-list__num">
                      {String(i + 2).padStart(2, "0")}
                    </span>
                    <div className="guides-list__copy">
                      <h4>{guide.title}</h4>
                      <p>{guide.description}</p>
                    </div>
                    <span className="guides-list__arrow" aria-hidden="true">
                      <HiArrowRight size={16} />
                    </span>
                  </a>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <div className="resources-standards">
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
        </div>

        <section className="resources-faq">
          <div className="resources-faq__intro">
            <span className="resources-kicker">FAQs</span>
            <h2 className="section__heading">
              Common questions from food businesses.
            </h2>
          </div>

          <div className="faq-accordion">
            {faqs.map((faq, i) => {
              const isOpen = openFaq === i;
              const panelId = `faq-panel-${i}`;
              const buttonId = `faq-btn-${i}`;
              return (
                <div
                  key={faq.q}
                  className={`faq-item${isOpen ? " faq-item--open" : ""}`}
                >
                  <button
                    type="button"
                    id={buttonId}
                    className="faq-item__trigger"
                    aria-expanded={isOpen}
                    aria-controls={panelId}
                    onClick={() => setOpenFaq(isOpen ? -1 : i)}
                  >
                    <span className="faq-item__q">{faq.q}</span>
                    <span className="faq-item__chevron" aria-hidden="true">
                      <HiChevronDown size={20} />
                    </span>
                  </button>
                  <div
                    id={panelId}
                    role="region"
                    aria-labelledby={buttonId}
                    aria-hidden={!isOpen}
                    className="faq-item__panel"
                  >
                    <p>{faq.a}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </Layout>
  );
};

export default Resources;