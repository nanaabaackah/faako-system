/* eslint-disable no-unused-vars */
import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { animate, createTimeline, stagger } from "animejs";
import {
  faGlobe,
  faArrowLeft,
  faArrowRight,
  faHeadset,
  faShield,
  faCheck,
  faBoxesStacked,
  faChartLine,
} from "@fortawesome/free-solid-svg-icons";
import PrimaryButton from "../components/PrimaryButton.jsx";
import Threads from "../components/Threads.jsx";
import WhatsApp from "../components/WhatsApp.jsx";
import "../styles/pages/Home.css";
import "../styles/pages/CaseStudies.css";

const HERO_LINE_ONE = "From chaos to clarity.";
const HERO_LINE_TWO = "One system changes everything.";
const HERO_THREADS_COLOR = [35 / 255, 88 / 255, 66 / 255];
const YEARLY_DISCOUNT_RATE = 0.2;

const processSteps = [
  {
    id: "01",
    title: "Free Call",
    description: "Tell us what is slowing your business down.",
  },
  {
    id: "02",
    title: "We Visit",
    description: "We come to your business and see how work is done.",
  },
  {
    id: "03",
    title: "Plan",
    description: "You get a clear plan, timeline, and cost.",
  },
  {
    id: "04",
    title: "Build",
    description: "We build your system and share progress as we go.",
  },
  {
    id: "05",
    title: "Train",
    description: "We train your team until they are comfortable.",
  },
  {
    id: "06",
    title: "Launch",
    description: "We launch with you and stay close for support.",
  },
];

const howBoardPillMetrics = [
  {
    id: "stock-accuracy",
    label: "Stock accuracy",
    score: 96,
    positionClass: "how-board-card--pill-a",
  },
  {
    id: "on-time-fulfilment",
    label: "On-time fulfilment",
    score: 92,
    positionClass: "how-board-card--pill-b",
  },
];
const HOW_BOARD_PILL_DOT_COUNT = 12;

const toolsTabContent = [
  {
    id: "personas",
    icon: faGlobe,
    tabLabel: "Get Found & Get Paid",
    stepId: "01",
    title: "Get Found & Get Paid",
    description:
      "Get a simple website that helps people find you, pay you, and contact you on WhatsApp.",
    image: "/imgs/elements/woman.png",
    alt: "Business website and booking flow",
  },
  {
    id: "scoring",
    icon: faChartLine,
    tabLabel: "Track Everything",
    stepId: "02",
    title: "Track Everything",
    description:
      "Track stock, sales, and orders in one place without stress.",
    alt: "Inventory tracking dashboard",
  },
  {
    id: "overlays",
    icon: faBoxesStacked,
    tabLabel: "See The Numbers",
    stepId: "03",
    title: "See The Numbers",
    description:
      "See clear daily, weekly, and monthly reports so you can make better decisions.",
    alt: "Business reports dashboard",
  },
];

const discoverySignalCards = [
  {
    id: "retail-flow",
    tag: "R",
    brand: "Retail Flow",
    quote:
      "Before Faako, our numbers were scattered. Now we can see what is happening every day.",
    person: "Ama Mensah",
    role: "Operations Lead",
  },
  {
    id: "marketbase",
    tag: "M",
    brand: "Marketbase",
    quote:
      "The setup was simple, and our team started using it quickly.",
    person: "Kojo Addo",
    role: "Founder",
  },
  {
    id: "origami-trade",
    tag: "O",
    brand: "Origami Trade",
    quote:
      "Our team now works from one place, and customers get faster service.",
    person: "Eric Boateng",
    role: "Sales Team",
  },
  {
    id: "supply-hub",
    tag: "S",
    brand: "Supply Hub",
    quote:
      "I no longer chase updates all day. I can check everything in one dashboard.",
    person: "Nana Asare",
    role: "Store Manager",
  },
];

