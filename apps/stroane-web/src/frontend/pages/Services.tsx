import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import type { IconType } from "react-icons";
import {
  HiClipboardCheck,
  HiShieldCheck,
  HiOfficeBuilding,
  HiUserGroup,
  HiCog,
  HiTag,
  HiCube,
  HiGlobe,
} from "react-icons/hi";
import Layout from "../../components/Layout";
import useSEOMeta from "../../hooks/useSEOMeta";
import StructuredData from "../../components/StructuredData";
import "../styles/Services.css";

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

type Service = {
  title: string;
  line: string;
  ideal: string;
  tone: "primary" | "accent" | "dark" | "success" | "warning";
  image: string;
  Icon: IconType;
};

const services: Service[] = [
  {
    title: "Food Safety Audits",
    line: "We walk your premises and tell you what's working, what's risky, and what to fix first.",
    ideal: "Restaurants, caterers, food producers, supermarkets, schools, hospitals.",
    tone: "primary",
    image: "/imgs/services/service_1.png",
    Icon: HiClipboardCheck,
  },
  {
    title: "HACCP — Food Risk Management",
    line: "We map where risk hides in your operation and build practical controls to stop it.",
    ideal: "Food manufacturers, processors, exporters, caterers.",
    tone: "accent",
    image: "/imgs/services/service_2.png",
    Icon: HiShieldCheck,
  },
  {
    title: "Ghana FDA Compliance",
    line: "Licensing, registration, label reviews, and inspection prep — explained step by step.",
    ideal: "Food and drug businesses operating in Ghana.",
    tone: "dark",
    image: "/imgs/services/service_3.png",
    Icon: HiOfficeBuilding,
  },
  {
    title: "Food Handler Training",
    line: "Hands-on staff training on hygiene, temperatures, allergens, and contamination.",
    ideal: "Restaurants, kitchens, food factories, schools, hotels.",
    tone: "warning",
    image: "/imgs/services/service_4.png",
    Icon: HiUserGroup,
  },
  {
    title: "Good Manufacturing Practice Audits",
    line: "We assess your factory floor against stronger manufacturing standards.",
    ideal: "Food manufacturers, packaged food producers, beverage companies.",
    tone: "success",
    image: "/imgs/services/service_5.png",
    Icon: HiCog,
  },
  {
    title: "Food Label Reviews",
    line: "Label checks against Ghana FDA rules before you submit or print.",
    ideal: "Packaged food brands, beverage companies, importers.",
    tone: "primary",
    image: "/imgs/services/service_6.png",
    Icon: HiTag,
  },
  {
    title: "Cold Storage Checks",
    line: "Confirming your fridges, freezers, and vehicles keep food at safe temperatures.",
    ideal: "Caterers, supermarkets, hospitals, logistics businesses.",
    tone: "accent",
    image: "/imgs/services/service_1.png",
    Icon: HiCube,
  },
  {
    title: "Import & Export Support",
    line: "Navigating documents, approvals, and standards for cross-border food trade.",
    ideal: "Agri-food exporters, food importers, trading companies.",
    tone: "warning",
    image: "/imgs/services/service_2.png",
    Icon: HiGlobe,
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

  const stageRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [activeStep, setActiveStep] = useState(0);

  useEffect(() => {
    let frame = 0;

    const updateActiveService = () => {
      const el = stageRef.current;
      frame = 0;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const total = rect.height - window.innerHeight;
      if (total <= 0) return;
      const progress = Math.max(0, Math.min(1, -rect.top / total));
      const idx = Math.min(services.length - 1, Math.floor(progress * services.length));
      setActiveIndex(idx);
    };

    const onScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(updateActiveService);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    updateActiveService();
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  const scrollToService = (i: number) => {
    const el = stageRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const total = rect.height - window.innerHeight;
    const stageTop = window.scrollY + rect.top;
    const targetProgress = (i + 0.5) / services.length;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({
      top: stageTop + total * targetProgress,
      behavior: reduceMotion ? "auto" : "smooth",
    });
  };

  const handleServiceKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, i: number) => {
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      scrollToService(Math.min(services.length - 1, i + 1));
    }
    if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      scrollToService(Math.max(0, i - 1));
    }
    if (e.key === "Home") {
      e.preventDefault();
      scrollToService(0);
    }
    if (e.key === "End") {
      e.preventDefault();
      scrollToService(services.length - 1);
    }
  };

  const handleStepKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, i: number) => {
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      setActiveStep(Math.min(steps.length - 1, i + 1));
    }
    if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      setActiveStep(Math.max(0, i - 1));
    }
    if (e.key === "Home") {
      e.preventDefault();
      setActiveStep(0);
    }
    if (e.key === "End") {
      e.preventDefault();
      setActiveStep(steps.length - 1);
    }
  };

  const active = services[activeIndex];
  const ActiveIcon = active.Icon;

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
            <div className="services-hero__actions" aria-label="Services page actions">
              <Link to="/contact" className="services-hero__button services-hero__button--primary">
                Contact Stroane
              </Link>
              <Link to="/shop" className="services-hero__button services-hero__button--secondary">
                Shop Equipment
              </Link>
            </div>
          </div>
        </section>

        <section className="services-story">
          <div className="services-story__intro" data-scroll-reveal="">
            <span className="services-kicker">What We Do</span>
            <h2 className="section__heading">
              Practical support for every food safety pressure point.
            </h2>
          </div>

          {/* Mobile-only stacked list */}
          <div className="services-story__mobile-list">
            {services.map((s, i) => {
              const ItemIcon = s.Icon;
              return (
                <article key={s.title} className="services-story__item" data-scroll-reveal="">
                  <div
                    className={`bubble-card services-story__item-visual services-story__visual--${s.tone}`}
                  >
                    <img
                      src={s.image}
                      alt=""
                      aria-hidden="true"
                      className="services-story__visual-bg"
                    />
                    <div className="services-story__visual-overlay" aria-hidden="true" />
                    <span className="services-story__visual-num" aria-hidden="true">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <div className="services-story__visual-icon">
                      <ItemIcon size={88} aria-hidden={true} />
                    </div>
                  </div>
                  <div className="services-story__item-body">
                    <h3 className="services-story__title">{s.title}</h3>
                    <p className="services-story__line">{s.line}</p>
                    <p className="services-story__ideal">
                      <strong>Good for: </strong>{s.ideal}
                    </p>
                  </div>
                </article>
              );
            })}
          </div>

          <div
            ref={stageRef}
            className="services-story__stage"
            style={{ minHeight: `${services.length * 90}vh` }}
          >
            <div className="services-story__pinned">
              <div className="services-story__left">
                <div className="services-story__counter">
                  <span className="services-story__counter-num">
                    {String(activeIndex + 1).padStart(2, "0")}
                  </span>
                  <span className="services-story__counter-total">
                    / {String(services.length).padStart(2, "0")}
                  </span>
                </div>

                <div key={activeIndex} className="services-story__copy">
                  <h3 className="services-story__title">{active.title}</h3>
                  <p className="services-story__line">{active.line}</p>
                  <p className="services-story__ideal">
                    <strong>Good for: </strong>
                    {active.ideal}
                  </p>
                </div>

                <div
                  className="services-story__dots"
                  role="tablist"
                  aria-label="Service navigation"
                >
                  {services.map((s, i) => (
                    <button
                      key={s.title}
                      type="button"
                      role="tab"
                      id={`service-tab-${i}`}
                      aria-selected={i === activeIndex}
                      aria-controls="service-panel"
                      aria-label={s.title}
                      className={`services-story__dot${i === activeIndex ? " services-story__dot--active" : ""}`}
                      onClick={() => scrollToService(i)}
                      onKeyDown={(e) => handleServiceKeyDown(e, i)}
                    />
                  ))}
                </div>
              </div>

              <div
                id="service-panel"
                role="tabpanel"
                aria-labelledby={`service-tab-${activeIndex}`}
                className={`services-story__visual services-story__visual--${active.tone}`}
              >
                <img
                  key={`bg-${activeIndex}`}
                  src={active.image}
                  alt=""
                  aria-hidden="true"
                  className="services-story__visual-bg"
                />
                <div className="services-story__visual-overlay" aria-hidden="true" />
                <span className="services-story__visual-num" aria-hidden="true">
                  {String(activeIndex + 1).padStart(2, "0")}
                </span>
                <div key={`icon-${activeIndex}`} className="services-story__visual-icon">
                  <ActiveIcon size={148} aria-hidden={true} />
                </div>
                <span className="services-story__visual-label" aria-hidden="true">
                  {active.title}
                </span>
              </div>
            </div>
          </div>
        </section>

        <section className="services-process" id="services-process">
          <div className="services-process__inner">
            <div className="services-process__intro" data-scroll-reveal="">
              <span className="services-kicker">How It Works</span>
              <h2 className="section__heading">
                Simple steps from first call to finished report.
              </h2>
            </div>

            <div className="step-tabs" data-scroll-reveal="">
              <div className="step-tabs__list" role="tablist" aria-label="Our process">
                {steps.map((s, i) => (
                  <button
                    key={s.title}
                    type="button"
                    role="tab"
                    id={`step-tab-${i}`}
                    aria-selected={activeStep === i}
                    aria-controls={`step-panel-${i}`}
                    className={`step-tab${activeStep === i ? " step-tab--active" : ""}${i < activeStep ? " step-tab--done" : ""}`}
                    onClick={() => setActiveStep(i)}
                    onKeyDown={(e) => handleStepKeyDown(e, i)}
                  >
                    <span className="step-tab__num">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span className="step-tab__hint">{s.title}</span>
                  </button>
                ))}
              </div>

              <div className="step-tabs__progress" aria-hidden="true">
                <div
                  className="step-tabs__progress-fill"
                  style={{
                    width: `${((activeStep + 1) / steps.length) * 100}%`,
                  }}
                />
              </div>

              <div
                key={activeStep}
                role="tabpanel"
                id={`step-panel-${activeStep}`}
                aria-labelledby={`step-tab-${activeStep}`}
                className="step-tabs__panel"
              >
                <span className="step-tabs__panel-meta">
                  Step {activeStep + 1} of {steps.length}
                </span>
                <h3 className="step-tabs__panel-title">
                  {steps[activeStep].title}
                </h3>
                <p className="step-tabs__panel-desc">
                  {steps[activeStep].description}
                </p>
              </div>

              <div className="step-tabs__nav">
                <button
                  type="button"
                  className="step-tabs__nav-btn"
                  onClick={() => setActiveStep((i) => Math.max(0, i - 1))}
                  disabled={activeStep === 0}
                >
                  <span aria-hidden="true">←</span> Previous
                </button>
                <button
                  type="button"
                  className="step-tabs__nav-btn step-tabs__nav-btn--primary"
                  onClick={() =>
                    setActiveStep((i) => Math.min(steps.length - 1, i + 1))
                  }
                  disabled={activeStep === steps.length - 1}
                >
                  Next <span aria-hidden="true">→</span>
                </button>
              </div>
            </div>
          </div>
        </section>

        <section className="services-cta" data-scroll-reveal="">
          <div className="services-cta__copy">
            <span className="services-kicker">Ready When You Are</span>
            <h2 className="section__heading">
              Need a food safety plan that matches your operation?
            </h2>
            <p>
              Tell us what you run and where the pressure is. We will help you
              choose the right service, timeline, and next step.
            </p>
          </div>

          <div className="services-cta__actions">
            <Link to="/contact" className="services-cta__button">
              Contact Stroane
            </Link>
            <Link to="/resources" className="services-cta__button services-cta__button--secondary">
              View Resources
            </Link>
          </div>
        </section>

      </div>
    </Layout>
  );
};

export default Services;
