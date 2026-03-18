import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faArrowRight,
  faStore,
  faTruckFast,
  faGlassCheers,
  faBriefcase,
  faIndustry,
  faUtensils,
  faMapMarkerAlt,
  faCalendar,
  faFilter,
} from "@fortawesome/free-solid-svg-icons";
import PrimaryButton from "../components/PrimaryButton.jsx";
import WhatsApp from "../components/WhatsApp.jsx";
import "../styles/pages/CaseStudies.css";

const scenarioBlueprints = [
  {
    id: "retail-baseline",
    title: "Retail Stock Control Plan",
    industry: "Retail",
    icon: faStore,
    iconColor: "#FF6B35",
    location: "metro",
    locationName: "Metro teams",
    businessType: "Fashion, cosmetics, and general retail",
    challenge: "Stock checks happen late and branch-level numbers rarely match.",
    solution: "Website + Dashboard + Inventory + Orders",
    metrics: [
      { label: "Primary goal", value: "Shared view", subtext: "stock + orders" },
      { label: "Data rhythm", value: "Daily", subtext: "opening and closing sync" },
      { label: "Rollout style", value: "Phased", subtext: "one branch at a time" },
    ],
    timeline: "Typical setup: 4-6 weeks",
    investment: "Estimate: GH₵ 9,600",
    thumbnail: "/imgs/case-studies/dashboard-case.png",
    featured: true,
  },
  {
    id: "distribution-blueprint",
    title: "Distribution Visibility Plan",
    industry: "Distribution",
    icon: faTruckFast,
    iconColor: "#F7931E",
    location: "multi-city",
    locationName: "Multi-city teams",
    businessType: "Wholesale and supplier networks",
    challenge: "Warehouse updates and delivery confirmations are tracked in separate tools.",
    solution: "Website + Multi-location Inventory + Delivery + CRM",
    metrics: [
      { label: "Primary goal", value: "Clear handoffs", subtext: "warehouse to dispatch" },
      { label: "Data rhythm", value: "Live", subtext: "order and delivery status" },
      { label: "How we start", value: "Pilot first", subtext: "largest warehouse first" },
    ],
    timeline: "Typical setup: 6-9 weeks",
    investment: "Estimate: GH₵ 18,600",
    thumbnail: "/imgs/case-studies/erp-case.png",
    featured: true,
  },
  {
    id: "events-planning",
    title: "Events Scheduling Plan",
    industry: "Events",
    icon: faGlassCheers,
    iconColor: "#9B59B6",
    location: "metro",
    locationName: "Metro teams",
    businessType: "Events, rentals, and venue operations",
    challenge: "Equipment and staff scheduling relies on manual calendars.",
    solution: "Website + Dashboard + Bookings + Scheduler + Inventory",
    metrics: [
      { label: "Primary goal", value: "Conflict control", subtext: "avoid overlap" },
      { label: "Data rhythm", value: "Per booking", subtext: "inventory reservation checks" },
      { label: "How we start", value: "Ops-led", subtext: "calendar process first" },
    ],
    timeline: "Typical setup: 5-7 weeks",
    investment: "Estimate: GH₵ 12,100",
    thumbnail: "/imgs/case-studies/booking-case.png",
    featured: false,
  },
  {
    id: "manufacturing-flow",
    title: "Manufacturing Order Flow Plan",
    industry: "Manufacturing",
    icon: faIndustry,
    iconColor: "#E74C3C",
    location: "industrial",
    locationName: "Industrial hubs",
    businessType: "Light manufacturing and assembly",
    challenge: "Production stages are logged manually, slowing dispatch decisions.",
    solution: "Website + Dashboard + Inventory + Orders + Scheduler",
    metrics: [
      { label: "Primary goal", value: "Stage visibility", subtext: "raw to finished" },
      { label: "Data rhythm", value: "Shift-based", subtext: "floor updates" },
      { label: "How we start", value: "Supervisor-led", subtext: "line-by-line adoption" },
    ],
    timeline: "Typical setup: 6-8 weeks",
    investment: "Estimate: GH₵ 13,900",
    thumbnail: "/imgs/case-studies/dashboard-case.png",
    featured: false,
  },
  {
    id: "food-service-flow",
    title: "Food Service Multi-Branch Plan",
    industry: "Food & Beverage",
    icon: faUtensils,
    iconColor: "#27AE60",
    location: "multi-city",
    locationName: "Multi-city teams",
    businessType: "Restaurants and catering operations",
    challenge: "Branch stock and menu updates are inconsistent during busy periods.",
    solution: "Website + Dashboard + Inventory + Orders + Scheduler",
    metrics: [
      { label: "Primary goal", value: "Branch consistency", subtext: "menus + stock" },
      { label: "Data rhythm", value: "Daily", subtext: "prep and close cycles" },
      { label: "How we start", value: "Branch waves", subtext: "one location each sprint" },
    ],
    timeline: "Typical setup: 5-7 weeks",
    investment: "Estimate: GH₵ 13,900",
    thumbnail: "/imgs/case-studies/dashboard-case.png",
    featured: false,
  },
  {
    id: "services-ops",
    title: "Professional Services Plan",
    industry: "Services",
    icon: faBriefcase,
    iconColor: "#3498DB",
    location: "remote",
    locationName: "Remote-first teams",
    businessType: "Consulting and client services",
    challenge: "Client updates, follow-ups, and billing sit across disconnected apps.",
    solution: "Website + Dashboard + CRM + Scheduler + Payments",
    metrics: [
      { label: "Primary goal", value: "Client follow-up", subtext: "reminders + next steps" },
      { label: "Data rhythm", value: "Weekly", subtext: "client health reports" },
      { label: "How we start", value: "Team pod", subtext: "roll out by client pod" },
    ],
    timeline: "Typical setup: 4-6 weeks",
    investment: "Estimate: GH₵ 15,700",
    thumbnail: "/imgs/case-studies/erp-case.png",
    featured: false,
  },
];

