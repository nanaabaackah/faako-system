import { Link } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faShield,
  faRoute,
  faHandshake,
  faMoneyBillWave,
  faArrowRight,
  faCheck,
  faCommentDots,
  faTable,
  faBookOpen,
  faBrain,
  faEnvelope,
  faStore,
  faTruckFast,
  faCalendarCheck,
  faIndustry,
  faHelmetSafety,
  faUtensils,
} from "@fortawesome/free-solid-svg-icons";
import PrimaryButton from "../components/PrimaryButton.jsx";
import WhatsApp from "../components/WhatsApp.jsx";
import { moduleShowcaseItems } from "../data/modules.js";
import "../styles/pages/Solutions.css";

// Import the device merge effect
import { DeviceMergeLabeled } from "../components/DeviceMergeEffect.jsx";

export default function Solutions() {
  return (
    <section className="page solutions page-stack">

      {/* ========================================
          HERO SECTION - CONCISE
          ======================================== */}
      <section className="solutions-hero-v2 before-after">
        <div className="hero-content reveal">
          <p className="eyebrow">How We Help</p>
          <h1>
            Stop jumping between tools.{" "} <br />
            <span className="text-accent">Run your business from one place.</span>
          </h1>
          <p className="lead">
          Less stress, fewer delays, and clearer daily work.
        </p>
        <div className="hero-actions">
          <PrimaryButton to="/contact">Talk to our team</PrimaryButton>
          <Link className="button button-ghost" to="/configure">
            Plan your setup
          </Link>
        </div>
      </div>

      <div className="hero-visual split-visual">
        {/* Before State */}
        <div className="before-state">
          <div className="state-label state-label--before">Before</div>
          <h3 className="state-title">Too many disconnected tools</h3>
          <p className="state-subtitle">
            Work is split across chats, spreadsheets, and memory.
          </p>
          <div className="chaos-items">
            <div className="chaos-item" style={{ '--delay': '0s' }}>
              <span>
                <FontAwesomeIcon icon={faCommentDots} />
                WhatsApp
              </span>
            </div>
            <div className="chaos-item" style={{ '--delay': '0.2s' }}>
              <span>
                <FontAwesomeIcon icon={faTable} />
                Excel
              </span>
            </div>
            <div className="chaos-item" style={{ '--delay': '0.4s' }}>
              <span>
                <FontAwesomeIcon icon={faBookOpen} />
                Notebook
              </span>
            </div>
            <div className="chaos-item" style={{ '--delay': '0.6s' }}>
              <span>
                <FontAwesomeIcon icon={faBrain} />
                Your Head
              </span>
            </div>
            <div className="chaos-item" style={{ '--delay': '0.8s' }}>
              <span>
                <FontAwesomeIcon icon={faEnvelope} />
                Email
              </span>
            </div>
          </div>
          <div className="state-meta">
            <span>Slow updates</span>
            <span>Frequent errors</span>
          </div>
        </div>

        {/* Arrow */}
        <div className="transformation-arrow">
          <FontAwesomeIcon icon={faArrowRight} />
        </div>

        {/* After State */}
        <div className="after-state">
          <div className="state-label state-label--after">After</div>
          <h3 className="state-title">One clear system</h3>
          <p className="state-subtitle">
            Everyone sees the same up-to-date information in one place.
          </p>
          <div className="unified-system">
            <div className="system-icon">
              <div className="pulse-ring"></div>
              <div className="system-core">
                <img src="/assets/logos/logo2-white.svg" alt="Faako" />
              </div>
            </div>
            <div className="system-label">One System</div>
            <div className="system-benefits">
              <span>
                <FontAwesomeIcon icon={faCheck} />
                One source of truth
              </span>
              <span>
                <FontAwesomeIcon icon={faCheck} />
                Easier teamwork
              </span>
              <span>
                <FontAwesomeIcon icon={faCheck} />
                Live updates
              </span>
            </div>
          </div>
          <div className="state-meta state-meta--after">
            <span>Shared dashboard</span>
            <span>Faster decisions</span>
          </div>
        </div>
      </div>
    </section>

      {/* ========================================
          CORE SERVICES - CONCISE
          ======================================== */}
      <section className="page solutions-section" id="core-pillars">
        <div className="section-header reveal">
          <p className="eyebrow">Three Essentials</p>
          <h2>Website. Daily operations. Clear reporting.</h2>
          <p className="lead">
            When these three work together, your team moves with confidence.
          </p>
        </div>
        
        <div className="solutions-container">
          {/* Pillar 1 */}
          <article className="solution-pillar reveal" id="digital">
            <div className="pillar-head">
              <div className="pillar-icon">01</div>
              <h3>Help people find you and pay easily</h3>
            </div>
            <ul className="solution-list">
              <li>
                <strong>Business website</strong>
                Customers can find you quickly and contact your team.
              </li>
              <li>
                <strong>Payment options</strong>
                Mobile Money, transfers, and cash records in one flow.
              </li>
              <li>
                <strong>Lead capture</strong>
                Every customer request is captured and followed up.
              </li>
            </ul>
          </article>

          {/* Pillar 2 */}
          <article
            className="solution-pillar reveal"
            id="operations"
            style={{ "--delay": "120ms" }}
          >
            <div className="pillar-head">
              <div className="pillar-icon">02</div>
              <h3>Stay on top of daily work</h3>
            </div>
            <ul className="solution-list">
              <li>
                <strong>Real-time inventory</strong>
                Know what's in stock across all locations.
              </li>
              <li>
                <strong>Orders & deliveries</strong>
                Follow each order from sale to delivery.
              </li>
              <li>
                <strong>Money flow</strong>
                Keep sales, expenses, and payments organized.
              </li>
            </ul>
          </article>

          {/* Pillar 3 */}
          <article
            className="solution-pillar reveal"
            id="data"
            style={{ "--delay": "240ms" }}
          >
            <div className="pillar-head">
              <div className="pillar-icon">03</div>
              <h3>Understand your numbers</h3>
            </div>
            <ul className="solution-list">
              <li>
                <strong>Daily dashboards</strong>
                Sales, margins, stock — updated live.
              </li>
              <li>
                <strong>Performance tracking</strong>
                See what is working and where to improve.
              </li>
              <li>
                <strong>Weekly reports</strong>
                Delivered to your team automatically every week.
              </li>
            </ul>
          </article>
        </div>
      </section>

      {/* ========================================
          DEVICE COMPATIBILITY - NEW SECTION
          ======================================== */}
      <section className="page device-compatibility">
        {/* DEVICE MERGE EFFECT */}
        <DeviceMergeLabeled 
          laptopSrc="/imgs/elements/dashboard-laptop.svg"
          phoneSrc="/imgs/elements/dashboard-phone.svg"
          startDistance={400}
        >
          <div className="section-header device-merge-effect__section-header">
            <p className="eyebrow">Works Everywhere</p>
            <h2>Built for desktop and mobile.</h2>
            <p className="lead">
              Your team can work from phones or laptops and still stay aligned.
              One system, one set of numbers.
            </p>
          </div>
        </DeviceMergeLabeled>

        {/* Features Grid */}
        <div className="device-features reveal" style={{ "--delay": "200ms" }}>
          <article className="device-feature">
            <h4>Desktop Power</h4>
            <p>Full dashboard and reports for planning and oversight.</p>
          </article>
          
          <article className="device-feature">
            <h4>Mobile Freedom</h4>
            <p>Update stock, check orders, and handle approvals on the move.</p>
          </article>
          
          <article className="device-feature">
            <h4>Always Synced</h4>
            <p>Changes made on one device appear on all devices quickly.</p>
          </article>
        </div>
      </section>

      {/* ========================================
          BUILT FOR GHANA - NEW SECTION
          ======================================== */}
      <section className="page ghana-features">
        <div className="section-header reveal">
          <p className="eyebrow">Made for Ghana</p>
          <h2>Works with how you actually operate.</h2>
        </div>

        <div className="feature-grid reveal" style={{ "--delay": "100ms" }}>
          <article className="feature-card">
            <FontAwesomeIcon icon={faMoneyBillWave} />
            <h3>Mobile Money Built In</h3>
            <p>Track incoming payments clearly across major providers.</p>
          </article>

          <article className="feature-card" style={{ "--delay": "120ms" }}>
            <FontAwesomeIcon icon={faHandshake} />
            <h3>WhatsApp Integration</h3>
            <p>Send updates and reports to your team on WhatsApp.</p>
          </article>

          <article className="feature-card" style={{ "--delay": "240ms" }}>
            <FontAwesomeIcon icon={faShield} />
            <h3>Keeps working in tough moments</h3>
            <p>Even with unstable internet, your team can keep moving.</p>
          </article>

          <article className="feature-card" style={{ "--delay": "360ms" }}>
            <FontAwesomeIcon icon={faRoute} />
            <h3>Multi-Location Ready</h3>
            <p>View all your branches in one dashboard.</p>
          </article>
        </div>
      </section>

      {/* ========================================
          HOW IT WORKS - CONCISE
          ======================================== */}
      <section className="page process-section">
        <div className="section-header reveal">
          <p className="eyebrow">How We Work</p>
          <h2>Simple setup. Clear support.</h2>
        </div>

        <div className="process-steps reveal" style={{ "--delay": "100ms" }}>
          <div className="process-step">
            <div className="step-number">01</div>
            <div className="step-content">
              <h4>We visit</h4>
              <p>We observe how your team works today.</p>
            </div>
          </div>

          <div className="process-step">
            <div className="step-number">02</div>
            <div className="step-content">
              <h4>We set up</h4>
              <p>We configure the system to fit your business.</p>
            </div>
          </div>

          <div className="process-step">
            <div className="step-number">03</div>
            <div className="step-content">
              <h4>We launch and support</h4>
              <p>We train your team, go live, and stay available.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================
          MODULE OPTIONS - VISUAL
          ======================================== */}
      <section className="page modules-showcase" id="modules">
        <div className="section-header reveal">
          <p className="eyebrow">Pick Your Modules</p>
          <h2>Start with what you need now. Add more later.</h2>
        </div>

        <div className="module-grid reveal" style={{ "--delay": "100ms" }}>
          {moduleShowcaseItems.map((module, index) => (
            <Link
              key={module.id}
              to={`/modules/${module.id}`}
              className={`module-card module-card--${module.id}`}
              style={{ "--delay": `${index * 80}ms` }}
              aria-label={`View ${module.title} module details`}
            >
              <div className="module-card-head">
                <span className="module-card-icon">
                  <FontAwesomeIcon icon={module.icon} />
                </span>
                <span className="module-card-kicker">{module.kicker}</span>
              </div>
              <h4>{module.title}</h4>
              <p>{module.description}</p>
              <div className="module-card-signals">
                {module.signals.map((signal) => (
                  <span key={signal}>
                    <FontAwesomeIcon icon={faCheck} />
                    {signal}
                  </span>
                ))}
              </div>
              <div className="module-card-foot">
                <span>{module.outcome}</span>
                <FontAwesomeIcon icon={faArrowRight} />
              </div>
            </Link>
          ))}
        </div>

        <div className="text-center" style={{ marginTop: '2rem' }}>
          <Link to="/configure" className="button button-ghost">
            See All Modules <FontAwesomeIcon icon={faArrowRight} />
          </Link>
        </div>
      </section>

      {/* ========================================
          INDUSTRIES - NEW SECTION
          ======================================== */}
      <section className="page industries-section" id="industries">
        <div className="section-header reveal">
          <p className="eyebrow">Who We Serve</p>
          <h2>Built for how you operate.</h2>
        </div>

        <div className="industries-grid reveal" style={{ "--delay": "100ms" }}>
          <div className="industry-card">
            <h4>
              <FontAwesomeIcon icon={faStore} /> Retail
            </h4>
            <p>Shops, boutiques, stores</p>
          </div>

          <div className="industry-card">
            <h4>
              <FontAwesomeIcon icon={faTruckFast} /> Distribution
            </h4>
            <p>Wholesalers, suppliers</p>
          </div>

          <div className="industry-card">
            <h4>
              <FontAwesomeIcon icon={faCalendarCheck} /> Events
            </h4>
            <p>Rentals, planning, venues</p>
          </div>

          <div className="industry-card">
            <h4>
              <FontAwesomeIcon icon={faIndustry} /> Manufacturing
            </h4>
            <p>Production, assembly</p>
          </div>

          <div className="industry-card">
            <h4>
              <FontAwesomeIcon icon={faHelmetSafety} /> Construction
            </h4>
            <p>Projects, materials</p>
          </div>

          <div className="industry-card">
            <h4>
              <FontAwesomeIcon icon={faUtensils} /> Food & Bev
            </h4>
            <p>Restaurants, catering</p>
          </div>
        </div>
      </section>

      {/* ========================================
          PROOF SECTION - CONCISE
          ======================================== */}
      <section className="page proof-section">
        <div className="section-header reveal">
          <p className="eyebrow">Expected Impact</p>
          <h2>What this setup helps you improve.</h2>
        </div>

        <div className="proof-stats reveal" style={{ "--delay": "100ms" }}>
          <div className="stat-card">
            <div className="stat-value">Fewer</div>
            <div className="stat-label">Time-consuming admin tasks</div>
          </div>

          <div className="stat-card">
            <div className="stat-value">Clearer</div>
            <div className="stat-label">Order handovers</div>
          </div>

          <div className="stat-card">
            <div className="stat-value">Live</div>
            <div className="stat-label">Stock visibility</div>
          </div>
        </div>

        <div className="text-center" style={{ marginTop: '2rem' }}>
          <Link to="/case-studies" className="button button-ghost">
            View sample scenarios <FontAwesomeIcon icon={faArrowRight} />
          </Link>
        </div>
      </section>

      {/* ========================================
          PRICING PREVIEW
          ======================================== */}
      <section className="page pricing-preview">
        <div className="section-header reveal">
          <p className="eyebrow">Pricing</p>
          <h2>Clear costs with no surprises.</h2>
        </div>

        <div className="pricing-cards reveal" style={{ "--delay": "120ms" }}>
          <div className="pricing-card">
            <h3>Website</h3>
            <div className="price-tag">
              <span className="price">GH₵ 2,500</span>
            </div>
            <ul className="pricing-features">
              <li><FontAwesomeIcon icon={faCheck} /> Mobile website</li>
              <li><FontAwesomeIcon icon={faCheck} /> Lead capture</li>
              <li><FontAwesomeIcon icon={faCheck} /> 3-month support</li>
            </ul>
            <PrimaryButton to="/contact">Get Started</PrimaryButton>
          </div>

          <div className="pricing-card featured">
            <span className="badge">Popular</span>
            <h3>Website + Dashboard</h3>
            <div className="price-tag">
              <span className="price">GH₵ 8,500</span>
            </div>
            <ul className="pricing-features">
              <li><FontAwesomeIcon icon={faCheck} /> Everything above</li>
              <li><FontAwesomeIcon icon={faCheck} /> Sales tracking</li>
              <li><FontAwesomeIcon icon={faCheck} /> Inventory</li>
              <li><FontAwesomeIcon icon={faCheck} /> Reports</li>
            </ul>
            <PrimaryButton to="/contact">Let's Talk</PrimaryButton>
          </div>

          <div className="pricing-card">
            <h3>Complete System</h3>
            <div className="price-tag">
              <span className="price">Custom</span>
              <span className="period">GH₵ 18k+</span>
            </div>
            <ul className="pricing-features">
              <li><FontAwesomeIcon icon={faCheck} /> Everything above</li>
              <li><FontAwesomeIcon icon={faCheck} /> Multi-location</li>
              <li><FontAwesomeIcon icon={faCheck} /> Custom setup</li>
              <li><FontAwesomeIcon icon={faCheck} /> Full support</li>
            </ul>
            <PrimaryButton to="/contact">Request Quote</PrimaryButton>
          </div>
        </div>

        <p className="text-center" style={{ marginTop: '2rem', color: 'var(--muted)' }}>
          <Link to="/pricing" className="text-link">
            See detailed pricing <FontAwesomeIcon icon={faArrowRight} />
          </Link>
        </p>
      </section>

      {/* ========================================
          FINAL CTA
          ======================================== */}
      <section className="page cta reveal">
        <div className="cta-content">
          <h2>Ready to connect everything?</h2>
          <p className="lead">
            Tell us what you need and we will guide you through the best next step.
          </p>
        </div>
        <div className="cta-actions">
          <PrimaryButton to="/contact">Book a free call</PrimaryButton>
          <Link className="button button-ghost" to="/configure">
            Plan your setup
          </Link>
        </div>
      </section>

      <WhatsApp />
    </section>
  );
}
