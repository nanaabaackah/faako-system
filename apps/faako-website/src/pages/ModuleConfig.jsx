import { Fragment, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCheckCircle,
  faArrowRight,
  faGlobe,
  faBoxesStacked,
  faHandshake,
  faReceipt,
  faCalendarDays,
  faCalendarCheck,
  faChartLine,
  faMoneyBillWave,
  faUserTie,
  faTruck,
  faPlug,
  faHeadset,
  faLightbulb,
  faCheck,
  faStore,
  faTruckFast,
  faGlassCheers,
  faBriefcase,
  faIndustry,
  faUtensils,
  faBolt,
  faCircle,
} from "@fortawesome/free-solid-svg-icons";
import PrimaryButton from "../components/PrimaryButton.jsx";
import WhatsApp from "../components/WhatsApp.jsx";
import "../styles/pages/ModuleConfig.css";

// Core modules (always included)
const coreModules = [
  {
    id: "website",
    name: "Website",
    description: "Business website that captures enquiries and supports Mobile Money.",
    icon: faGlobe,
    tag: "Digital",
    required: true,
  },
  {
    id: "dashboard",
    name: "Dashboard",
    description: "Live view of sales, stock, and cashflow.",
    icon: faChartLine,
    tag: "Core",
    required: true,
  },
  {
    id: "reports",
    name: "Reports",
    description: "Daily, weekly, and monthly reports by WhatsApp or email.",
    icon: faReceipt,
    tag: "Core",
    required: true,
  },
];

// Add-on modules (optional)
const addOnModules = [
  {
    id: "inventory",
    name: "Inventory",
    description: "Track stock clearly across locations.",
    icon: faBoxesStacked,
    tag: "Operations",
    popular: true,
  },
  {
    id: "crm",
    name: "CRM",
    description: "Track enquiries, customers, and sales progress.",
    icon: faHandshake,
    tag: "Sales",
    popular: true,
  },
  {
    id: "orders",
    name: "Orders",
    description: "Track orders from quote to delivery.",
    icon: faReceipt,
    tag: "Operations",
    popular: true,
  },
  {
    id: "bookings",
    name: "Bookings",
    description: "Manage reservations and booking schedules.",
    icon: faCalendarDays,
    tag: "Scheduling",
  },
  {
    id: "scheduler",
    name: "Scheduler",
    description: "Manage staff shifts and availability.",
    icon: faCalendarCheck,
    tag: "Scheduling",
  },
  {
    id: "delivery",
    name: "Delivery",
    description: "Track routes and delivery confirmation.",
    icon: faTruck,
    tag: "Operations",
  },
  {
    id: "payments",
    name: "Payments",
    description: "Track Mobile Money, invoices, and payments.",
    icon: faMoneyBillWave,
    tag: "Finance",
  },
  {
    id: "hr",
    name: "HR & Payroll",
    description: "Manage staff records, payroll, and attendance.",
    icon: faUserTie,
    tag: "People",
  },
  {
    id: "integrations",
    name: "Integrations",
    description: "Connect tools like QuickBooks, Xero, and WhatsApp.",
    icon: faPlug,
    tag: "System",
  },
  {
    id: "support",
    name: "Support Desk",
    description: "Handle customer requests and support history.",
    icon: faHeadset,
    tag: "Support",
  },
  {
    id: "analytics",
    name: "Analytics",
    description: "Deeper reports and planning insights.",
    icon: faChartLine,
    tag: "Insights",
  },
];

