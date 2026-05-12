import React from "react";
import { Link } from "react-router-dom";
import Layout from "../components/Layout";
import useSEOMeta from "../hooks/useSEOMeta";
import StructuredData from "../components/StructuredData";
import "../styles/pages/Services.css";

const SERVICES_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "ItemList",
  "@id": "https://stroanesolutions.com/services",
  name: "Stroane Food Safety Services",
  description:
    "Food safety services for Ghanaian food businesses — audits, HACCP, FDA compliance, training, GMP, and import/export support.",
  url: "https://stroanesolutions.com/services",
  breadcrumb: {
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: "https://stroanesolutions.com/" },
      { "@type": "ListItem", position: 2, name: "Services", item: "https://stroanesolutions.com/services" },
    ],
  },
  itemListElement: [
    {
      "@type": "ListItem",
      position: 1,
      item: {
        "@type": "Service",
        name: "Food Safety Audits",
        description:
          "On-site audit of how food is handled, stored, prepared, and served. Clear report with priority fixes.",
        provider: { "@type": "Organization", name: "Stroane", url: "https://stroanesolutions.com" },
        areaServed: "Ghana",
      },
    },
    {
      "@type": "ListItem",
      position: 2,
      item: {
        "@type": "Service",
        name: "HACCP — Food Risk Management",
        description:
          "Identify food safety risks in your operation and put practical controls in place to prevent them.",
        provider: { "@type": "Organization", name: "Stroane", url: "https://stroanesolutions.com" },
        areaServed: "Ghana",
      },
    },
    {
      "@type": "ListItem",
      position: 3,
      item: {
        "@type": "Service",
        name: "Ghana FDA Compliance",
        description:
          "Guidance through licensing, product registration, label reviews, documentation, and FDA inspection preparation.",
        provider: { "@type": "Organization", name: "Stroane", url: "https://stroanesolutions.com" },
        areaServed: "Ghana",
      },
    },
    {
      "@type": "ListItem",
      position: 4,
      item: {
        "@type": "Service",
        name: "Food Handler Training",
        description:
          "Hands-on training for staff on hygiene, food temperatures, cleaning, allergens, and contamination prevention.",
        provider: { "@type": "Organization", name: "Stroane", url: "https://stroanesolutions.com" },
        areaServed: "Ghana",
      },
    },
    {
      "@type": "ListItem",
      position: 5,
      item: {
        "@type": "Service",
        name: "Good Manufacturing Practice Audits",
        description:
          "Assessment of production environment, equipment, pest control, storage, and product flow to meet stronger manufacturing standards.",
        provider: { "@type": "Organization", name: "Stroane", url: "https://stroanesolutions.com" },
        areaServed: "Ghana",
      },
    },
    {
      "@type": "ListItem",
      position: 6,
      item: {
        "@type": "Service",
        name: "Import & Export Support",
        description:
          "Help understanding and meeting food safety documents, approvals, and standards for Ghanaian and international markets.",
        provider: { "@type": "Organization", name: "Stroane", url: "https://stroanesolutions.com" },
        areaServed: "Ghana",
      },
    },
  ],
};

const services = [
  {
    title: "Food Safety Audits",
    description:
      "We visit your premises and review how food is handled, stored, prepared, and served. You receive a clear report showing what is working, what is risky, and what should be fixed first.",
    ideal: "Restaurants, caterers, food producers, supermarkets, schools, hospitals.",
  },
  {
    title: "HACCP — Food Risk Management",
    description:
      "We help you identify where food safety risks can happen in your operation and create practical controls to prevent them before they affect customers.",
    ideal: "Food manufacturers, processors, exporters, caterers.",
  },
  {
    title: "Ghana FDA Compliance",
    description:
      "We guide you through licensing, product registration, label reviews, documentation, and FDA inspection preparation in clear, practical steps.",
    ideal: "Food and drug businesses operating in Ghana.",
  },
  {
    title: "Food Handler Training",
    description:
      "Hands-on training for staff on hygiene, food temperatures, cleaning routines, allergens, pest awareness, and contamination prevention.",
    ideal: "Restaurants, kitchens, food factories, schools, hotels.",
  },
  {
    title: "Good Manufacturing Practice Audits",
    description:
      "We assess your production environment, equipment, water, pest control, storage, and product flow to help you meet stronger manufacturing standards.",
    ideal: "Food manufacturers, packaged food producers, beverage companies.",
  },
  {
    title: "Food Label Reviews",
    description:
      "We check product labels for ingredients, allergens, best-before dates, weights, claims, and other Ghana FDA requirements before submission.",
    ideal: "Packaged food brands, beverage companies, importers.",
  },
  {
    title: "Cold Storage Checks",
    description:
      "We assess fridges, freezers, cold rooms, and delivery vehicles to confirm that food stays at safe temperatures from storage to delivery.",
    ideal: "Caterers, supermarkets, hospitals, logistics businesses.",
  },
  {
    title: "Import & Export Support",
    description:
      "We help food importers and exporters understand the documents, approvals, and safety standards required for Ghanaian and international markets.",
    ideal: "Agri-food exporters, food importers, trading companies.",
  },
];