const pricingPlans = [
  {
    id: "starter",
    variantClass: "pricing-card--starter",
    delay: "120ms",
    name: "Website + Leads",
    copy: "Best for small businesses starting their online setup.",
    setupFee: 2500,
    monthlyFee: 450,
    cta: "Talk to us",
    includesLabel: "Plan includes:",
    ariaLabel: "Choose Website plus Leads plan and talk to us",
    features: [
      "Mobile website",
      "Contact forms",
      "WhatsApp integration",
      "Instant enquiry alerts",
      "3-month support",
    ],
  },
  {
    id: "featured",
    variantClass: "pricing-card--featured",
    delay: "180ms",
    name: "Website + Dashboard",
    copy: "Best for teams that want clear daily tracking.",
    setupFee: 8500,
    monthlyFee: 1200,
    cta: "Talk to us",
    includesLabel: "Everything in Website + Leads, plus:",
    ariaLabel: "Choose Website plus Dashboard plan and talk to us",
    isPopular: true,
    features: [
      "Sales tracking",
      "Inventory management",
      "Reports",
      "Daily close support",
      "6-month support",
    ],
  },
  {
    id: "scale",
    variantClass: "pricing-card--scale",
    delay: "240ms",
    name: "Complete System",
    copy: "Best for growing businesses with bigger needs.",
    setupFee: 18000,
    monthlyFee: 2600,
    cta: "Request quote",
    includesLabel: "Everything in Website + Dashboard, plus:",
    ariaLabel: "Choose Complete System plan and request a quote",
    features: [
      "Multi-location support",
      "Custom setup for your business",
      "Mobile Money integrations",
      "Priority support and training",
      "12-month support",
    ],
  },
];

const formatGhs = (amount) => `GH₵ ${new Intl.NumberFormat("en-GH").format(amount)}`;

