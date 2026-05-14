import { Link } from "react-router-dom";
import Layout from "../components/Layout";
import useSEOMeta from "../hooks/useSEOMeta";
import StructuredData from "../components/StructuredData";
import FloatingHeader from "../components/FloatingHeader";
import "../styles/pages/Home.css";

const HOME_SCHEMA = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": "https://stroanesolutions.com/#organization",
      name: "Stroane",
      url: "https://stroanesolutions.com",
      logo: "https://stroanesolutions.com/assets/og-image.png",
      description: "Food safety advisory and compliance services for food businesses in Ghana.",
      areaServed: "Ghana",
      address: { "@type": "PostalAddress", addressLocality: "Accra", addressCountry: "GH" },
    },
    {
      "@type": "LocalBusiness",
      "@id": "https://stroanesolutions.com/#business",
      name: "Stroane",
      url: "https://stroanesolutions.com",
      description: "Food safety audits, HACCP systems, Ghana FDA compliance, and food handler training for Ghanaian businesses.",
      address: { "@type": "PostalAddress", addressLocality: "Accra", addressCountry: "GH" },
      areaServed: "Ghana",
      hasOfferCatalog: {
        "@type": "OfferCatalog",
        name: "Food Safety Services",
        itemListElement: [
          { "@type": "Offer", itemOffered: { "@type": "Service", name: "Food Safety Audits" } },
          { "@type": "Offer", itemOffered: { "@type": "Service", name: "HACCP Systems" } },
          { "@type": "Offer", itemOffered: { "@type": "Service", name: "Ghana FDA Compliance" } },
          { "@type": "Offer", itemOffered: { "@type": "Service", name: "Food Handler Training" } },
        ],
      },
    },
    {
      "@type": "WebSite",
      "@id": "https://stroanesolutions.com/#website",
      url: "https://stroanesolutions.com",
      name: "Stroane",
      publisher: { "@id": "https://stroanesolutions.com/#organization" },
      potentialAction: {
        "@type": "SearchAction",
        target: "https://stroanesolutions.com/search?q={search_term_string}",
        "query-input": "required name=search_term_string",
      },
    },
  ],
};

const TRUST_STATS = [
  { value: "50+",  label: "Businesses served." },
  { value: "5+",   label: "Years of experience." },
  { value: "6",    label: "Core services." },
];


const WHY_CARDS = [
  {
    subtitle: "Community Focus",
    title: "Local Expertise",
    description: "We understand Ghana's food industry, regulatory landscape, and business culture — giving you advice that actually applies here.",
    img: "/imgs/why_stats/why_stat_1.png",
  },
  {
    subtitle: "Audit to Resolution",
    title: "End-to-End Support",
    description: "From the first inspection to your final certification, we stay with you at every step rather than handing you a report and leaving.",
    img: "/imgs/why_stats/why_stat_2.png",
  },
  {
    subtitle: "Global Frameworks",
    title: "International Standards",
    description: "We apply internationally recognised frameworks (HACCP, ISO 22000) so your business can compete and export with confidence.",
    img: "/imgs/why_stats/why_stat_3.png",
  },
];

const HOW_STEPS = [
  {
    step: "01",
    title: "Book a Consultation",
    description: "Tell us about your business and your goals. We'll identify the right services and build a plan around your situation.",
  },
  {
    step: "02",
    title: "We Assess Your Operation",
    description: "Our team visits your premises, reviews your processes, and identifies exactly where you stand against Ghana FDA standards.",
  },
  {
    step: "03",
    title: "You Get a Clear Action Plan",
    description: "We deliver a prioritised report with practical steps, realistic timelines, and ongoing support until you're fully compliant.",
  },
];

const services = [
  {
    subtitle: "On-Site Assessment",
    title: "Food Safety Audits",
    description: "We visit your premises, spot hygiene and safety issues, and give you a clear plan for fixing them before they become bigger problems.",
    img: "/imgs/services/service_1.png",
    href: "/services",
  },
  {
    subtitle: "Risk Management",
    title: "Food Risk Systems (HACCP)",
    description: "We help you set up a system that identifies where food safety risks happen in your operation and puts controls in place to prevent them.",
    img: "/imgs/services/service_2.png",
    href: "/services",
  },
  {
    subtitle: "Licensing & Approval",
    title: "Ghana FDA Compliance",
    description: "We guide you through getting licensed, registering products, and passing Ghana FDA inspections — step by step, in plain language.",
    img: "/imgs/services/service_3.png",
    href: "/services",
  },
];

const TESTIMONIALS = [
  {
    quote: "Stroane helped us get our Ghana FDA license in half the time we expected. They knew exactly what the inspectors were looking for and prepared us thoroughly.",
    name: "Ama Serwaa",
    role: "Operations Manager",
    company: "Golden Harvest Foods",
    initials: "AS",
  },
  {
    quote: "We had been struggling with our HACCP documentation for over a year. Stroane came in, understood our process, and had a proper system in place within two weeks.",
    name: "Kofi Mensah",
    role: "Production Supervisor",
    company: "Mensah Catering & Events",
    initials: "KM",
  },
  {
    quote: "The food handler training was practical and engaging. Our kitchen staff actually retained what they were taught, which made a real difference in our daily operations.",
    name: "Abena Boateng",
    role: "Executive Chef",
    company: "Kempinski Hotel Accra",
    initials: "AB",
  },
];