// Industry presets with FontAwesome icons
const industryPresets = {
  retail: {
    name: "Retail & Shops",
    icon: faStore,
    iconColor: "#FF6B35",
    modules: ["inventory", "crm", "orders", "payments"],
    description: "Great for shops, boutiques, and retail chains",
  },
  distribution: {
    name: "Distribution & Wholesale",
    icon: faTruckFast,
    iconColor: "#F7931E",
    modules: ["inventory", "orders", "delivery", "crm", "payments"],
    description: "Track stock across warehouses and manage deliveries",
  },
  events: {
    name: "Events & Rentals",
    icon: faGlassCheers,
    iconColor: "#9B59B6",
    modules: ["bookings", "inventory", "scheduler", "payments"],
    description: "Manage bookings, track equipment, and schedule staff",
  },
  services: {
    name: "Professional Services",
    icon: faBriefcase,
    iconColor: "#3498DB",
    modules: ["crm", "scheduler", "bookings", "payments"],
    description: "Manage clients, appointments, and billing",
  },
  manufacturing: {
    name: "Manufacturing",
    icon: faIndustry,
    iconColor: "#E74C3C",
    modules: ["inventory", "orders", "scheduler", "hr"],
    description: "Track production, materials, and labor",
  },
  food: {
    name: "Food & Beverage",
    icon: faUtensils,
    iconColor: "#27AE60",
    modules: ["inventory", "orders", "delivery", "scheduler"],
    description: "Manage menu items, orders, and deliveries",
  },
};

const processSteps = [
  {
    title: "You Configure",
    description: "Pick your features and see your estimate instantly.",
  },
  {
    title: "We Review",
    description: "We call to confirm your needs and tool connections.",
  },
  {
    title: "We Build",
    description: "We build, test, and share progress each week.",
  },
  {
    title: "You Launch",
    description: "We train your team and support your launch.",
  },
];

const dependencyPairs = [
  {
    title: "Inventory + Delivery",
    description:
      "Track stock levels and delivery routes in one place. Great for distribution teams.",
    firstIcon: faBoxesStacked,
    secondIcon: faTruck,
  },
  {
    title: "CRM + Orders",
    description: "See customer history while handling orders. Respond faster.",
    firstIcon: faHandshake,
    secondIcon: faReceipt,
  },
  {
    title: "Bookings + Scheduler",
    description: "Match bookings with staff availability and avoid double-booking.",
    firstIcon: faCalendarDays,
    secondIcon: faCalendarCheck,
  },
  {
    title: "Payments + Reports",
    description: "See cashflow clearly and know what is still outstanding.",
    firstIcon: faMoneyBillWave,
    secondIcon: faChartLine,
  },
];

const faqItems = [
  {
    title: "Can I start small and add modules later?",
    description:
      "Yes. Start with Website + Dashboard + Reports, then add modules as you grow. No rebuild needed.",
  },
  {
    title: "What if I don't see a module I need?",
    description:
      "We can build a custom feature for your business and include it in your quote.",
  },
  {
    title: "Can I remove modules after launch?",
    description:
      "Yes. We can switch off unused features while keeping your past data available.",
  },
  {
    title: "How does pricing work for custom modules?",
    description:
      "Custom work depends on effort. Most custom features fall in the GH₵ 1,800–4,500 range.",
  },
  {
    title: "Do modules work on mobile?",
    description:
      "Every feature works on desktop, tablet, and phone with synced data.",
  },
  {
    title: "Can modules integrate with QuickBooks/Xero?",
    description:
      "Yes. Select Integrations and we can connect your accounting and messaging tools.",
  },
];

const hasSameModuleSet = (left, right) => {
  if (left.length !== right.length) {
    return false;
  }
  const leftSet = new Set(left);
  return right.every((value) => leftSet.has(value));
};