const steps = [
  {
    title: "Free Consultation",
    description:
      "We start with a short call or meeting to understand your business, what you sell, and the food safety challenges you are facing.",
  },
  {
    title: "Clear Proposal",
    description:
      "You receive a simple proposal showing the work, timeline, deliverables, and cost before anything begins.",
  },
  {
    title: "Site Visit or Review",
    description:
      "Our advisor works with your team on-site or remotely, depending on the service and what needs to be checked.",
  },
  {
    title: "Report & Fix List",
    description:
      "We give you a clear report with findings, priority issues, and recommended actions your team can follow.",
  },
  {
    title: "Ongoing Support",
    description:
      "We stay available for training, follow-up reviews, retainer support, and future compliance checks.",
  },
];

const Services: React.FC = () => {
  useSEOMeta({
    title: "Food Safety Services Ghana | Stroane",
    description:
      "Food safety audits, HACCP systems, Ghana FDA compliance, food handler training, GMP audits, cold storage checks, and import/export support for Ghanaian food businesses.",
    keywords:
      "food safety services Ghana, Ghana FDA compliance consulting, HACCP implementation Ghana, food handler training Accra, GMP audit Ghana",
    canonical: "https://stroanesolutions.com/services",
  });

  return (
    <Layout>
      <StructuredData schema={SERVICES_SCHEMA} id="services-schema" />
      <div className="services-page">
        <section className="services-hero">
          <img
            src="/imgs/bg_imgs/services_hero.png"
            alt=""
            aria-hidden="true"
            className="services-hero__bg"
          />
          <div className="services-hero__overlay" />

          <div className="services-hero__content">
            <h1 className="services-hero__heading">
              Food Safety Services for Ghana
            </h1>
            <p className="services-hero__para">
              From audits and training to FDA compliance and HACCP support, we
              help food businesses build safer, stronger operations.
            </p>
          </div>
        </section>

        <section className="services-list">
          <div className="services-list__intro">
            <span className="services-kicker">What We Do</span>
            <h2 className="section__heading">
              Services built around how food businesses actually operate.
            </h2>
            <p className="section__sub services-list__sub">
              Whether you run a restaurant, school kitchen, food factory, shop,
              or export business, Stroane helps you understand what needs to be
              fixed and how to fix it.
            </p>
          </div>

          <div className="services-grid">
            {services.map((service, index) => (
              <article key={service.title} className="service-card">
                <span className="service-card__number">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <h3 className="service-card__title">{service.title}</h3>
                <p className="service-card__desc">{service.description}</p>
                <p className="service-card__ideal">
                  <strong>Good for: </strong>
                  {service.ideal}
                </p>
              </article>
            ))}
          </div>
        </section>

        <section className="services-process">
          <div className="services-process__inner">
            <div className="services-process__intro">
              <span className="services-kicker">How It Works</span>
              <h2 className="section__heading">
                Simple steps from first call to finished report.
              </h2>
            </div>

            <ol className="services-steps">
              {steps.map((step, index) => (
                <li key={step.title} className="services-step">
                  <span className="services-step__num">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <div>
                    <h3 className="services-step__title">{step.title}</h3>
                    <p className="services-step__desc">{step.description}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="services-cta">
          <div>
            <span className="services-kicker">Not sure where to start?</span>
            <h2 className="section__heading">
              Book a free consultation and we will tell you exactly what your
              business needs.
            </h2>
          </div>

          <Link to="/contact" className="services-cta__button">
            Book a Free Consultation
          </Link>
        </section>
      </div>
    </Layout>
  );
};

export default Services;