export default function CaseStudies() {
  const [selectedIndustry, setSelectedIndustry] = useState("all");
  const [selectedLocation, setSelectedLocation] = useState("all");

  const industries = [...new Set(scenarioBlueprints.map((item) => item.industry))];
  const locations = [...new Set(scenarioBlueprints.map((item) => item.locationName))];
  const featuredTemplates = scenarioBlueprints.filter((item) => item.featured).length;

  const filteredScenarios = useMemo(
    () =>
      scenarioBlueprints.filter((item) => {
        const matchesIndustry =
          selectedIndustry === "all" || item.industry === selectedIndustry;
        const matchesLocation =
          selectedLocation === "all" || item.locationName === selectedLocation;
        return matchesIndustry && matchesLocation;
      }),
    [selectedIndustry, selectedLocation],
  );

  const clearFilters = () => {
    setSelectedIndustry("all");
    setSelectedLocation("all");
  };

  return (
    <section className="page case-studies-page page-stack">
      <section className="case-hero-v2">
        <div className="case-hero-content reveal" data-scroll>
          <p className="eyebrow">Planning Scenarios</p>
          <h1>
            Real planning examples for<br />
            <span className="text-accent">growing teams.</span>
          </h1>
          <p className="lead">
            These are sample project plans based on common needs. They help you
            estimate scope and budget before we start.
          </p>
        </div>

        <div className="case-hero-stats reveal" data-scroll style={{ "--delay": "120ms" }}>
          <div className="hero-stat reveal" data-scroll style={{ "--delay": "160ms" }}>
            <div className="stat-value">{scenarioBlueprints.length}</div>
            <div className="stat-label">Sample plans</div>
          </div>
          <div className="hero-stat reveal" data-scroll style={{ "--delay": "210ms" }}>
            <div className="stat-value">{industries.length}</div>
            <div className="stat-label">Industries covered</div>
          </div>
          <div className="hero-stat reveal" data-scroll style={{ "--delay": "260ms" }}>
            <div className="stat-value">{featuredTemplates}</div>
            <div className="stat-label">Featured plans</div>
          </div>
        </div>
      </section>

      <section className="page filters-section">
        <div className="filters-container reveal" data-scroll>
          <div className="filter-group">
            <label>
              <FontAwesomeIcon icon={faFilter} />
              <span>Industry:</span>
            </label>
            <select
              value={selectedIndustry}
              onChange={(event) => setSelectedIndustry(event.target.value)}
              className="filter-select"
            >
              <option value="all">All industries</option>
              {industries.map((industry) => (
                <option key={industry} value={industry}>
                  {industry}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label>
              <FontAwesomeIcon icon={faMapMarkerAlt} />
              <span>Team profile:</span>
            </label>
            <select
              value={selectedLocation}
              onChange={(event) => setSelectedLocation(event.target.value)}
              className="filter-select"
            >
              <option value="all">All team profiles</option>
              {locations.map((location) => (
                <option key={location} value={location}>
                  {location}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-results">
            Showing <strong>{filteredScenarios.length}</strong>{" "}
            {filteredScenarios.length === 1 ? "scenario" : "scenarios"}
          </div>
        </div>
      </section>

      <section className="page case-studies-grid-section">
        <div className="case-studies-grid">
          {filteredScenarios.map((study, index) => (
            <article
              key={study.id}
              className={`case-study-card reveal ${study.featured ? "is-featured" : ""}`}
              data-scroll
              style={{ "--delay": `${100 + index * 70}ms` }}
            >
              {study.featured ? <div className="featured-badge">Template</div> : null}

              <div className="case-study-header">
                <div className="case-study-icon" style={{ color: study.iconColor }}>
                  <FontAwesomeIcon icon={study.icon} />
                </div>
                <div className="case-study-meta">
                  <span className="industry-tag">{study.industry}</span>
                  <span className="location-tag">
                    <FontAwesomeIcon icon={faMapMarkerAlt} />
                    {study.locationName}
                  </span>
                </div>
              </div>

              <div className="case-study-image">
                <img src={study.thumbnail} alt={study.title} loading="lazy" />
              </div>

              <div className="case-study-content">
                <h3>{study.title}</h3>
                <p className="business-type">{study.businessType}</p>

                <div className="challenge-solution">
                  <div className="cs-item">
                    <strong>Typical challenge:</strong>
                    <p>{study.challenge}</p>
                  </div>
                  <div className="cs-item">
                    <strong>Suggested setup:</strong>
                    <p>{study.solution}</p>
                  </div>
                </div>

                <div className="case-study-metrics">
                  {study.metrics.map((metric) => (
                    <div key={metric.label} className="metric">
                      <div className="metric-value">{metric.value}</div>
                      <div className="metric-label">{metric.label}</div>
                      <div className="metric-subtext">{metric.subtext}</div>
                    </div>
                  ))}
                </div>

                <div className="case-study-footer">
                  <div className="footer-info">
                    <span>
                      <FontAwesomeIcon icon={faCalendar} />
                      {study.timeline}
                    </span>
                    <span className="investment">{study.investment}</span>
                  </div>
                  <Link to="/configure" className="case-study-link">
                    Plan this setup
                    <FontAwesomeIcon icon={faArrowRight} />
                  </Link>
                </div>
              </div>
            </article>
          ))}
        </div>

        {filteredScenarios.length === 0 ? (
          <div className="no-results reveal" data-scroll>
            <p>No scenarios match your filters.</p>
            <button
              className="button button-ghost"
              type="button"
              onClick={clearFilters}
            >
              Clear Filters
            </button>
          </div>
        ) : null}
      </section>

      <section className="page impact-summary-section">
        <div className="section-header reveal" data-scroll>
          <p className="eyebrow">Expected Impact Areas</p>
          <h2>What these plans are designed to improve.</h2>
        </div>

        <div className="impact-grid">
          <div className="impact-card reveal" data-scroll style={{ "--delay": "120ms" }}>
            <div className="impact-number">Cleaner</div>
            <div className="impact-label">Team handovers</div>
            <p>Sales, stock, and delivery updates stay aligned.</p>
          </div>

          <div className="impact-card reveal" data-scroll style={{ "--delay": "180ms" }}>
            <div className="impact-number">Faster</div>
            <div className="impact-label">Weekly reporting</div>
            <p>Spend less time combining spreadsheets every week.</p>
          </div>

          <div className="impact-card reveal" data-scroll style={{ "--delay": "240ms" }}>
            <div className="impact-number">Live</div>
            <div className="impact-label">Daily visibility</div>
            <p>Managers see updates as teams complete work.</p>
          </div>

          <div className="impact-card reveal" data-scroll style={{ "--delay": "300ms" }}>
            <div className="impact-number">Phased</div>
            <div className="impact-label">Launch approach</div>
            <p>Adopt in steps instead of changing everything at once.</p>
          </div>
        </div>
      </section>

      <section className="page industries-served-section">
        <div className="section-header reveal" data-scroll>
          <p className="eyebrow">Who We Build For</p>
          <h2>Common business types we support.</h2>
        </div>

        <div className="industries-served-grid">
          <div className="industry-served-card reveal" data-scroll style={{ "--delay": "120ms" }}>
            <FontAwesomeIcon icon={faStore} />
            <h4>Retail & Shops</h4>
            <p>Boutiques, stores, and branch networks</p>
          </div>

          <div className="industry-served-card reveal" data-scroll style={{ "--delay": "170ms" }}>
            <FontAwesomeIcon icon={faTruckFast} />
            <h4>Distribution</h4>
            <p>Wholesalers and fulfillment teams</p>
          </div>

          <div className="industry-served-card reveal" data-scroll style={{ "--delay": "220ms" }}>
            <FontAwesomeIcon icon={faGlassCheers} />
            <h4>Events & Rentals</h4>
            <p>Event planning and equipment operations</p>
          </div>

          <div className="industry-served-card reveal" data-scroll style={{ "--delay": "270ms" }}>
            <FontAwesomeIcon icon={faIndustry} />
            <h4>Manufacturing</h4>
            <p>Light production and assembly teams</p>
          </div>

          <div className="industry-served-card reveal" data-scroll style={{ "--delay": "320ms" }}>
            <FontAwesomeIcon icon={faUtensils} />
            <h4>Food & Beverage</h4>
            <p>Restaurants, kitchens, and catering teams</p>
          </div>

          <div className="industry-served-card reveal" data-scroll style={{ "--delay": "370ms" }}>
            <FontAwesomeIcon icon={faBriefcase} />
            <h4>Services</h4>
            <p>Consulting and client-facing operations</p>
          </div>
        </div>
      </section>

      <section className="page testimonials-quick-section">
        <div className="section-header reveal" data-scroll>
          <p className="eyebrow">Common Requests</p>
          <h2>What teams usually ask us to fix first.</h2>
        </div>

        <div className="testimonials-quick-grid">
          <div className="testimonial-quick reveal" data-scroll style={{ "--delay": "120ms" }}>
            <p>"We need one dashboard so all branches report the same numbers."</p>
            <div className="testimonial-author">
              <strong>Common retail request</strong>
              <span>Planning calls</span>
            </div>
          </div>

          <div className="testimonial-quick reveal" data-scroll style={{ "--delay": "180ms" }}>
            <p>"Delivery updates and payments should be visible in one place."</p>
            <div className="testimonial-author">
              <strong>Common distribution request</strong>
              <span>Planning calls</span>
            </div>
          </div>

          <div className="testimonial-quick reveal" data-scroll style={{ "--delay": "240ms" }}>
            <p>"We want bookings, stock, and team schedules connected before peak season."</p>
            <div className="testimonial-author">
              <strong>Common events request</strong>
              <span>Planning calls</span>
            </div>
          </div>
        </div>
      </section>

      <section className="page cta reveal" data-scroll>
        <div className="cta-content">
          <h2>Need a plan tailored to your business?</h2>
          <p className="lead">
            We can map how your team works today and turn one of these sample
            plans into a rollout plan for you.
          </p>
        </div>
        <div className="cta-actions">
          <PrimaryButton to="/contact">Start Your Plan</PrimaryButton>
          <Link className="button button-ghost" to="/configure">
            Build Your System
          </Link>
        </div>
      </section>

      <WhatsApp />
    </section>
  );
}
