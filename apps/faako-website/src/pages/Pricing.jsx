import { useState } from "react";
import { Link } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCheck,
  faX,
  faStore,
  faTruckFast,
  faGlassCheers,
  faCalendar,
  faLightbulb,
  faShieldHalved,
  faHeadset,
} from "@fortawesome/free-solid-svg-icons";
import PrimaryButton from "../components/PrimaryButton.jsx";
import WhatsApp from "../components/WhatsApp.jsx";
import "../styles/pages/Pricing.css";

// Pricing tiers
const pricingTiers = [
  {
    id: "starter",
    name: "Starter",
    tagline: "A simple start for your business",
    price: "2,500",
    priceNote: "one-time",
    timeline: "2-3 weeks",
    bestFor: "New businesses starting with the basics",
    includes: [
      "Business website (5 pages)",
      "Mobile-friendly design",
      "Contact forms and WhatsApp connection",
      "Basic search setup",
      "SSL certificate and hosting (1 year)",
      "Mobile Money payment page",
    ],
    notIncluded: [
      "Dashboard or reporting",
      "Inventory management",
      "Order tracking",
      "Staff management",
    ],
    cta: "Get Started",
  },
  {
    id: "professional",
    name: "Professional",
    tagline: "Website plus a live business dashboard",
    price: "8,500",
    priceNote: "one-time",
    timeline: "4-6 weeks",
    bestFor: "Growing businesses that need daily visibility",
    includes: [
      "Everything in Starter",
      "Sales dashboard with live updates",
      "Inventory tracking (up to 500 items)",
      "Order management",
      "Weekly reports to WhatsApp and email",
      "Payment tracking (Mobile Money + cash)",
      "3 months premium support",
    ],
    notIncluded: [
      "Multi-location support",
      "Advanced reporting",
      "HR/payroll features",
      "Custom business setup",
    ],
    cta: "Most Popular",
    popular: true,
  },
  {
    id: "enterprise",
    name: "Enterprise",
    tagline: "A complete setup for larger teams",
    price: "Custom",
    priceNote: "starts at GH₵ 18,000",
    timeline: "6-10 weeks",
    bestFor: "Established businesses with broader needs",
    includes: [
      "Everything in Professional",
      "Unlimited inventory items",
      "Multi-location management",
      "Customer follow-up and sales progress",
      "HR & payroll module",
      "Delivery/route tracking",
      "Custom reports and advanced insights",
      "WhatsApp Business integration",
      "6 months premium support",
      "Staff training included",
    ],
    notIncluded: [],
    cta: "Request Quote",
  },
];

// Sample pricing scenarios with detailed scope estimates
const pricingScenarios = [
  {
    id: "retail-boutique",
    industry: "Retail",
    icon: faStore,
    iconColor: "#FF6B35",
    businessName: "Retail Growth Scenario",
    location: "Illustrative scope",
    challenge: "Stock tracking across two locations with manual counting",
    solution: "Professional package + Delivery module",
    modules: ["Website", "Dashboard", "Inventory", "Orders", "Delivery"],
    breakdown: [
      { item: "Website (5 pages)", price: 2500 },
      { item: "Dashboard + Inventory", price: 3500 },
      { item: "Order management", price: 1800 },
      { item: "Delivery tracking", price: 1800 },
    ],
    totalPrice: 9600,
    timeline: "4-5 weeks",
    results: [
      "Reduce avoidable stockouts",
      "Process orders faster",
      "See daily stock levels clearly",
    ],
  },
  {
    id: "distribution",
    industry: "Distribution",
    icon: faTruckFast,
    iconColor: "#F7931E",
    businessName: "Distribution Expansion Scenario",
    location: "Illustrative scope",
    challenge: "Managing five warehouses, deliveries, and payment follow-up",
    solution: "Enterprise package",
    modules: ["Website", "Dashboard", "Inventory", "CRM", "Orders", "Delivery", "Payments"],
    breakdown: [
      { item: "Website + Dashboard", price: 8500 },
      { item: "Multi-location inventory", price: 3500 },
      { item: "Customer follow-up system", price: 1800 },
      { item: "Delivery route tracking", price: 1800 },
      { item: "Payment integration", price: 1800 },
      { item: "Staff training", price: 1200 },
    ],
    totalPrice: 18600,
    timeline: "7-9 weeks",
    results: [
      "Reduce delivery errors",
      "Make payment follow-up easier",
      "Track all locations in one view",
    ],
  },
  {
    id: "events",
    industry: "Events & Rentals",
    icon: faGlassCheers,
    iconColor: "#9B59B6",
    businessName: "Events Scheduling Scenario",
    location: "Illustrative scope",
    challenge: "Double bookings and manual calendar tracking",
    solution: "Professional + Bookings + Scheduler",
    modules: ["Website", "Dashboard", "Inventory", "Bookings", "Scheduler", "Payments"],
    breakdown: [
      { item: "Professional package", price: 8500 },
      { item: "Booking system", price: 1800 },
      { item: "Staff scheduler", price: 1800 },
    ],
    totalPrice: 12100,
    timeline: "5-6 weeks",
    results: [
      "Prevent booking conflicts",
      "Keep equipment availability clear",
      "Make staff scheduling consistent",
    ],
  },
];

