import { Link } from "react-router-dom";
import { AppBottomBar } from "@faako/ui";
import FooterLanguagePicker from "./FooterLanguagePicker.jsx";
import { moduleShowcaseItems } from "../data/modules.js";

export default function Footer({ footerLogo }) {
  const featuredModules = moduleShowcaseItems.slice(0, 4);

  return (
    <footer className="site-footer">
      <div className="site-footer-shell">
        <div className="footer-cta-row">
          <div className="footer-brand">
            <div className="logo footer-logo">
              <img src={footerLogo} alt="Faako logo" loading="lazy" />
            </div>
            <p className="footer-kicker">Ready to simplify operations?</p>
            <h2>Let's work together.</h2>
            <small>From onboarding to daily reporting, we help teams run from one system.</small>
          </div>
          <Link className="footer-cta-button" to="/contact">
            Start a Free Conversation
          </Link>
        </div>

        <div className="footer-links-grid">
          <div className="footer-links">
            <span className="footer-title">Product</span>
            <Link to="/solutions">Solutions</Link>
            <Link to="/pricing">Pricing</Link>
            <Link to="/configure">Project Blueprint</Link>
            <Link to="/dashboard">Dashboard</Link>
          </div>

          <div className="footer-links">
            <span className="footer-title">Modules</span>
            {featuredModules.map((module) => (
              <Link key={module.id} to={`/modules/${module.id}`}>
                {module.title}
              </Link>
            ))}
            <Link className="footer-more-link" to="/solutions#modules">
              All Modules
            </Link>
          </div>

          <div className="footer-links">
            <span className="footer-title">Company</span>
            <Link to="/about">About</Link>
            <Link to="/case-studies">Use Cases</Link>
            <Link to="/contact">Contact</Link>
            <Link to="/signup">Get Started</Link>
          </div>

          <div className="footer-links footer-language">
            <span className="footer-title">Language</span>
            <FooterLanguagePicker />
          </div>
        </div>

        <div className="footer-trust-row">
          <div className="footer-trust-badges" aria-label="Faako operating principles">
            <span className="footer-badge">Built in Ghana</span>
            <span className="footer-badge">Local Team Support</span>
            <span className="footer-badge">Privacy-First Workflows</span>
          </div>
          <span className="footer-address">Accra, Ghana</span>
        </div>

        <div className="footer-bottom">
          <div className="footer-legal-links">
            <Link to="/privacy">Privacy Policy</Link>
            <Link to="/terms">Terms of Service</Link>
          </div>
        </div>
        <AppBottomBar variant="footer" />
      </div>
    </footer>
  );
}