export default function Home() {
  const [typedLineOne, setTypedLineOne] = useState("");
  const [typedLineTwo, setTypedLineTwo] = useState("");
  const [isTypingComplete, setIsTypingComplete] = useState(false);
  const [billingCycle, setBillingCycle] = useState("yearly");
  const discoveryTrackRef = useRef(null);

  const isYearlyBilling = billingCycle === "yearly";
  const getRecurringMonthlyFee = (monthlyFee) => (
    isYearlyBilling
      ? Math.round(monthlyFee * (1 - YEARLY_DISCOUNT_RATE))
      : monthlyFee
  );

  const scrollDiscovery = (direction) => {
    const track = discoveryTrackRef.current;
    if (!track) return;
    const firstCard = track.querySelector(".home-discovery-slide");
    const scrollStep = firstCard
      ? firstCard.getBoundingClientRect().width + 16
      : 360;
    track.scrollBy({ left: direction * scrollStep, behavior: "smooth" });
  };

  useEffect(() => {
    const prefersReducedMotion =
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (!prefersReducedMotion) {
      const svgs = document.querySelectorAll(".faako-logo");
      svgs.forEach((svg) => {
        const paths = svg.querySelectorAll("path");
        paths.forEach((p, i) => {
          const originalFill = (p.getAttribute("fill") || "#0052FF").toLowerCase();
          p.style.setProperty("--path-fill", originalFill);
          p.style.setProperty("--i", String(i));
          const len = p.getTotalLength();
          p.style.setProperty("--dash", String(len));
          p.style.strokeDasharray = "var(--dash)";
          p.style.strokeDashoffset = "var(--dash)";
          p.style.fill = "transparent";
          p.style.stroke = "var(--path-fill)";
          p.classList.add("faako-loop-path");
        });
      });
    }
    return undefined;
  }, []);

  useEffect(() => {
    const prefersReducedMotion =
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (prefersReducedMotion) {
      return undefined;
    }

    const trustCards = Array.from(document.querySelectorAll(".trust-card"));
    const pricingRows = Array.from(document.querySelectorAll(".pricing-features li"));
    const trustIcons = trustCards
      .map((card) => card.querySelector(".trust-icon svg"))
      .filter(Boolean);
    const pricingIcons = pricingRows
      .map((row) => row.querySelector("svg"))
      .filter(Boolean);
    const allIcons = [...trustIcons, ...pricingIcons];

    if (!allIcons.length) {
      return undefined;
    }

    allIcons.forEach((icon) => {
      icon.style.transformOrigin = "50% 50%";
      icon.style.willChange = "transform, opacity";
    });

    const introTimeline = createTimeline({ autoplay: false });
    const loopTimeline = createTimeline({ autoplay: false, loop: true });

    introTimeline.add(allIcons, {
      opacity: [0.2, 1],
      scale: [0.82, 1],
      translateY: [8, 0],
      duration: 460,
      delay: stagger(35),
      ease: "outCubic",
      composition: "replace",
    });

    loopTimeline
      .add(trustIcons, {
        translateY: [0, -2, 0],
        rotate: [0, -3, 0],
        duration: 2200,
        delay: stagger(140),
        ease: "inOutSine",
        composition: "replace",
      })
      .add(
        pricingIcons,
        {
          scale: [1, 1.06, 1],
          duration: 1800,
          delay: stagger(90),
          ease: "inOutSine",
          composition: "replace",
        },
        "<",
      );

    const cleanupHandlers = [];

    trustCards.forEach((card) => {
      const icon = card.querySelector(".trust-icon svg");
      if (!icon) return;

      const onEnter = () => {
        animate(icon, {
          scale: 1.14,
          rotate: -6,
          duration: 260,
          ease: "outCubic",
          composition: "replace",
        });
      };

      const onLeave = () => {
        animate(icon, {
          scale: 1,
          rotate: 0,
          duration: 280,
          ease: "outQuad",
          composition: "replace",
        });
      };

      card.addEventListener("mouseenter", onEnter);
      card.addEventListener("mouseleave", onLeave);
      cleanupHandlers.push(() => {
        card.removeEventListener("mouseenter", onEnter);
        card.removeEventListener("mouseleave", onLeave);
      });
    });

    pricingRows.forEach((row) => {
      const icon = row.querySelector("svg");
      if (!icon) return;

      const onEnter = () => {
        animate(icon, {
          scale: 1.14,
          translateX: 2,
          duration: 220,
          ease: "outCubic",
          composition: "replace",
        });
      };

      const onLeave = () => {
        animate(icon, {
          scale: 1,
          translateX: 0,
          duration: 240,
          ease: "outQuad",
          composition: "replace",
        });
      };

      row.addEventListener("mouseenter", onEnter);
      row.addEventListener("mouseleave", onLeave);
      cleanupHandlers.push(() => {
        row.removeEventListener("mouseenter", onEnter);
        row.removeEventListener("mouseleave", onLeave);
      });
    });

    const observer = new IntersectionObserver(
      (entries) => {
        const inView = entries.some((entry) => entry.isIntersecting);
        if (inView) {
          if (introTimeline.began) {
            introTimeline.resume();
          } else {
            introTimeline.play();
          }
          loopTimeline.resume();
        } else {
          introTimeline.pause();
          loopTimeline.pause();
        }
      },
      { threshold: 0.2 },
    );

    const sections = [
      document.querySelector(".trust-indicators"),
      document.querySelector(".pricing-preview"),
    ].filter(Boolean);

    if (!sections.length) {
      introTimeline.play();
      loopTimeline.play();
    } else {
      sections.forEach((section) => observer.observe(section));
    }

    return () => {
      observer.disconnect();
      cleanupHandlers.forEach((handler) => handler());
      introTimeline.revert();
      loopTimeline.revert();
      allIcons.forEach((icon) => {
        icon.style.willChange = "auto";
      });
    };
  }, []);

  useEffect(() => {
    const prefersReducedMotion =
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (prefersReducedMotion) {
      setTypedLineOne(HERO_LINE_ONE);
      setTypedLineTwo(HERO_LINE_TWO);
      setIsTypingComplete(true);
      return undefined;
    }

    setTypedLineOne("");
    setTypedLineTwo("");
    setIsTypingComplete(false);
    let isCancelled = false;
    const timers = [];

    const queueTimeout = (callback, delay) => {
      const id = window.setTimeout(() => {
        if (!isCancelled) {
          callback();
        }
      }, delay);
      timers.push(id);
    };

    const typeLine = (text, setter, speed, done) => {
      let cursor = 0;
      const tick = () => {
        setter(text.slice(0, cursor + 1));
        cursor += 1;

        if (cursor < text.length) {
          queueTimeout(tick, speed);
        } else if (done) {
          done();
        }
      };

      queueTimeout(tick, 130);
    };

    typeLine(HERO_LINE_ONE, setTypedLineOne, 42, () => {
      queueTimeout(() => {
        typeLine(HERO_LINE_TWO, setTypedLineTwo, 34, () => {
          queueTimeout(() => {
            setIsTypingComplete(true);
          }, 120);
        });
      }, 180);
    });

    return () => {
      isCancelled = true;
      timers.forEach((id) => window.clearTimeout(id));
    };
  }, []);

  const featurePreview = toolsTabContent[0];
  const fixedFirstLineFontClass = "hero-type-line--font-colmeak";

  return (
    <div className="home-page">
      {/* ========================================
          HERO SECTION - MINIMAL
          ======================================== */}
      <section className="page hero hero-v2 hero-centered hero-parallax">
        <div className="hero-threads-layer" aria-hidden="true">
          <Threads
            color={HERO_THREADS_COLOR}
            amplitude={1}
            distance={0}
            enableMouseInteraction
          />
        </div>
        <div className="hero-content" data-scroll>
          <h1 aria-label="From chaos to clarity. One system changes everything.">
            <span
              className={`hero-type-line hero-type-line--base ${
                fixedFirstLineFontClass
              } ${
                isTypingComplete ? "is-gradient" : ""
              }`}
            >
              {typedLineOne}
              {typedLineOne.length < HERO_LINE_ONE.length ? (
                <span className="hero-type-cursor" aria-hidden="true">
                  |
                </span>
              ) : null}
              <br />
            </span>
            <span className="hero-type-line hero-type-line--accent-shell">
              <span
                className="text-accent hero-type-line hero-type-line--accent hero-type-line--font-kaftan"
              >
                {typedLineTwo}
                {typedLineOne.length === HERO_LINE_ONE.length && !isTypingComplete ? (
                  <span className="hero-type-cursor" aria-hidden="true">
                    |
                  </span>
                ) : null}
              </span>
            </span>
          </h1>

          {/* IMAGE: Screenshot of dashboard showing Mobile Money, WhatsApp integration */}
          <div className="hero-visual" data-scroll style={{ "--delay": "60ms" }}>
            <img
              src="/imgs/case-studies/case-study-mobdesk2.png"
              alt="Business dashboard with local integrations"
            />
          </div>
          <div className="hero-actions">
            <PrimaryButton to="/contact">See How It Works <FontAwesomeIcon icon={faArrowRight} /></PrimaryButton>
            <Link className="button button-ghost" to="/contact">
              Talk to Us
            </Link>
          </div>
          <div className="hero-stats-block" data-scroll style={{ "--delay": "120ms" }}>
            <p className="hero-stats-headline">
              Real progress so far.
            </p>
            <div className="hero-stats">
              <article className="hero-stat">
                <span className="hero-stat-marker" aria-hidden="true" />
                <div className="hero-stat-content">
                  <p className="hero-stat-value">12+</p>
                  <p className="hero-stat-label">businesses already using Faako</p>
                </div>
              </article>
              <article className="hero-stat">
                <span className="hero-stat-marker" aria-hidden="true" />
                <div className="hero-stat-content">
                  <p className="hero-stat-value">5+</p>
                  <p className="hero-stat-label">projects delivered for local teams</p>
                </div>
              </article>
              <article className="hero-stat">
                <span className="hero-stat-marker" aria-hidden="true" />
                <div className="hero-stat-content">
                  <p className="hero-stat-value">100+</p>
                  <p className="hero-stat-label">people in our growing community</p>
                </div>
              </article>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================
          WHY US - VISUAL + MINIMAL TEXT
          ======================================== */}
      <section className="page trust-indicators">
        <div className="section-header reveal" data-scroll>
          <p className="eyebrow">Built for Ghana</p>
          <h2>We make daily business easier.</h2>
        </div>

        <div className="trust-grid reveal" data-scroll style={{ "--delay": "100ms" }}>
          <article className="trust-card">
            <span className="trust-icon">
              <FontAwesomeIcon icon={faGlobe} />
            </span>
            <h3>Show us how you work</h3>
            <p>We learn how your business runs today before we build anything.</p>
          </article>
          
          <article className="trust-card">
            <span className="trust-icon">
              <FontAwesomeIcon icon={faShield} />
            </span>
            <h3>Fix what slows you down</h3>
            <p>We remove weak spots early so your team can work with less stress.</p>
          </article>
          
          <article className="trust-card">
            <span className="trust-icon">
              <FontAwesomeIcon icon={faHeadset} />
            </span>
            <h3>Stay supported</h3>
            <p>After launch, we stay close and help your team every step of the way.</p>
          </article>
        </div>
      </section>
      
      {/* ========================================
          WHAT WE BUILD - VISUAL TABS
          ======================================== */}
      <section id="features" className="page features-section">
        <div className="tools-tabs reveal" data-scroll>
          <div className="tools-tab-panels">
            <div className="tools-tab-panel-card tools-tab-panel-card--stacked is-visible">
              <div className="tab-content-split">
                <div className="tab-image">
                  <img
                    src={featurePreview.image}
                    alt={featurePreview.alt}
                    style={{
                      width: "100%",
                      borderRadius: "var(--radius)",
                      boxShadow: "0 10px 30px rgba(0,0,0,0.1)",
                    }}
                  />
                </div>
                <div className="tab-text">
                  <div className="section-header">
                    <p className="eyebrow">What We Build</p>
                    <h2>Three things every business needs.</h2>
                  </div>
                  <p className="muted tab-lead">
                    Simple tools to help you sell more, stay organized, and stay in control.
                  </p>
                  <div className="tab-content-cards">
                    {toolsTabContent.map((tab) => (
                      <article key={`${tab.id}-detail`} className="tab-content-details">
                        <div className="tab-content-title">
                          <span className="tab-content-icon" aria-hidden="true">
                            <FontAwesomeIcon icon={tab.icon} />
                          </span>
                          <h3>{tab.title}</h3>
                        </div>
                        <p className="muted">{tab.description}</p>
                      </article>
                    ))}
                  </div>
                  
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
      
      {/* ========================================
          HOW IT WORKS - PERFORMANCE BOARD
          ======================================== */}
      <section className="page how-it-works">
        <div className="how-it-works-layout reveal" data-scroll>
          <div className="how-it-works-board">
            <article className="how-board-card how-board-card--performance" aria-hidden="true">
              <div className="how-board-performance-top">
                <div className="how-board-profile">
                  <span className="how-board-avatar">KL</span>
                  <div>
                    <span>User</span>
                    <strong>Kojo Lartey</strong>
                  </div>
                </div>
                <div className="how-board-score">
                  <span>Team usage</span>
                  <strong>89%</strong>
                </div>
              </div>
              <div className="how-board-performance-chart">
                <p>End-of-day balance</p>
                <div className="how-board-performance-bars">
                  <div>
                    <strong>82%</strong>
                    <span>30 days</span>
                  </div>
                  <div>
                    <strong>97%</strong>
                    <span>7 days</span>
                  </div>
                </div>
              </div>
            </article>

            {howBoardPillMetrics.map((metric) => {
              const filledDots = Math.max(
                0,
                Math.min(
                  HOW_BOARD_PILL_DOT_COUNT,
                  Math.round((metric.score / 100) * HOW_BOARD_PILL_DOT_COUNT),
                ),
              );
              return (
                <article
                  key={metric.id}
                  className={`how-board-card how-board-card--pill ${metric.positionClass}`}
                  aria-hidden="true"
                >
                  <span>{metric.label}</span>
                  <strong>{metric.score}%</strong>
                  <span className="how-board-pill-dots">
                    {Array.from({ length: HOW_BOARD_PILL_DOT_COUNT }).map((_, index) => (
                      <i key={`${metric.id}-dot-${index}`} className={index < filledDots ? "is-filled" : ""} />
                    ))}
                  </span>
                </article>
              );
            })}

            <article className="how-board-card how-board-card--metric how-board-card--metric-a" aria-hidden="true">
              <strong>38,564</strong>
              <span>Orders logged</span>
            </article>

            <article className="how-board-card how-board-card--metric how-board-card--metric-b" aria-hidden="true">
              <strong>406</strong>
              <span>Leads captured</span>
            </article>

            <article className="how-board-card how-board-card--interactions" aria-hidden="true">
              <h3>Response time</h3>
              <ul>
                <li>
                  <span>0 - 10 min</span>
                  <div className="how-board-line">
                    <i style={{ width: "55%" }} />
                  </div>
                  <strong>55%</strong>
                </li>
                <li>
                  <span>10 - 30 min</span>
                  <div className="how-board-line">
                    <i style={{ width: "34%" }} />
                  </div>
                  <strong>34%</strong>
                </li>
                <li>
                  <span>30+ min</span>
                  <div className="how-board-line">
                    <i style={{ width: "11%" }} />
                  </div>
                  <strong>11%</strong>
                </li>
              </ul>
            </article>

            <article className="how-board-card how-board-card--workspace" aria-hidden="true">
              <div className="how-board-workspace-title">
                <span className="how-board-workspace-badge">SO</span>
                <strong>Store team</strong>
              </div>
              <div className="how-board-workspace-metrics">
                <div>
                  <strong>48</strong>
                  <span>Team members</span>
                </div>
                <div>
                  <strong>4,238</strong>
                  <span>Orders processed</span>
                </div>
                <div>
                  <strong>GHS 238k</strong>
                  <span>Revenue tracked</span>
                </div>
              </div>
              <p>+12 branches live</p>
            </article>

            <div className="how-board-core">
              <h3>Track leads, stock, sales, and service in one clear system.</h3>
            </div>
          </div>
        </div>
      </section>


      {/* ========================================
          PRICING - CLEAN & SIMPLE
          ======================================== */}
      <section className="page pricing-preview">
        <div className="section-header pricing-heading reveal" data-scroll>
          <span className="pricing-eyebrow-chip">Pricing</span>
          <h2>Choose a plan that fits your needs</h2>
          <p className="pricing-lead">Each plan has a one-time setup fee and a monthly fee.</p>
        </div>

        <div className="pricing-switch reveal" data-scroll style={{ "--delay": "80ms" }}>
          <div className="pricing-switch-shell" role="group" aria-label="Pricing mode">
            <button
              type="button"
              className={`pricing-switch-option${billingCycle === "monthly" ? " is-active" : ""}`}
              onClick={() => setBillingCycle("monthly")}
              aria-pressed={billingCycle === "monthly"}
            >
              Monthly
            </button>
            <button
              type="button"
              className={`pricing-switch-option${billingCycle === "yearly" ? " is-active" : ""}`}
              onClick={() => setBillingCycle("yearly")}
              aria-pressed={billingCycle === "yearly"}
            >
              Yearly
              <span>-20%</span>
            </button>
          </div>
        </div>

        <div className="pricing-cards pricing-cards--comparison reveal" data-scroll style={{ "--delay": "120ms" }}>
          {pricingPlans.map((plan) => {
            const recurringMonthlyFee = getRecurringMonthlyFee(plan.monthlyFee);
            const yearlyRecurringTotal = recurringMonthlyFee * 12;

            return (
              <Link
                key={plan.id}
                to="/contact"
                className={`pricing-card ${plan.variantClass} pricing-card-link reveal`}
                data-scroll
                style={{ "--delay": plan.delay }}
                aria-label={plan.ariaLabel}
              >
                <div className="pricing-card-top">
                  {plan.isPopular ? <span className="badge">Most Popular</span> : null}
                  <h3 className="pricing-card-name">{plan.name}</h3>
                  <p className="pricing-card-copy">{plan.copy}</p>
                </div>
                <div className="pricing-card-body">
                  <div className="price-tag">
                    <div className="recurring-fee-row">
                      <span className="price">{formatGhs(recurringMonthlyFee)}</span>
                      <span className="period">/ month</span>
                    </div>
                    <span className="billing-note">
                      {isYearlyBilling
                        ? `Billed yearly at ${formatGhs(yearlyRecurringTotal)}/year`
                        : "Billed monthly"}
                    </span>
                  </div>
                  <span className="pricing-includes">{plan.includesLabel}</span>
                  <ul className="pricing-features">
                    {plan.features.map((feature) => (
                      <li key={feature}>
                        <FontAwesomeIcon icon={faCheck} /> {feature}
                      </li>
                    ))}
                  </ul>
                  <div className="pricing-card-foot">
                    <p className="pricing-setup-note">One-time setup: {formatGhs(plan.setupFee)}</p>
                    <span className="pricing-card-cta pricing-card-cta-label">{plan.cta}</span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>

        <Link
          className="pricing-enterprise pricing-enterprise-link reveal"
          to="/contact"
          data-scroll
          style={{ "--delay": "180ms" }}
          aria-label="Contact sales for enterprise plan"
        >
          <div className="pricing-enterprise-main">
            <h3>Enterprise</h3>
            <p>A custom setup and monthly plan based on your business size and needs.</p>
            <span className="pricing-enterprise-cta pricing-card-cta-label">Contact sales</span>
          </div>
          <ul className="pricing-enterprise-points">
            <li><FontAwesomeIcon icon={faCheck} /> All features your business needs</li>
            <li><FontAwesomeIcon icon={faCheck} /> Faster support response</li>
            <li><FontAwesomeIcon icon={faCheck} /> Team training and refresh sessions</li>
            <li><FontAwesomeIcon icon={faCheck} /> Optional managed hosting</li>
            <li><FontAwesomeIcon icon={faCheck} /> Flexible billing terms</li>
            <li><FontAwesomeIcon icon={faCheck} /> Dedicated account lead</li>
          </ul>
        </Link>
      </section>

      {/* ========================================
          PROOF - VISUAL EXAMPLES
          ======================================== */}
      <section className="page case-studies">
        <div className="section-header reveal" data-scroll>
          <p className="eyebrow">Examples</p>
          <h2>See what your setup can look like.</h2>
          <p className="muted">Two simple examples of how teams can plan work and track progress.</p>
        </div>

        <div className="scenario-grid reveal" data-scroll>
          <article className="scenario-card scenario-card--schedule">
            <div className="scenario-visual">
              <div className="scenario-mock scenario-mock--schedule" aria-hidden="true">
                <div className="scenario-schedule-board">
                  <h4>My schedule</h4>
                  <div className="scenario-schedule-grid">
                    <span className="scenario-bar scenario-bar--purple scenario-bar--sm" />
                    <span className="scenario-bar scenario-bar--green scenario-bar--md" />
                    <span className="scenario-bar scenario-bar--purple scenario-bar--xs" />
                    <span className="scenario-bar scenario-bar--green scenario-bar--sm" />
                    <span className="scenario-bar scenario-bar--green scenario-bar--xs" />
                    <span className="scenario-bar scenario-bar--purple scenario-bar--xxs" />
                    <span className="scenario-bar scenario-bar--orange scenario-bar--lg" />
                    <span className="scenario-bar scenario-bar--purple scenario-bar--xs" />
                    <span className="scenario-bar scenario-bar--green scenario-bar--md" />
                  </div>
                </div>
              </div>
              <div className="scenario-hover-overlay" aria-hidden="true">
                <span>See use case</span>
                <FontAwesomeIcon icon={faArrowRight} />
              </div>
            </div>
            <div className="scenario-copy">
              <span className="scenario-tag">Feature for</span>
              <h3>Project schedule view</h3>
              <p>Plan each day, assign tasks, and keep everyone aligned.</p>
            </div>
          </article>

          <article className="scenario-card scenario-card--activity" style={{ "--delay": "120ms" }}>
            <div className="scenario-visual">
              <div className="scenario-mock scenario-mock--activity" aria-hidden="true">
                <div className="scenario-activity-card">
                  <div className="scenario-activity-head">
                    <h4>Activity</h4>
                    <span className="scenario-activity-pill">Week</span>
                  </div>
                  <div className="scenario-activity-bars">
                    <span className="scenario-activity-bar scenario-activity-bar--a" />
                    <span className="scenario-activity-bar scenario-activity-bar--b" />
                    <span className="scenario-activity-bar scenario-activity-bar--c" />
                    <span className="scenario-activity-bar scenario-activity-bar--d" />
                    <span className="scenario-activity-bar scenario-activity-bar--e" />
                  </div>
                  <div className="scenario-activity-labels">
                    <span>Day 1</span>
                    <span>Day 11</span>
                  </div>
                </div>
              </div>
              <div className="scenario-hover-overlay" aria-hidden="true">
                <span>See use case</span>
                <FontAwesomeIcon icon={faArrowRight} />
              </div>
            </div>
            <div className="scenario-copy">
              <span className="scenario-tag">Feature for</span>
              <h3>Activity view</h3>
              <p>See progress over time and spot delays early.</p>
            </div>
          </article>
        </div>
      </section>

      {/* ========================================
          DISCOVERY SIGNALS
          ======================================== */}
      <section className="page home-discovery">
        <div className="home-discovery-header reveal" data-scroll>
          <div className="home-discovery-heading">
            <p className="eyebrow">Customer Stories</p>
            <h2>Hear from people using Faako.</h2>
          </div>
          <div className="home-discovery-controls" aria-label="Scroll discovery signals">
            <button
              type="button"
              className="home-discovery-nav"
              onClick={() => scrollDiscovery(-1)}
              aria-label="Previous signals"
            >
              <FontAwesomeIcon icon={faArrowLeft} />
            </button>
            <button
              type="button"
              className="home-discovery-nav"
              onClick={() => scrollDiscovery(1)}
              aria-label="Next signals"
            >
              <FontAwesomeIcon icon={faArrowRight} />
            </button>
          </div>
        </div>

        <div className="home-discovery-carousel reveal" data-scroll style={{ "--delay": "80ms" }}>
          <div className="home-discovery-track" ref={discoveryTrackRef}>
            {discoverySignalCards.map((card) => (
              <article key={card.id} className="home-discovery-slide">
                <div className="home-discovery-slide-brand">
                  <span className="home-discovery-brand-mark" aria-hidden="true">
                    {card.tag}
                  </span>
                  <span className="home-discovery-brand-name">{card.brand}</span>
                </div>
                <p className="home-discovery-slide-quote">"{card.quote}"</p>
                <div className="home-discovery-slide-person">
                  <span className="home-discovery-person-avatar" aria-hidden="true">
                    {card.person
                      .split(" ")
                      .map((part) => part[0])
                      .join("")
                      .slice(0, 2)}
                  </span>
                  <div className="home-discovery-person-meta">
                    <strong>{card.person}</strong>
                    <span>{card.role}</span>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ========================================
          FAQ
          ======================================== */}
      <section className="page home-faq">
        <div className="home-faq-shell reveal" data-scroll>
          <div className="home-faq-intro">
            <h2>Questions all resolved in one place</h2>
            <Link className="button button-primary home-faq-cta" to="/contact">
              Get Started Free
            </Link>
          </div>

          <div className="home-faq-list">
            <details className="home-faq-item" open>
              <summary>Is Faako secure?</summary>
              <p>
                Yes. We use strong security and regular backups to keep your records safe.
              </p>
            </details>

            <details className="home-faq-item">
              <summary>Who is Faako for?</summary>
              <p>
                Faako is for small and growing businesses in Ghana that want to run things in one place.
              </p>
            </details>

            <details className="home-faq-item">
              <summary>Do you charge any hidden fees?</summary>
              <p>
                No. Pricing is scoped upfront and shared clearly before work starts, so you know exactly what is included.
              </p>
            </details>

            <details className="home-faq-item">
              <summary>How long does it take to set up?</summary>
              <p>
                Most website projects take 2-4 weeks. Full system setups usually take 4-10 weeks.
              </p>
            </details>

            <details className="home-faq-item">
              <summary>Can you connect our current tools and records?</summary>
              <p>
                Yes. We can move your current records and connect them into your new system.
              </p>
            </details>
          </div>
        </div>
      </section>

      {/* ========================================
          FINAL CTA - SHORT & DIRECT
          ======================================== */}
      <section className="page cta cta-compact reveal" data-scroll>
        <div className="cta-content">
          <h2>Run your business with calm and clarity.</h2>
          <p className="lead">One place for everything important.</p>
        </div>
        <div className="cta-actions">
          <PrimaryButton to="/contact">Book a free call</PrimaryButton>
        </div>
      </section>
      
      <WhatsApp />
    </div>
  );
}
