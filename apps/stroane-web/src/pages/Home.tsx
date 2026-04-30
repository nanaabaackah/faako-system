import React from "react";
import { Link } from "react-router-dom";
import Layout from "../components/Layout";
import usePageTitle from "../hooks/usePageTitle";
import FloatingHeader from "../components/FloatingHeader";
import "../styles/pages/Home.css";

const services = [
  {
    subtitle: "On-Site Assessment",
    title: "Food Safety Audits",
    description: "We visit your premises, spot hygiene and safety issues, and give you a clear plan for fixing them before they become bigger problems.",
    img: "/imgs/services/service_1.png",
  },
  {
    subtitle: "Risk Management",
    title: "Food Risk Systems (HACCP)",
    description: "We help you set up a system that identifies where food safety risks happen in your operation and puts controls in place to prevent them.",
    img: "/imgs/services/service_2.png",
  },
  {
    subtitle: "Licensing & Approval",
    title: "Ghana FDA Compliance",
    description: "We guide you through getting licensed, registering products, and passing Ghana FDA inspections — step by step, in plain language.",
    img: "/imgs/services/service_3.png",
  },
  {
    subtitle: "Staff Training",
    title: "Food Handler Training",
    description: "Hands-on training for your kitchen and production staff on hygiene, safe food temperatures, cleaning, and how to prevent food contamination.",
    img: "/imgs/services/service_4.png",
  },
  {
    subtitle: "Production Standards",
    title: "Manufacturing Practice Audits",
    description: "We check that the way your food is produced meets the standards required to sell to large retailers or export your products abroad.",
    img: "/imgs/services/service_5.png",
  },
  {
    subtitle: "Cross-Border Trade",
    title: "Import & Export Support",
    description: "We help you understand and meet the food safety rules of the countries you are selling to or buying from.",
    img: "/imgs/services/service_6.png",
  },
];

const featuredProducts = [
  {
    name: "Digital Fridge Thermometer",
    description: "Shows the exact temperature inside your fridge or freezer so you always know food is stored safely.",
    price: "GHS 85",
    tag: "Best Seller",
    img: "/imgs/products/product_1.png",
    href: "/products",
  },
  {
    name: "Food Probe Thermometer",
    description: "Insert into cooked food to confirm it has reached a safe temperature all the way through.",
    price: "GHS 120",
    tag: "Essential",
    img: "/imgs/products/product_2.png",
    href: "/products",
  },
  {
    name: "Infrared Thermometer Gun",
    description: "Check surface temperatures of counters, buffet trays, and storage units without touching them.",
    price: "GHS 195",
    tag: "Popular",
    img: "/imgs/products/product_3.png",
    href: "/products",
  },
];

const TRUST_STATS = [
  { value: "2k+", label: "Products." },
  { value: "100+",  label: "Resources." },
  { value: "200+",  label: "Users." },
];

const WHY_CARDS = [
  {
    subtitle: "Community Focus",
    title: "Local Expertise",
    img: "/imgs/why_stats/why_stat_1.png",
  },
  {
    subtitle: "Audit to Resolution",
    title: "End-to-End Support",
    img: "/imgs/why_stats/why_stat_2.png",
  },
  {
    subtitle: "Global Frameworks",
    title: "International Standards",
    img: "/imgs/why_stats/why_stat_3.png",
  },
];

const Home: React.FC = () => {
  usePageTitle("Food & Drug Safety Advisory");

  return (
    <Layout hideHeader>
      {/* Hero */}
      <section className="hero-section relative mx-4 md:mx-6 overflow-visible">
        <div className="hero-bg-container absolute inset-0 z-0 overflow-hidden">
          <img
            src="/imgs/bg_imgs/bg_2.png"
            alt=""
            aria-hidden="true"
            className="hero-bg-img"
          />
        </div>

        <FloatingHeader />

        <div className="relative z-10 pt-36 px-10 md:px-16 text-center">
          <h1 className="hero-heading text-[6rem] font-black leading-tight">
            Protect Your Food.
            <br />
            Protect Your Family.
          </h1>
        </div>

        <img
          src="/imgs/elements/seller.png"
          alt="Food seller carrying a bowl of fresh produce"
          className="seller-img absolute bottom-0 left-1/2 z-10 w-auto"
        />
      </section>

      {/* Why Stroane */}
      <section className="pt-[17.5vh] pb-16">
        {/* Trust stats */}
        <div className="flex justify-center mb-16">
          <div className="trust-stats">
            {TRUST_STATS.map((stat) => (
              <div key={stat.label} className="glass-card trust-stat">
                <span className="trust-stat__value">{stat.value}</span>
                <span className="trust-stat__label">{stat.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="why-section">
          <h2 className="section__heading">
            Why Food Safety Matters
          </h2>
          <p className="section__sub">
            As Ghana FDA standards rise and export markets tighten, food safety is no longer optional. Stroane helps businesses meet and maintain them.
          </p>
          <div className="glass-card cards">
            {WHY_CARDS.map((card) => (
              <div key={card.title} className="card">
                <img src={card.img} alt={card.title} className="card__img" />
                <div className="card__overlay" />
                <div className="card__content">
                  <span className="card__subtitle">{card.subtitle}</span>
                  <h3 className="card__title">{card.title}</h3>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Services Overview */}
      <section className="services-section">
        <h2 className="section__heading">Our Services</h2>
        <p className="section__sub">
          From initial audit to ongoing compliance, we cover every stage of your food safety journey.
        </p>
        <div className="service-list">
          {services.map((service, i) => (
            <div key={service.title} className={`service-row${i % 2 === 1 ? " service-row--reverse" : ""}`}>
              <div className="service-row__img-wrap">
                <img src={service.img} alt={service.title} className="service-row__img" />
              </div>
              <div className="service-row__text">
                <span className="service-row__subtitle">{service.subtitle}</span>
                <h3 className="service-row__title">{service.title}</h3>
                <p className="service-row__desc">{service.description}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="section__cta">
          <Link to="/services">View all services →</Link>
        </div>
      </section>

      {/* Featured Products */}
      <section className="products-section">
        <h2 className="section__heading">Featured Products</h2>
        <p className="section__sub">
          The tools our advisors recommend most — sourced and available in Ghana.
        </p>
        <div className="product-cards">
          {featuredProducts.map((product) => (
            <Link key={product.name} to={product.href} className="product-card">
              <div className="product-card__img-wrap">
                <img src={product.img} alt={product.name} className="product-card__img" />
                <span className="product-card__tag">{product.tag}</span>
              </div>
              <div className="product-card__body">
                <h3 className="product-card__name">{product.name}</h3>
                <p className="product-card__desc">{product.description}</p>
                <div className="product-card__footer">
                  <span className="product-card__price">{product.price}</span>
                  <span className="product-card__cta">View <span aria-hidden="true">→</span></span>
                </div>
              </div>
            </Link>
          ))}
        </div>
        <div className="section__cta">
          <Link to="/shop">Browse all products →</Link>
        </div>
      </section>

    </Layout>
  );
};

export default Home;