export default function ModuleConfig() {
  const [selectedAddOns, setSelectedAddOns] = useState([]);
  const [selectedIndustry, setSelectedIndustry] = useState(null);
  const [showEstimate, setShowEstimate] = useState(false);

  const toggleAddOn = (id) => {
    setShowEstimate(true);
    setSelectedAddOns((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const applyIndustryPreset = (industryKey) => {
    setSelectedIndustry(industryKey);
    setSelectedAddOns(industryPresets[industryKey].modules);
    setShowEstimate(true);
  };

  const resetConfiguration = () => {
    setSelectedAddOns([]);
    setSelectedIndustry(null);
    setShowEstimate(false);
  };

  useEffect(() => {
    const matchedIndustryEntry = Object.entries(industryPresets).find(
      ([, preset]) => hasSameModuleSet(selectedAddOns, preset.modules)
    );
    const nextIndustry = matchedIndustryEntry ? matchedIndustryEntry[0] : null;
    setSelectedIndustry((current) =>
      current === nextIndustry ? current : nextIndustry
    );
  }, [selectedAddOns]);

  const estimatedPrice = useMemo(() => {
    const basePrice = 8500;
    const modulePrice = selectedAddOns.length * 1800;
    return basePrice + modulePrice;
  }, [selectedAddOns]);

  const estimatedTimeline = useMemo(() => {
    const baseWeeks = 4;
    const moduleWeeks = Math.ceil(selectedAddOns.length / 2);
    return baseWeeks + moduleWeeks;
  }, [selectedAddOns]);

  const selectedAddOnModules = useMemo(
    () => addOnModules.filter((module) => selectedAddOns.includes(module.id)),
    [selectedAddOns]
  );

  return (
    <section className="page module-config page-stack">

      {/* ========================================
          HERO SECTION
          ======================================== */}
      <section className="config-hero">
        <div className="config-hero-content reveal" data-scroll>
          <p className="eyebrow">System Builder</p>
          <h1>
            Build your system.<br />{" "}
            <span className="text-accent">Pick what you need.</span>
          </h1>
          <p className="lead">
            Start with the essentials. Add modules as you grow.
            We'll show you the price and timeline instantly.
          </p>
          <div className="hero-actions">
            <PrimaryButton to="/contact">Talk to an expert</PrimaryButton>
            <a className="button button-ghost" href="#addon-modules">
              Build custom setup
            </a>
          </div>
        </div>

        {/* Quick Stats */}
        <div
          className="config-stats reveal"
          data-scroll
          style={{ "--delay": "100ms" }}
        >
          <article className="stat-item">
            <div className="stat-icon">
              <FontAwesomeIcon icon={faBolt} />
            </div>
            <div className="stat-content">
              <div className="stat-value">4-8 weeks</div>
              <div className="stat-label">Average setup</div>
            </div>
          </article>

          <article className="stat-item">
            <div className="stat-icon">
              <FontAwesomeIcon icon={faCheck} />
            </div>
            <div className="stat-content">
              <div className="stat-value">{coreModules.length + selectedAddOns.length}</div>
              <div className="stat-label">Features in your setup</div>
            </div>
          </article>

          <article className="stat-item">
            <div className="stat-icon">
              <FontAwesomeIcon icon={faLightbulb} />
            </div>
            <div className="stat-content">
              <div className="stat-value">GH₵ 8.5k</div>
              <div className="stat-label">Starting price</div>
            </div>
          </article>
        </div>
      </section>

      {/* ========================================
          INDUSTRY PRESETS
          ======================================== */}
      <section className="page industry-presets">
        <div className="section-header reveal" data-scroll>
          <p className="eyebrow">Quick Start</p>
          <h2>Choose your business type for instant recommendations.</h2>
          <p className="lead">
            We pre-selected common setups. Click once to apply.
          </p>
        </div>

        <div className="presets-grid">
          {Object.entries(industryPresets).map(([key, preset], index) => (
            <button
              key={key}
              type="button"
              aria-pressed={selectedIndustry === key}
              className={`preset-card reveal ${
                selectedIndustry === key ? "is-active" : ""
              }`}
              data-scroll
              style={{ "--delay": `${100 + index * 70}ms` }}
              onClick={() => applyIndustryPreset(key)}
            >
              <div className="preset-icon-wrapper">
                <FontAwesomeIcon
                  icon={preset.icon}
                  className="preset-icon"
                  style={{ color: preset.iconColor }}
                />
              </div>
              <h3>{preset.name}</h3>
              <p>{preset.description}</p>
              <div className="preset-meta">
                <span className="preset-modules">{preset.modules.length} modules</span>
                <span className="preset-state">
                  {selectedIndustry === key ? "Applied" : "Apply"}
                </span>
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* ========================================
          CORE MODULES
          ======================================== */}
      <section className="page core-modules-section">
        <div className="section-header reveal" data-scroll>
          <p className="eyebrow">Always Included</p>
          <h2>Every system starts with these three.</h2>
          <p className="lead">
            These are the foundation. You get all three in every package.
          </p>
        </div>

        <div className="config-module-grid">
          {coreModules.map((module, index) => (
            <article
              key={module.id}
              className="config-module-card is-core reveal"
              data-scroll
              style={{ "--delay": `${120 + index * 60}ms` }}
            >
              <div className="module-card-header">
                <div className="module-icon">
                  <FontAwesomeIcon icon={module.icon} />
                </div>
                <span className="module-tag core-tag">Core</span>
              </div>
              <h3>{module.name}</h3>
              <p>{module.description}</p>
              <div className="module-badge">
                <FontAwesomeIcon icon={faCheck} /> Included
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* ========================================
          ADD-ON MODULES
          ======================================== */}
      <section className="page addon-modules-section" id="addon-modules">
        <div className="section-header reveal" data-scroll>
          <p className="eyebrow">Add What You Need</p>
          <h2>Pick the modules that match your business.</h2>
          <p className="lead">
            Click to select. We will calculate your price and timeline.
          </p>
        </div>

        <div className="module-selection-bar reveal" data-scroll style={{ "--delay": "80ms" }}>
          <p>
            <strong>{selectedAddOns.length}</strong> add-on module
            {selectedAddOns.length === 1 ? "" : "s"} selected
            {selectedIndustry ? ` · ${industryPresets[selectedIndustry].name} preset` : ""}
          </p>
          <button
            type="button"
            className="config-reset"
            onClick={resetConfiguration}
            disabled={!selectedAddOns.length && !showEstimate}
          >
            Reset configuration
          </button>
        </div>

        <div className="config-module-grid">
          {addOnModules.map((module, index) => {
            const isSelected = selectedAddOns.includes(module.id);
            return (
              <button
                key={module.id}
                type="button"
                aria-pressed={isSelected}
                className={`config-module-card is-selectable reveal ${
                  isSelected ? "is-selected" : ""
                }`}
                data-scroll
                onClick={() => toggleAddOn(module.id)}
                style={{ "--delay": `${80 + index * 60}ms` }}
              >
                <div className="module-card-header">
                  <div className="module-icon">
                    <FontAwesomeIcon icon={module.icon} />
                  </div>
                  <span className="module-tag">{module.tag}</span>
                  {module.popular && !isSelected && (
                    <span className="popular-badge">Popular</span>
                  )}
                </div>
                <h3>{module.name}</h3>
                <p>{module.description}</p>
                <div className="module-price">+ GH₵ 1,800</div>
                <div className="module-select">
                  <FontAwesomeIcon icon={isSelected ? faCheckCircle : faCircle} />
                  {isSelected ? "Added" : "Click to add"}
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* ========================================
          PRICE ESTIMATE
          ======================================== */}
      {showEstimate && (
        <section className="page estimate-section">
          <div className="estimate-card reveal" data-scroll>
            <div className="estimate-header">
              <h3>Your Estimate</h3>
              <p>Based on what you selected</p>
            </div>

            <div className="estimate-breakdown">
              <div className="estimate-row">
                <span>Website + Dashboard + Reports</span>
                <span>GH₵ 8,500</span>
              </div>
              {selectedAddOns.length > 0 && (
                <div className="estimate-row">
                  <span>{selectedAddOns.length} additional modules</span>
                  <span>GH₵ {(selectedAddOns.length * 1800).toLocaleString()}</span>
                </div>
              )}
              <div className="estimate-divider"></div>
              <div className="estimate-row total">
                <span>Estimated Total</span>
                <span>GH₵ {estimatedPrice.toLocaleString()}</span>
              </div>
            </div>

            {selectedAddOnModules.length > 0 ? (
              <div className="estimate-tags">
                {selectedAddOnModules.map((module) => (
                  <span key={module.id} className="estimate-tag">
                    {module.name}
                  </span>
                ))}
              </div>
            ) : (
              <p className="estimate-placeholder">
                Add-on modules will appear here as you select them.
              </p>
            )}

            <div className="estimate-timeline">
              <div className="timeline-item">
                <FontAwesomeIcon icon={faCalendarCheck} />
                <div>
                  <strong>{estimatedTimeline} weeks</strong>
                  <span>Estimated timeline</span>
                </div>
              </div>
            </div>

            <div className="estimate-actions">
              <PrimaryButton to="/contact">Request detailed quote</PrimaryButton>
              <Link to="/pricing" className="button button-ghost">
                See full pricing
              </Link>
            </div>

            <p className="estimate-note">
              This is an estimate. Final price depends on project size, integrations, and data transfer needs.
            </p>
          </div>
        </section>
      )}

      {/* ========================================
          HOW IT WORKS
          ======================================== */}
      <section className="page config-process">
        <div className="section-header reveal" data-scroll>
          <p className="eyebrow">What Happens Next</p>
          <h2>From planning to launch.</h2>
        </div>

        <div className="process-flow">
          {processSteps.map((step, index) => (
            <Fragment key={step.title}>
              <div
                className="flow-step reveal"
                data-scroll
                style={{ "--delay": `${80 + index * 120}ms` }}
              >
                <div className="flow-number">{`0${index + 1}`}</div>
                <h4>{step.title}</h4>
                <p>{step.description}</p>
              </div>

              {index < processSteps.length - 1 ? (
                <div
                  className="flow-arrow reveal"
                  data-scroll
                  style={{ "--delay": `${140 + index * 120}ms` }}
                >
                  <FontAwesomeIcon icon={faArrowRight} />
                </div>
              ) : null}
            </Fragment>
          ))}
        </div>
      </section>

      {/* ========================================
          MODULE DEPENDENCIES
          ======================================== */}
      <section className="page dependencies-section">
        <div className="section-header reveal" data-scroll>
          <p className="eyebrow">Good to Know</p>
          <h2>Module combinations that work well together.</h2>
        </div>

        <div className="dependencies-grid">
          {dependencyPairs.map((pair, index) => (
            <div
              key={pair.title}
              className="dependency-card reveal"
              data-scroll
              style={{ "--delay": `${100 + index * 90}ms` }}
            >
              <div className="dependency-icons">
                <FontAwesomeIcon icon={pair.firstIcon} className="dep-icon" />
                <span className="dep-plus">+</span>
                <FontAwesomeIcon icon={pair.secondIcon} className="dep-icon" />
              </div>
              <h4>{pair.title}</h4>
              <p>{pair.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ========================================
          FAQ SECTION
          ======================================== */}
      <section className="page config-faq">
        <div className="section-header reveal" data-scroll>
          <p className="eyebrow">Questions</p>
          <h2>Common setup questions.</h2>
        </div>

        <div className="faq-grid">
          {faqItems.map((item, index) => (
            <div
              key={item.title}
              className="faq-card reveal"
              data-scroll
              style={{ "--delay": `${100 + index * 70}ms` }}
            >
              <h4>{item.title}</h4>
              <p>{item.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ========================================
          FINAL CTA
          ======================================== */}
      <section className="page cta reveal" data-scroll>
        <div className="cta-content">
          <h2>Ready to see your custom quote?</h2>
          <p className="lead">
            {selectedAddOns.length > 0
              ? `You've selected ${selectedAddOns.length + 3} modules. Let's talk about your timeline and pricing.`
              : "Choose your modules above, or talk to us to build the right setup."}
          </p>
        </div>
        <div className="cta-actions">
          <PrimaryButton to="/contact">Get your quote</PrimaryButton>
          <Link className="button button-ghost" to="/pricing">
            See full pricing
          </Link>
        </div>
      </section>

      <WhatsApp />
    </section>
  );
}
