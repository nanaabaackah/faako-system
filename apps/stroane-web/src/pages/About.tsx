import React from "react";
import Layout from "../components/Layout";
import usePageTitle from "../hooks/usePageTitle";
import "../styles/pages/About.css";

const values = [
  {
    title: "Practical First",
    description:
      "We give advice your team can actually use in a real kitchen, factory, school, shop, or production space.",
  },
  {
    title: "Local Knowledge",
    description:
      "Our work is built around Ghanaian food businesses, Ghana FDA expectations, and the realities of operating locally.",
  },
  {
    title: "Honest Assessments",
    description:
      "We tell you what is working, what is risky, and what needs to be fixed without overcomplicating the process.",
  },
  {
    title: "Continuous Improvement",
    description:
      "Food safety is not a one-time checklist. We help businesses build habits, systems, and confidence over time.",
  },
];

const businessGroups = [
  {
    title: "Food Businesses",
    items: [
      "Restaurants and chop bars",
      "Hotels and guest houses",
      "Catering companies",
      "Bakeries and confectioneries",
      "Street food vendors and hawkers",
      "Supermarkets and provision stores",
    ],
  },
  {
    title: "Producers & Institutions",
    items: [
      "Food processing companies",
      "Agri-food exporters",
      "Hospital and school canteens",
      "Pharmaceutical manufacturers",
      "Importers of food and drug products",
      "Cold chain and delivery operators",
    ],
  },
];

const standards = [
  {
    title: "Ghanaian Rules",
    items: [
      "Ghana Food and Drugs Authority regulations",
      "Ghana Standards Authority food standards",
      "Ghana FDA product registration requirements",
      "FDA licensing rules for food businesses",
      "Public Health Act requirements",
    ],
  },
  {
    title: "International Standards",
    items: [
      "Codex Alimentarius food safety guidance",
      "HACCP hazard prevention systems",
      "ISO 22000 food safety management",
      "WHO food safety guidelines",
      "Good Manufacturing Practice standards",
    ],
  },
];

const About: React.FC = () => {
  usePageTitle("About Us");

  return (
    <Layout>
      <div className="about-page">
        {/* ── Hero ── */}
        <section className="about-hero">
          <img
            src="/imgs/bg_imgs/about_hero.png"
            alt=""
            aria-hidden="true"
            className="about-hero__bg"
          />
          <div className="about-hero__overlay" />

          <div className="about-hero__content">
            <h1 className="about-hero__heading">
              Built for Ghana&apos;s Food Industry
            </h1>
            <p className="about-hero__para">
              Stroane helps food businesses, manufacturers, and institutions
              protect their customers, their licences, and their reputation.
            </p>
          </div>
        </section>

        {/* ── Story ── */}
        <section className="about-story">
          <div className="about-story__grid">
            <div className="about-kicker">Our Story</div>

            <div className="about-story__content">
              <h2 className="section__heading">
                Food safety support that understands the local reality.
              </h2>

              <p>
                Stroane was founded in Accra after years of seeing the same
                problem repeat across Ghana&apos;s food industry: businesses
                failed inspections not because they did not care, but because
                practical and affordable guidance was hard to access.
              </p>

              <p>
                We built Stroane to close that gap — combining Ghanaian food
                safety knowledge with hands-on support that businesses can use
                immediately. Today, we support restaurants, processors, schools,
                hospitals, hotels, and food vendors with clear advice, training,
                audits, and compliance guidance.
              </p>
            </div>
          </div>
        </section>

        {/* ── Mission / Vision ── */}
        <section className="about-beliefs">
          <article className="about-belief-card about-belief-card--blue">
            <span className="about-card-label">Mission</span>
            <h2 className="section__heading">
              Make food safety practical and affordable.
            </h2>
            <p>
              We help food and drug businesses in Ghana understand what is
              required, fix what matters, and build safer operations without
              making compliance feel impossible.
            </p>
          </article>

          <article className="about-belief-card">
            <span className="about-card-label">Vision</span>
            <h2 className="section__heading">
              Safer food. Stronger businesses. More trust.
            </h2>
            <p>
              We want to see a Ghana where foodborne illness is rare, local
              products meet international standards, and food safety becomes a
              source of national pride.
            </p>
          </article>
        </section>

        {/* ── Values ── */}
        <section className="about-values">
          <h2 className="section__heading">What Guides Our Work</h2>
          <p className="section__sub">
            Our approach is simple: make standards easier to understand, easier
            to apply, and easier to maintain.
          </p>

          <div className="about-values__grid">
            {values.map((value, index) => (
              <article key={value.title} className="about-value-card">
                <span className="about-value-card__number">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <h3>{value.title}</h3>
                <p>{value.description}</p>
              </article>
            ))}
          </div>
        </section>

        {/* ── CTA ── */}
        <section className="about-cta">
          <div>
            <span className="about-kicker">Ready to improve your system?</span>
            <h2 className="section__heading">
              Let&apos;s make your food business safer and easier to run.
            </h2>
          </div>

          <a href="/contact" className="about-cta__button">
            Book a Consultation
          </a>
        </section>

        {/* ── Who We Work With ── */}
        <section className="about-audience">
          <div className="about-section-intro">
            <span className="about-kicker">Who We Work With</span>
            <h2 className="section__heading">
              From small kitchens to growing production teams.
            </h2>
            <p>
              Stroane supports both everyday food businesses and larger
              institutions that need stronger systems, better documentation, and
              reliable compliance support.
            </p>
          </div>

          <div className="about-audience__grid">
            {businessGroups.map((group) => (
              <article key={group.title} className="about-list-card">
                <h3>{group.title}</h3>
                <ul>
                  {group.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </section>

        {/* ── Standards ── */}
        <section className="about-standards">
          <div className="about-standards__content">
            <span className="about-kicker">Rules &amp; Standards</span>
            <h2 className="section__heading">
              Grounded in Ghanaian rules. Aligned with global practice.
            </h2>
            <p>
              Our team follows Ghanaian regulations and international food
              safety frameworks, so your business can stay prepared for
              inspections, product approvals, audits, and growth.
            </p>
          </div>

          <div className="about-standards__cards">
            {standards.map((standard) => (
              <article key={standard.title} className="about-standard-card">
                <h3>{standard.title}</h3>
                <ul>
                  {standard.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </section>
      </div>
    </Layout>
  );
};

export default About;