export default function Pricing() {
  const [selectedCase, setSelectedCase] = useState(null);
  const toggleCase = (caseId) => {
    setSelectedCase((currentCaseId) =>
      currentCaseId === caseId ? null : caseId
    );
  };

  return (
    <section className="page pricing page-stack">

      {/* ========================================
          HERO SECTION
          ======================================== */}
      <section className="pricing-hero-v2">
        <div className="pricing-hero-content reveal" data-scroll>
          <p className="eyebrow">Pricing</p>
          <h1>
            Clear pricing.<br/>{" "}
            <span className="text-accent">No surprises.</span>
          </h1>
          <p className="lead">
            Launch pricing for early-stage teams (through June 30, 2026). One-time setup fee, then optional support.
          </p>
          <p className="muted">
            We keep pricing clear and fair so you can plan with confidence.
          </p>
        </div>

        {/* Pricing Philosophy */}
        <div
          className="pricing-philosophy reveal"
          data-scroll
          style={{ "--delay": "100ms" }}
        >
          <div className="philosophy-card reveal" data-scroll style={{ "--delay": "140ms" }}>
            <FontAwesomeIcon icon={faLightbulb} />
            <h4>Pay once, own forever</h4>
            <p>No forced monthly software subscription. The system is yours.</p>
          </div>

          <div className="philosophy-card reveal" data-scroll style={{ "--delay": "200ms" }}>
            <FontAwesomeIcon icon={faShieldHalved} />
            <h4>Transparent breakdown</h4>
            <p>See exactly what you are paying for. No hidden charges.</p>
          </div>

          <div className="philosophy-card reveal" data-scroll style={{ "--delay": "260ms" }}>
            <FontAwesomeIcon icon={faHeadset} />
            <h4>Support included</h4>
            <p>3-6 months of updates and fixes, then optional support.</p>
          </div>
        </div>
      </section>

      {/* ========================================
          PRICING TIERS COMPARISON
          ======================================== */}
      <section className="page pricing-tiers-section">
        <div className="section-header reveal" data-scroll>
          <p className="eyebrow">Three Packages</p>
          <h2>Choose what fits your business stage.</h2>
          <p className="lead">
            Start with what you need now and grow from there.
          </p>
        </div>

        <div className="pricing-tiers-grid">
          {pricingTiers.map((tier, index) => (
            <article
              key={tier.id}
              className={`pricing-tier-card reveal ${tier.popular ? "is-popular" : ""}`}
              data-scroll
              style={{ "--delay": `${120 + index * 70}ms` }}
            >
              {tier.popular && <div className="popular-badge">Most Popular</div>}
              
              <div className="tier-header">
                <h3>{tier.name}</h3>
                <p className="tier-tagline">{tier.tagline}</p>
              </div>

              <div className="tier-pricing">
                <div className="price-display">
                  <span className="currency">GH₵</span>
                  <span className="price">{tier.price}</span>
                </div>
                <p className="price-note">{tier.priceNote}</p>
                <p className="timeline">
                  <FontAwesomeIcon icon={faCalendar} /> {tier.timeline}
                </p>
              </div>

              <div className="tier-best-for">
                <strong>Best for:</strong> {tier.bestFor}
              </div>

              <div className="tier-features">
                <h4>What's included:</h4>
                <ul className="included-list">
                  {tier.includes.map((item, i) => (
                    <li key={i}>
                      <FontAwesomeIcon icon={faCheck} />
                      {item}
                    </li>
                  ))}
                </ul>

                {tier.notIncluded.length > 0 && (
                  <>
                    <h4 className="not-included-title">Not included:</h4>
                    <ul className="not-included-list">
                      {tier.notIncluded.map((item, i) => (
                        <li key={i}>
                          <FontAwesomeIcon icon={faX} />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </div>

              <div className="tier-cta">
                <PrimaryButton to="/contact">{tier.cta}</PrimaryButton>
              </div>
            </article>
          ))}
        </div>

        <p className="pricing-note">
          All prices are one-time setup fees. Hosting, domain, and maintenance are separate (see below).
        </p>
      </section>

      {/* ========================================
          SAMPLE SCENARIOS
          ======================================== */}
      <section className="page case-pricing-section">
        <div className="section-header reveal" data-scroll>
          <p className="eyebrow">Sample Scenarios</p>
          <h2>See example scopes and price ranges.</h2>
          <p className="lead">
            These examples help you estimate cost before we meet.
          </p>
        </div>

        <div className="case-pricing-grid">
          {pricingScenarios.map((study, index) => (
            <article
              key={study.id}
              className="case-pricing-card reveal"
              data-scroll
              style={{ "--delay": `${120 + index * 80}ms` }}
            >
              <div className="case-header">
                <div className="case-icon" style={{ color: study.iconColor }}>
                  <FontAwesomeIcon icon={study.icon} />
                </div>
                <div className="case-info">
                  <h3>{study.businessName}</h3>
                  <p className="case-meta">
                    {study.industry} • {study.location}
                  </p>
                </div>
              </div>

              <div className="case-summary">
                <div className="case-row">
                  <strong>Typical challenge:</strong>
                  <p>{study.challenge}</p>
                </div>
                <div className="case-row">
                  <strong>Suggested setup:</strong>
                  <p>{study.solution}</p>
                </div>
              </div>

              <div className="case-modules">
                {study.modules.map((module, i) => (
                  <span key={i} className="module-badge">{module}</span>
                ))}
              </div>

              <div className="case-price-summary">
                <div className="total-price">
                  <span>Estimated investment:</span>
                  <span className="price">GH₵ {study.totalPrice.toLocaleString()}</span>
                </div>
                <div className="timeline-info">
                  <FontAwesomeIcon icon={faCalendar} />
                  {study.timeline}
                </div>
              </div>

              {/* Expandable breakdown */}
              {selectedCase === study.id && (
                <div className="case-breakdown" id={`case-breakdown-${study.id}`}>
                  <h4>Sample price breakdown:</h4>
                  <ul className="breakdown-list">
                    {study.breakdown.map((item, i) => (
                      <li key={i}>
                        <span>{item.item}</span>
                        <span>GH₵ {item.price.toLocaleString()}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="breakdown-total">
                    <span>Total</span>
                    <span>GH₵ {study.totalPrice.toLocaleString()}</span>
                  </div>

                  <div className="case-results">
                  <h4>Potential outcomes:</h4>
                  <ul>
                      {study.results.map((result, i) => (
                        <li key={i}>
                          <FontAwesomeIcon icon={faCheck} />
                          {result}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              <button
                className="expand-button"
                type="button"
                onClick={() => toggleCase(study.id)}
                aria-expanded={selectedCase === study.id}
                aria-controls={`case-breakdown-${study.id}`}
              >
                {selectedCase === study.id ? "Hide details" : "View price breakdown"}
              </button>
            </article>
          ))}
        </div>
        <p className="pricing-note">
          Final pricing and delivery timelines are confirmed after we review your business needs.
        </p>
      </section>

      {/* ========================================
          MODULE PRICING BREAKDOWN
          ======================================== */}
      <section className="page module-pricing-section">
        <div className="section-header reveal" data-scroll>
          <p className="eyebrow">Add-On Modules</p>
          <h2>Build your custom system.</h2>
          <p className="lead">
            Start with a package, then add features as your business grows.
          </p>
        </div>

        <div className="module-pricing-table reveal" data-scroll style={{ "--delay": "100ms" }}>
          <table>
            <thead>
              <tr>
                <th>Module</th>
                <th>What it does</th>
                <th>Price</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>Inventory</strong></td>
                <td>Track stock across locations</td>
                <td>GH₵ 1,800</td>
              </tr>
              <tr>
                <td><strong>CRM</strong></td>
                <td>Track leads, customers, and follow-ups</td>
                <td>GH₵ 1,800</td>
              </tr>
              <tr>
                <td><strong>Orders</strong></td>
                <td>Handle orders from quote to delivery</td>
                <td>GH₵ 1,800</td>
              </tr>
              <tr>
                <td><strong>Bookings</strong></td>
                <td>Manage reservations and schedules</td>
                <td>GH₵ 1,800</td>
              </tr>
              <tr>
                <td><strong>Scheduler</strong></td>
                <td>Plan shifts, assignments, and availability</td>
                <td>GH₵ 1,800</td>
              </tr>
              <tr>
                <td><strong>Delivery</strong></td>
                <td>Manage routes and delivery confirmation</td>
                <td>GH₵ 1,800</td>
              </tr>
              <tr>
                <td><strong>Payments</strong></td>
                <td>Track Mobile Money, invoices, and payments</td>
                <td>GH₵ 1,800</td>
              </tr>
              <tr>
                <td><strong>HR & Payroll</strong></td>
                <td>Manage staff records, payroll, and attendance</td>
                <td>GH₵ 2,500</td>
              </tr>
              <tr>
                <td><strong>Integrations</strong></td>
                <td>Connect tools like QuickBooks, Xero, and WhatsApp</td>
                <td>GH₵ 2,200</td>
              </tr>
              <tr>
                <td><strong>Analytics</strong></td>
                <td>Advanced reporting and planning insights</td>
                <td>GH₵ 2,200</td>
              </tr>
              <tr className="custom-row">
                <td><strong>Custom Module</strong></td>
                <td>Built for your unique business process</td>
                <td>GH₵ 2,500 - 5,500</td>
              </tr>
            </tbody>
          </table>
        </div>

        <p className="pricing-note">
          <strong>Volume discount:</strong> Add 3+ modules and save 8%. Add 5+ and save 12%.
        </p>
      </section>

      {/* ========================================
          ONGOING COSTS
          ======================================== */}
      <section className="page ongoing-costs-section">
        <div className="section-header reveal" data-scroll>
          <p className="eyebrow">What Comes After</p>
          <h2>Ongoing costs explained.</h2>
          <p className="lead">
            No surprises. Here is what you may pay each year.
          </p>
        </div>

        <div className="ongoing-costs-grid">
          <div className="cost-card reveal" data-scroll style={{ "--delay": "120ms" }}>
            <h4>Hosting & Domain</h4>
            <div className="cost-price">GH₵ 600 - 1,200/year</div>
            <p>Keeps your system online. Includes SSL certificate and daily backups.</p>
            <ul>
              <li>Small business: GH₵ 600/year</li>
              <li>Growing business: GH₵ 900/year</li>
              <li>High traffic: GH₵ 1,200/year</li>
            </ul>
          </div>

          <div className="cost-card reveal" data-scroll style={{ "--delay": "180ms" }}>
            <h4>Maintenance & Updates</h4>
            <div className="cost-price">GH₵ 1,500 - 3,000/year</div>
            <p>Optional support plan for fixes, updates, and small changes.</p>
            <ul>
              <li>Basic plan: GH₵ 1,500/year</li>
              <li>Premium plan: GH₵ 3,000/year</li>
              <li>Includes: Updates, backups, support</li>
            </ul>
          </div>

          <div className="cost-card reveal" data-scroll style={{ "--delay": "240ms" }}>
            <h4>Mobile Money Fees</h4>
            <div className="cost-price">2.5% per transaction</div>
            <p>Only applies when you accept online payments.</p>
            <ul>
              <li>MTN Mobile Money: 2.5%</li>
              <li>Vodafone Cash: 2.5%</li>
              <li>AirtelTigo Money: 2.5%</li>
            </ul>
          </div>
        </div>

        <div className="total-cost-example reveal" data-scroll style={{ "--delay": "280ms" }}>
          <h4>Total annual cost example:</h4>
          <div className="example-breakdown">
            <div className="example-row">
              <span>Hosting & Domain</span>
              <span>GH₵ 900</span>
            </div>
            <div className="example-row">
              <span>Maintenance (optional)</span>
              <span>GH₵ 1,500</span>
            </div>
            <div className="example-divider"></div>
            <div className="example-row total">
              <span>Total per year</span>
              <span>GH₵ 2,400</span>
            </div>
          </div>
          <p className="example-note">
            That is about <strong>GH₵ 200/month</strong> in this example.
          </p>
        </div>
      </section>

      {/* ========================================
          PAYMENT OPTIONS
          ======================================== */}
      <section className="page payment-options-section">
        <div className="section-header reveal" data-scroll>
          <p className="eyebrow">Payment Plans</p>
          <h2>Pay in stages or pay all at once.</h2>
        </div>

        <div className="payment-grid">
          <div className="payment-card reveal" data-scroll style={{ "--delay": "120ms" }}>
            <h4>Pay in Full</h4>
            <p className="payment-discount">Save 5%</p>
            <p>Pay 100% upfront and get a 5% discount on your project cost.</p>
            <div className="payment-example">
              <strong>Example:</strong><br />
              GH₵ 8,500 project → Pay GH₵ 8,075
            </div>
          </div>

          <div className="payment-card recommended reveal" data-scroll style={{ "--delay": "180ms" }}>
            <div className="recommended-badge">Recommended</div>
            <h4>Pay in Stages</h4>
            <p className="payment-discount">Most common</p>
            <p>Split payment into 3 parts linked to clear project milestones.</p>
            <div className="payment-stages">
              <div className="stage">
                <span className="stage-percent">40%</span>
                <span className="stage-label">Start (deposit)</span>
              </div>
              <div className="stage">
                <span className="stage-percent">30%</span>
                <span className="stage-label">Demo review</span>
              </div>
              <div className="stage">
                <span className="stage-percent">30%</span>
                <span className="stage-label">Launch day</span>
              </div>
            </div>
          </div>

          <div className="payment-card reveal" data-scroll style={{ "--delay": "240ms" }}>
            <h4>Monthly Plan</h4>
            <p className="payment-discount">Coming soon</p>
            <p>Spread cost over 12 months for projects above GH₵ 12,000.</p>
            <div className="payment-example">
              <strong>Example:</strong><br />
              GH₵ 18,000 project → GH₵ 1,500/month for 12 months
            </div>
          </div>
        </div>
      </section>

      {/* ========================================
          COMPARISON: DIY vs FAAKO
          ======================================== */}
      <section className="page comparison-section">
        <div className="section-header reveal" data-scroll>
          <p className="eyebrow">Illustrative Comparison</p>
          <h2>Separate tools vs one connected system.</h2>
        </div>

        <div className="comparison-table-wrapper reveal" data-scroll style={{ "--delay": "120ms" }}>
          <table className="comparison-table">
            <thead>
              <tr>
                <th>Option</th>
                <th>Excel + WhatsApp</th>
                <th>Faako System</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>Setup cost</strong></td>
                <td>Free (your time)</td>
                <td>GH₵ 2,500 - 18,000</td>
              </tr>
              <tr>
                <td><strong>Time to set up</strong></td>
                <td>Ongoing and often unfinished</td>
                <td>2-12 weeks then ready</td>
              </tr>
              <tr>
                <td><strong>Data accuracy</strong></td>
                <td>More manual entry errors</td>
                <td>Clear checks and cleaner records</td>
              </tr>
              <tr>
                <td><strong>Real-time updates</strong></td>
                <td><FontAwesomeIcon icon={faX} /></td>
                <td><FontAwesomeIcon icon={faCheck} /></td>
              </tr>
              <tr>
                <td><strong>Multi-location</strong></td>
                <td><FontAwesomeIcon icon={faX} /></td>
                <td><FontAwesomeIcon icon={faCheck} /></td>
              </tr>
              <tr>
                <td><strong>Mobile access</strong></td>
                <td>Limited</td>
                <td>Full (app-like)</td>
              </tr>
              <tr>
                <td><strong>Reports</strong></td>
                <td>Manual creation</td>
                <td>Generated automatically</td>
              </tr>
              <tr>
                <td><strong>Support</strong></td>
                <td>Self-service only</td>
                <td>Dedicated support team</td>
              </tr>
              <tr>
                <td><strong>Scalability</strong></td>
                <td>Gets harder as operations grow</td>
                <td>Built to scale with your business</td>
              </tr>
              <tr className="total-row">
                <td><strong>Illustrative 3-year spend</strong></td>
                <td>
                  <div className="cost-breakdown-cell">
                    <span>~GH₵ 15,000</span>
                    <small>(assumption: team time + avoidable errors)</small>
                  </div>
                </td>
                <td>
                  <div className="cost-breakdown-cell">
                    <span>~GH₵ 15,700</span>
                    <small>(assumption: build + hosting for 3 years)</small>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <p className="comparison-note reveal" data-scroll style={{ "--delay": "170ms" }}>
          <strong>Planning takeaway:</strong> A connected system may cost more upfront, but it can save time and reduce errors over the long term.
        </p>
      </section>

      {/* ========================================
          FAQ SECTION
          ======================================== */}
      <section className="page pricing-faq-section">
        <div className="section-header reveal" data-scroll>
          <p className="eyebrow">Questions</p>
          <h2>Pricing questions answered.</h2>
        </div>

        <div className="faq-grid-two-col">
          <div className="faq-card reveal" data-scroll style={{ "--delay": "120ms" }}>
            <h4>Why one-time payment instead of monthly?</h4>
            <p>You pay once for setup and own your system. Optional support can be added later if you want it.</p>
          </div>

          <div className="faq-card reveal" data-scroll style={{ "--delay": "170ms" }}>
            <h4>Can I start with Starter and upgrade later?</h4>
            <p>Yes. You can pay the difference between packages when you are ready to expand.</p>
          </div>

          <div className="faq-card reveal" data-scroll style={{ "--delay": "220ms" }}>
            <h4>What if I only need one specific module?</h4>
            <p>Most projects start with the core setup first, then extra modules can be added as needed.</p>
          </div>

          <div className="faq-card reveal" data-scroll style={{ "--delay": "270ms" }}>
            <h4>Do you offer refunds?</h4>
            <p>Once work begins, the initial deposit is non-refundable. Any remaining payment terms are agreed before launch.</p>
          </div>

          <div className="faq-card reveal" data-scroll style={{ "--delay": "320ms" }}>
            <h4>What's included in "support"?</h4>
            <p>Support includes fixes, updates, and small changes. Bigger new features are scoped separately.</p>
          </div>

          <div className="faq-card reveal" data-scroll style={{ "--delay": "370ms" }}>
            <h4>Can I host it myself?</h4>
            <p>Yes, if your team can manage hosting. We can provide guidance, but your team handles ongoing upkeep.</p>
          </div>

          <div className="faq-card reveal" data-scroll style={{ "--delay": "420ms" }}>
            <h4>Why is Enterprise pricing "custom"?</h4>
            <p>Large teams need different features and timelines, so we review your needs and give a clear custom quote.</p>
          </div>

          <div className="faq-card reveal" data-scroll style={{ "--delay": "470ms" }}>
            <h4>Do you offer discounts for NGOs or schools?</h4>
            <p>Yes. Registered non-profits and schools can request discounted pricing.</p>
          </div>
        </div>
      </section>

      {/* ========================================
          FINAL CTA
          ======================================== */}
      <section className="page cta reveal" data-scroll>
        <div className="cta-content">
          <h2>Ready to plan your system?</h2>
          <p className="lead">
            Book a free consultation and we will show you what you need and what it will cost.
          </p>
        </div>
        <div className="cta-actions">
          <PrimaryButton to="/contact">Get your custom quote</PrimaryButton>
          <Link className="button button-ghost" to="/configure">
            Build Your System
          </Link>
        </div>
      </section>

      <WhatsApp />
    </section>
  );
}
