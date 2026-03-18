/* eslint-disable no-unused-vars */
import { Link } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faArrowRight,
  faCheckCircle,
  faUsers,
  faLightbulb,
  faHandshake,
  faChartLine,
  faMapMarkerAlt,
  faCalendarAlt,
} from "@fortawesome/free-solid-svg-icons";
import PrimaryButton from "../components/PrimaryButton.jsx";
import TrustedBy from "../components/TrustedBy.jsx";
import React from "react";
import WhatsApp from "../components/WhatsApp.jsx";
import AnimatedLogoSVG from "../components/AnimatedLogoSVG.jsx";
import "../styles/pages/About.css";

export default function About() {
  return (
    <section className="page about page-stack">

      {/* ── Hero ── */}
      <section className="about-hero split">
        <div className="about-hero-copy reveal" style={{ "--delay": "0ms" }}>
          <p className="eyebrow">About Faako</p>
          <h1>Ghanaian businesses deserve systems that make work easier.</h1>
          <p className="lead">
            We are a local team building practical tools for growing businesses
            that want clarity, speed, and reliable support.
          </p>
          <div className="cta-actions">
            <PrimaryButton to="/contact">Let's Talk</PrimaryButton>
            <Link className="button button-ghost" to="/solutions">
              Explore Solutions
            </Link>
          </div>
        </div>
        <figure className="about-hero-figure reveal" style={{ "--delay": "120ms" }}>
          <AnimatedLogoSVG className="about-hero-art" />
        </figure>
      </section>

      {/* ── Origin Story ── */}
      <section className="section origin-story section-seam-top section-surface-brown section-seam-bottom">
        <div className="section-header reveal" data-scroll>
          <p className="eyebrow">How It All Started</p>
          <h2>We started with one real business problem.</h2>
        </div>

        <div className="split reveal" data-scroll style={{ "--delay": "100ms" }}>
          <div className="story-copy">
            <p className="story-lead">
              Faako began inside a Ghanaian party rental business. Stock records
              were often wrong, and daily work was harder than it should have been.
            </p>
            <div className="story-grid">
              <article className="story-card">
                <h3>Manual stock checks</h3>
                <p>
                  Items were written down by hand and counted late, so teams
                  could not trust what was available.
                </p>
              </article>
              <article className="story-card">
                <h3>Spreadsheet stress</h3>
                <p>
                  One spreadsheet carried too much weight and was difficult for
                  many team members to use confidently.
                </p>
              </article>
              <article className="story-card">
                <h3>Tools that did not fit</h3>
                <p>
                  Most big platforms were costly and complex, and they did not
                  match how businesses here actually operate.
                </p>
              </article>
            </div>
          </div>
          <div className="story-numbers">
            <div className="ribbon">
              <div className="ribbon-tags">
                <span>
                  <FontAwesomeIcon icon={faMapMarkerAlt} /> Born in Ghana
                </span>
                <span>
                  <FontAwesomeIcon icon={faCalendarAlt} /> Since 2026
                </span>
                <span>
                  <FontAwesomeIcon icon={faUsers} /> Serving local businesses
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Mission ── */}
      <section className="section mission">
        <div className="section-header reveal" data-scroll>
          <p className="eyebrow">What We're Really Here For</p>
          <h2>One shared dashboard. Clear decisions every day.</h2>
          <p className="lead">
            When everyone sees the same information at the same time, work gets
            calmer and faster. Fewer mistakes. Better decisions.
          </p>
        </div>

        <div className="feature-grid">
          <article className="feature-card reveal" data-scroll>
            <div className="feature-card-icon">
              <FontAwesomeIcon icon={faMapMarkerAlt} />
            </div>
            <h3>Built for Ghana</h3>
            <p className="muted">
              Mobile Money, WhatsApp updates, and local business needs are built
              in from day one.
            </p>
          </article>
          <article className="feature-card reveal" data-scroll style={{ "--delay": "120ms" }}>
            <div className="feature-card-icon">
              <FontAwesomeIcon icon={faUsers} />
            </div>
            <h3>Made for every team member</h3>
            <p className="muted">
              Managers, finance teams, warehouse staff, and drivers can all use
              the system with confidence from the start.
            </p>
          </article>
          <article className="feature-card reveal" data-scroll style={{ "--delay": "240ms" }}>
            <div className="feature-card-icon">
              <FontAwesomeIcon icon={faHandshake} />
            </div>
            <h3>Support that stays</h3>
            <p className="muted">
              We stay close after launch with regular check-ins, team support,
              and practical help when you need it.
            </p>
          </article>
        </div>
      </section>

      {/* ── How We Work ── */}
      <section className="section how-we-work section-seam-top section-surface-brown section-seam-bottom">
        <div className="section-header reveal" data-scroll>
          <p className="eyebrow">How We Work</p>
          <h2>More than software. We help your business run better.</h2>
          <p className="lead">
            We do not hand over software and disappear. We learn your day-to-day
            process, set things up with your team, and stay available.
          </p>
        </div>

        <div className="workflow-steps reveal" data-scroll style={{ "--delay": "80ms" }}>
          <div className="step">
            <span>01</span>
            <div>
              <h3>We learn your business on site</h3>
              <p className="muted">
                We visit your team, watch how work is done, and understand where
                delays and errors happen before setup begins.
              </p>
            </div>
          </div>
          <div className="step reveal" data-scroll style={{ "--delay": "140ms" }}>
            <span>02</span>
            <div>
              <h3>We set up around your team</h3>
              <p className="muted">
                We connect the tools you already use and organize your key
                information in one clear system.
              </p>
            </div>
          </div>
          <div className="step reveal" data-scroll style={{ "--delay": "200ms" }}>
            <span>03</span>
            <div>
              <h3>We train with real examples</h3>
              <p className="muted">
                Your team practices with real tasks, so they are comfortable and
                ready before launch day.
              </p>
            </div>
          </div>
          <div className="step reveal" data-scroll style={{ "--delay": "260ms" }}>
            <span>04</span>
            <div>
              <h3>We stay close after launch</h3>
              <p className="muted">
                You get ongoing support, regular reviews, and direct access to
                our team as your business grows.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── What We Value ── */}
      <section className="section values">
        <div className="section-header reveal" data-scroll>
          <p className="eyebrow">What Drives Us</p>
          <h2>What matters most in every project we deliver.</h2>
        </div>

        <div className="feature-grid">
          <article className="feature-card reveal" data-scroll>
            <div className="feature-card-icon">
              <FontAwesomeIcon icon={faCheckCircle} />
            </div>
            <h3>Clarity for everyone</h3>
            <p className="muted">
              Everyone works with the same numbers and the same timeline, so
              teams can move quickly with confidence.
            </p>
          </article>
          <article className="feature-card reveal" data-scroll style={{ "--delay": "120ms" }}>
            <div className="feature-card-icon">
              <FontAwesomeIcon icon={faChartLine} />
            </div>
            <h3>Reliable under pressure</h3>
            <p className="muted">
              Busy periods, team changes, and new suppliers should not slow you
              down. We build systems that stay stable.
            </p>
          </article>
          <article className="feature-card reveal" data-scroll style={{ "--delay": "240ms" }}>
            <div className="feature-card-icon">
              <FontAwesomeIcon icon={faLightbulb} />
            </div>
            <h3>Simple by design</h3>
            <p className="muted">
              Clear screens and clear steps help your team avoid mistakes and
              finish work faster.
            </p>
          </article>
        </div>
      </section>

      {/* ── Impact Numbers ── 
      <section className="section">
        <div className="section-header reveal" data-scroll>
          <p className="eyebrow">The Numbers Don't Lie</p>
          <h2>Look what's happening on the ground.</h2>
        </div>

        <div className="visual-card-row reveal" data-scroll style={{ "--delay": "80ms" }}>
          <div className="visual-card card-primary">
            <span className="pill">Transactions</span>
            <h3 style={{ fontFamily: "var(--font-display)", fontSize: "2.2rem", color: "var(--accent)" }}>₵45M+</h3>
            <p className="muted">Every single month. Real money, moving through real businesses, tracked end to end.</p>
          </div>
          <div className="visual-card card-primary">
            <span className="pill">Orders</span>
            <h3 style={{ fontFamily: "var(--font-display)", fontSize: "2.2rem", color: "var(--accent)" }}>12K+</h3>
            <p className="muted">Per day. From the small shop in Makola to the big distributor running five locations.</p>
          </div>
          <div className="visual-card card-primary">
            <span className="pill">Time Saved</span>
            <h3 style={{ fontFamily: "var(--font-display)", fontSize: "2.2rem", color: "var(--accent)" }}>60%</h3>
            <p className="muted">Less time on spreadsheets. More time actually running the business. That's the shift.</p>
          </div>
          <div className="visual-card card-primary">
            <span className="pill">Across Ghana</span>
            <h3 style={{ fontFamily: "var(--font-display)", fontSize: "2.2rem", color: "var(--accent)" }}>50+</h3>
            <p className="muted">Locations. Accra, Kumasi, Tema, Takoradi — and we're still spreading.</p>
          </div>
        </div>
      </section>*/}

      {/* ── CTA ── */}
      <section className="cta reveal" data-scroll>
        <div className="section-bg" aria-hidden="true" />
        <div className="section-media" />
        <div className="cta-content">
          <h2>Your business deserves better than scattered spreadsheets.</h2>
          <p className="lead">
            Book a short call. We will show you what Faako can do for your
            business, step by step, with clear next actions.
          </p>
        </div>
        <div className="cta-actions">
          <PrimaryButton to="/contact">Book a free consultation</PrimaryButton>
          <Link className="button button-ghost" to="/">
            Back to Home <FontAwesomeIcon icon={faArrowRight} />
          </Link>
        </div>
      </section>
      
      <WhatsApp />

      {/* ── Trusted By ── 
      <TrustedBy
        className="page trust-strip"
        eyebrow="The Family"
        title="These businesses already made the switch."
        lead="From small teams in Accra to enterprise operations in Kumasi — Faako powers their daily work."
        logos={[
          { name: "Reebs", src: "/imgs/company-logos/reebs_logo.svg" },
        ]}
      />*/}
    </section>
  );
}
