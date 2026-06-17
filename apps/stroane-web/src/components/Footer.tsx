import React from "react";
import { Link } from "react-router-dom";
import { FaWhatsapp, FaFacebook, FaInstagram } from "react-icons/fa";
import { AppBottomBar } from "@faako/ui";
import { PORTAL_LOGIN_URL } from "../config/appSurface";
import "../styles/components/Footer.css";

const NAV_COLUMNS = [
  {
    heading: "Company",
    links: [
      { label: "About Us",  to: "/about" },
      { label: "Services",  to: "/services" },
      { label: "Resources", to: "/resources" },
      { label: "Contact",   to: "/contact" },
      { label: "Admin portal", href: PORTAL_LOGIN_URL },
    ],
  },
  {
    heading: "Store",
    links: [
      { label: "Shop All Products",  to: "/shop" },
      { label: "Digital Thermometers", to: "/shop?category=Digital%20Probe%20Thermometers" },
      { label: "Fridge Thermometers", to: "/shop?category=Fridge%20Thermometers" },
      { label: "Food Safety Signage", to: "/shop?category=Food%20Safety%20Posters%20%26%20Signage" },
    ],
  },
  {
    heading: "Legal",
    links: [
      { label: "Terms & Conditions", to: "/terms" },
      { label: "Privacy Policy",     to: "/privacy" },
      { label: "Cookie Policy",      to: "/cookies" },
      { label: "Sitemap",            to: "/sitemap" },
    ],
  },
];

const toSiteUrl = (baseUrl: string | undefined, path: string) =>
  baseUrl ? new URL(path, `${baseUrl.replace(/\/+$/, "")}/`).toString() : path;

const Footer: React.FC<{ externalNavigationBaseUrl?: string }> = ({
  externalNavigationBaseUrl,
}) => {
  return (
    <footer className="site-footer">

      {/* ── CTA ── */}
      <div className="footer__cta">
        <h2 className="footer__cta-heading">
          Ready to make your food<br />business safer?
        </h2>
        <p className="footer__cta-sub">
          Book a 45-minute consultation. We will assess your current setup
          and tell you exactly where to start.
        </p>
        {externalNavigationBaseUrl ? (
          <a href={toSiteUrl(externalNavigationBaseUrl, "/contact")} className="footer__cta-btn">
            Book a Consultation
          </a>
        ) : (
          <Link to="/contact" className="footer__cta-btn">
            Book a Consultation
          </Link>
        )}
      </div>

      {/* ── Divider + Emblem ── */}
      <div className="footer__emblem-row">
        <div className="footer__rule" />
        <img
          src="/assets/logos/Emblem_logo-Monochrome.png"
          alt="Stroane"
          className="footer__emblem"
        />
        <div className="footer__rule" />
      </div>

      {/* ── Links + Social ── */}
      <div className="footer__body">
        <nav className="footer__nav" aria-label="Footer navigation">
          {NAV_COLUMNS.map((col) => (
            <div key={col.heading} className="footer__col">
              <h3 className="footer__col-heading">{col.heading}</h3>
              <ul className="footer__col-links">
                {col.links.map((link) => (
                  <li key={link.label}>
                    {"href" in link ? (
                      <a href={link.href}>{link.label}</a>
                    ) : externalNavigationBaseUrl ? (
                      <a href={toSiteUrl(externalNavigationBaseUrl, link.to)}>{link.label}</a>
                    ) : (
                      <Link to={link.to}>{link.label}</Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        <div className="footer__social">
          <a href="https://wa.me/233555744000" target="_blank" rel="noopener noreferrer" aria-label="WhatsApp" className="footer__social-btn">
            <FaWhatsapp size={20} />
          </a>
          <a href="https://facebook.com/stroane" target="_blank" rel="noopener noreferrer" aria-label="Facebook" className="footer__social-btn">
            <FaFacebook size={20} />
          </a>
          <a href="https://instagram.com/stroane" target="_blank" rel="noopener noreferrer" aria-label="Instagram" className="footer__social-btn">
            <FaInstagram size={20} />
          </a>
        </div>
      </div>

      {/* ── Bottom bar ── */}
      <AppBottomBar variant="footer" />

    </footer>
  );
};

export default Footer;
