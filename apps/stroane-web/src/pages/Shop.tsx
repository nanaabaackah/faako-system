import React from "react";
import { Link } from "react-router-dom";
import Layout from "../components/Layout";
import usePageTitle from "../hooks/usePageTitle";
import "../styles/pages/Shop.css";

const categories = [
  {
    name: "Thermometers & Temperature Monitoring",
    description:
      "Tools that help you confirm food is stored, cooked, and delivered at safe temperatures.",
    products: [
      "Digital fridge and freezer thermometers",
      "Food probe thermometers",
      "Infrared thermometers",
      "Temperature data loggers",
      "Min/max thermometers",
    ],
  },
  {
    name: "Food Safety Testing Kits",
    description:
      "Simple kits for checking safety conditions on the spot, without always needing a lab.",
    products: [
      "pH test strips and meters",
      "Surface cleanliness swab kits",
      "Allergen rapid test kits",
      "Sanitiser strength test strips",
      "Water quality test kits",
    ],
  },
  {
    name: "Food Storage & Cold Chain",
    description:
      "Products that help food stay protected during storage, transport, and delivery.",
    products: [
      "Insulated food delivery bags",
      "Hard-shell cool boxes",
      "Food-grade storage containers",
      "Vacuum-sealed storage bags",
      "Fridge organiser bins",
    ],
  },
  {
    name: "Protective Clothing & Equipment",
    description:
      "Affordable items that help protect food from contamination during handling.",
    products: [
      "Disposable gloves",
      "Hair nets and beard covers",
      "Disposable aprons",
      "Sleeve covers",
      "Disposable face masks",
    ],
  },
  {
    name: "Kitchen Hygiene & Cleaning",
    description:
      "Cleaning and hygiene tools that support safer food preparation spaces.",
    products: [
      "Colour-coded chopping boards",
      "Colour-coded knife sets",
      "Food-safe sanitisers",
      "Probe wipes",
      "Cleaning log books",
    ],
  },
  {
    name: "Labels & Record Keeping",
    description:
      "Simple tools for traceability, food rotation, allergen warnings, and inspection readiness.",
    products: [
      "Date and use-by labels",
      "Allergen warning labels",
      "Food rotation label dispensers",
      "Food safety record sheets",
      "Temperature log books",
    ],
  },
];

const Shop: React.FC = () => {
  usePageTitle("Shop");

  return (
    <Layout>
      <div className="shop-page">
        <section className="shop-hero">
          <img
            src="/imgs/bg_imgs/shop_hero.png"
            alt=""
            aria-hidden="true"
            className="shop-hero__bg"
          />
          <div className="shop-hero__overlay" />

          <div className="shop-hero__content">
            <h1 className="shop-hero__heading">
              Shop Food Safety Products
            </h1>
            <p className="shop-hero__para">
              Professional food safety equipment and supplies, sourced for food
              businesses operating in Ghana.
            </p>
          </div>
        </section>

        <section className="shop-categories">
          <div className="shop-intro">
            <span className="shop-kicker">Product Categories</span>
            <h2 className="section__heading">
              Practical tools for safer kitchens, storage, and production.
            </h2>
            <p className="section__sub shop-intro__sub">
              These are the tools our advisors recommend most for monitoring,
              hygiene, cold chain control, and inspection readiness.
            </p>
          </div>

          <div className="shop-category-grid">
            {categories.map((category) => (
              <article key={category.name} className="shop-category-card">
                <h3>{category.name}</h3>
                <p>{category.description}</p>
                <ul>
                  {category.products.map((product) => (
                    <li key={product}>{product}</li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </section>

        <section className="shop-order">
          <div>
            <span className="shop-kicker">How to Order</span>
            <h2 className="section__heading">
              Online checkout is coming soon. For now, order directly.
            </h2>
            <p>
              Contact us to check availability, request a quote, or place a bulk
              order. We supply businesses in Accra and can arrange delivery to
              other regions.
            </p>
          </div>

          <Link to="/products" className="shop-order__button">
            View Product Listings
          </Link>
        </section>
      </div>
    </Layout>
  );
};

export default Shop;