const RESOURCES = [
  {
    category: "Ghana FDA",
    title: "How to Register Your Food Product with Ghana FDA in 2025",
    excerpt: "A step-by-step breakdown of the registration process, the documents you need, and how long each stage typically takes.",
    date: "May 2025",
    href: "/resources",
  },
  {
    category: "HACCP",
    title: "The 7 HACCP Principles Every Food Business in Ghana Should Know",
    excerpt: "A plain-language guide to building a Hazard Analysis Critical Control Point system that actually works in your operation.",
    date: "April 2025",
    href: "/resources",
  },
  {
    category: "Training",
    title: "Why Food Handler Certificates Alone Are Not Enough",
    excerpt: "The difference between a certificate and actual food safety knowledge — and what you should really be checking in your team.",
    date: "March 2025",
    href: "/resources",
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

const Home = () => {
  useSEOMeta({
    title: "Food Safety Advisory & Compliance Ghana",
    description:
      "Stroane helps food businesses, manufacturers, and institutions in Ghana meet FDA standards, pass audits, and build safer operations. Audits, HACCP, training, and FDA compliance.",
    keywords:
      "food safety Ghana, Ghana FDA compliance, HACCP Ghana, food safety audit Ghana, food handler training Accra",
    canonical: "https://stroanesolutions.com/",
  });

  return (
    <Layout hideHeader>
      <StructuredData schema={HOME_SCHEMA} id="home-schema" />

      {/* ── Hero ── */}
      <section className="hero-section relative mx-4 md:mx-6 overflow-visible">
        <div className="hero-bg-container absolute inset-0 z-0 overflow-hidden">
          <video
            src="/imgs/bg_imgs/bg.mp4"
            className="hero-bg-img"
            autoPlay
            loop
            muted
            playsInline
            aria-hidden="true"
          />
        </div>
        <FloatingHeader />
        <div className="hero-section__content relative z-10 text-center">
          <h1 className="hero-heading">
            Protect Your Food.
            <br />
            Protect Your Family.
          </h1>
        </div>
        <img
          src="/imgs/elements/seller.png"
          alt="Food seller carrying a bowl of fresh produce"
          className="seller-img absolute bottom-0 left-1/2 z-[10] w-auto"
        />
      </section>

      {/* ── Trust stats ── */}
      <section className="trust-section pt-[20vh] pb-0">
        <div className="flex justify-center">
          <div className="trust-stats">
            {TRUST_STATS.map((stat) => (
              <div key={stat.label} className="glass-card trust-stat">
                <span className="trust-stat__value">{stat.value}</span>
                <span className="trust-stat__label">{stat.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Who We Serve ──
      <section className="who-section">
        <p className="who-section__label">Who we work with</p>
        <div className="who-loop-wrap">
          <LogoLoop
            logos={WHO_WE_SERVE}
            speed={55}
            direction="left"
            logoHeight={100}
            gap={24}
            hoverSpeed={0}
            fadeOut
            ariaLabel="Industries we serve"
          />
        </div>
      </section> */}

      {/* ── Why Stroane ── */}
      <section className="why-section">
        <h2 className="section__heading">Why Food Safety Matters</h2>
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
      </section>

      {/* ── How It Works ── */}
      <section className="howit-section">
        <h2 className="section__heading">How It Works</h2>
        <p className="section__sub">
          Getting your food business compliant is straightforward when you have the right partner.
        </p>
        <div className="steps">
          {HOW_STEPS.map((s) => (
            <div key={s.step} className="step">
              <span className="step__number">{s.step}</span>
              <h3 className="step__title">{s.title}</h3>
              <p className="step__desc">{s.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Services (3 core) ── */}
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
                <Link to={service.href} className="service-row__link">
                  Learn more <span aria-hidden="true">→</span>
                </Link>
              </div>
            </div>
          ))}
        </div>
        <div className="section__cta">
          <Link to="/services">View all services →</Link>
        </div>
      </section>

      {/* ── Testimonials ── */}
      <section className="testimonials-section">
        <h2 className="section__heading">What Our Clients Say</h2>
        <p className="section__sub">
          Businesses across Ghana trust Stroane to help them meet standards and stay compliant.
        </p>
        <div className="testimonial-cards">
          {TESTIMONIALS.map((t) => (
            <div key={t.name} className="testimonial-card">
              <p className="testimonial-card__quote">"{t.quote}"</p>
              <div className="testimonial-card__author">
                <div className="testimonial-card__avatar" aria-hidden="true">{t.initials}</div>
                <div>
                  <p className="testimonial-card__name">{t.name}</p>
                  <p className="testimonial-card__role">{t.role}</p>
                  <p className="testimonial-card__company">{t.company}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Resources teaser ── */}
      <section className="resources-home-section">
        <h2 className="section__heading">From Our Resources</h2>
        <p className="section__sub">
          Practical guides on food safety, Ghana FDA requirements, and compliance — written for businesses, not regulators.
        </p>
        <ol className="resource-list">
          {RESOURCES.map((r, i) => (
            <li key={r.title} className="resource-item">
              <Link to={r.href} className="resource-item__link">
                <span className="resource-item__num" aria-hidden="true">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div className="resource-item__body">
                  <div className="resource-item__top">
                    <span className="resource-item__category">{r.category}</span>
                    <span className="resource-item__date">{r.date}</span>
                  </div>
                  <h3 className="resource-item__title">{r.title}</h3>
                  <p className="resource-item__excerpt">{r.excerpt}</p>
                </div>
                <span className="resource-item__arrow" aria-hidden="true">→</span>
              </Link>
            </li>
          ))}
        </ol>
        <div className="section__cta">
          <Link to="/resources">Browse all resources →</Link>
        </div>
      </section>

      {/* ── Featured Products ── */}
      <section className="products-section">
        <h2 className="section__heading">Featured Products</h2>
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
