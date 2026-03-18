import React, { useEffect, useState } from 'react';
import "./Footer.css";
import { Link, useNavigate } from 'react-router-dom';
import { Call, Location, Sms } from 'iconsax-react';
import { SUPPORTED_CURRENCIES } from '../CurrencyContext/CurrencyContext';
import { useCart } from '../CartContext/CartContext';
import {
  IoLogoFacebook,
  IoLogoInstagram,
  IoLogoTiktok,
  IoLogoWhatsapp,
  IoArrowForward,
} from 'react-icons/io5';
import {
  clearExpiringDraft,
  loadExpiringDraft,
  saveExpiringDraft,
} from '/src/utils/formDrafts';

const MENU_LINKS = [
  { to: '/', label: 'Home' },
  { to: '/about', label: 'About Us' },
  { to: '/rentals', label: 'Rentals' },
  { to: '/shop', label: 'Shop' },
  { to: '/book', label: 'Book a party' },
  { to: '/contact', label: 'Contact' },
];

const ACCOUNT_LINKS = [
  { to: '/login', label: 'Staff login' },
  { to: '/customer-login', label: 'Customer login' },
  { to: '/book', label: 'Booking portal' },
  { to: '/checkout', label: 'Checkout' },
];

const COMPANY_LINKS = [
  { to: '/faq', label: 'FAQ' },
  { to: '/refund-policy', label: 'Refund policy' },
  { to: '/delivery-policy', label: 'Delivery policy' },
  { to: '/privacy-policy', label: 'Privacy policy' },
  { to: '/terms-of-service', label: 'Terms of service' },
];

const FOOTER_PROMO_DRAFT_KEY = "footerPromoDraft";

function Footer() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const { currency, rates } = useCart();

  useEffect(() => {
    const savedDraft = loadExpiringDraft(FOOTER_PROMO_DRAFT_KEY);
    if (typeof savedDraft === "string") {
      setEmail(savedDraft);
    }
  }, []);

  useEffect(() => {
    const normalizedEmail = email.trim();
    if (!normalizedEmail) {
      clearExpiringDraft(FOOTER_PROMO_DRAFT_KEY);
      return;
    }
    saveExpiringDraft(FOOTER_PROMO_DRAFT_KEY, normalizedEmail);
  }, [email]);

  const rateFormatter = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 3,
  });

  const conversionRows = SUPPORTED_CURRENCIES
    .filter((code) => code !== 'GHS')
    .map((code) => ({
      code,
      rate: rateFormatter.format(1 / Math.max(Number(rates?.[code] || 0), Number.EPSILON)),
      isActive: code === currency,
    }));

  const handlePromoSubmit = (event) => {
    event.preventDefault();
    const leadEmail = email.trim();
    clearExpiringDraft(FOOTER_PROMO_DRAFT_KEY);
    navigate('/contact', {
      state: leadEmail ? { leadEmail } : undefined,
    });
  };

  return (
    <footer className="site-footer" aria-labelledby="footer-heading">
      <h2 id="footer-heading" className="sr-only">Site footer</h2>

      <section
        className="footer-promo"
        aria-label="Plan your party with REEBS"
        data-no-reveal="true"
      >
        <div className="footer-promo-content">
          <p className="footer-promo-kicker">Plan your next celebration</p>
          <h3>Bring your party vision to life with REEBS.</h3>
          <form className="footer-promo-form" onSubmit={handlePromoSubmit}>
            <label htmlFor="footer-email" className="sr-only">Email address</label>
            <input
              id="footer-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="Email address"
              aria-label="Email address"
            />
            <button type="submit">
              <span>Book your party</span>
              <IoArrowForward aria-hidden="true" />
            </button>
          </form>
        </div>
      </section>

      <div className="footer-main">
        <div className="footer-brand">
          <Link className="footer-logo" to="/">
            <img
              src="/imgs/brand/reebs_logo2.svg"
              alt="REEBS Logo"
              width="176"
              height="96"
              loading="lazy"
              decoding="async"
            />
          </Link>
        </div>

        <div className="footer-right">
          <div className="footer-columns">
            <nav className="footer-column" aria-label="Main links">
              <h3>Menu</h3>
              {MENU_LINKS.map((link) => (
                <Link key={link.to} to={link.to} className="footer-link">
                  {link.label}
                </Link>
              ))}
            </nav>

            <nav className="footer-column" aria-label="Account links">
              <h3>Accounts</h3>
              {ACCOUNT_LINKS.map((link) => (
                <Link key={link.to} to={link.to} className="footer-link">
                  {link.label}
                </Link>
              ))}
            </nav>

            <nav className="footer-column" aria-label="Company links">
              <h3>Company</h3>
              {COMPANY_LINKS.map((link) => (
                <Link key={link.to} to={link.to} className="footer-link">
                  {link.label}
                </Link>
              ))}
            </nav>

            <div className="footer-column" aria-label="Social links">
              <h3>Social</h3>
              <a
                href="https://www.facebook.com/reebspartythemes"
                target="_blank"
                rel="noreferrer"
                className="footer-link footer-social-link"
              >
                <IoLogoFacebook />
                <span>Facebook</span>
              </a>
              <a
                href="https://www.instagram.com/reebspartythemes_/"
                target="_blank"
                rel="noreferrer"
                className="footer-link footer-social-link"
              >
                <IoLogoInstagram />
                <span>Instagram</span>
              </a>
              <a
                href="https://www.tiktok.com/@reebspartythemes_"
                target="_blank"
                rel="noreferrer"
                className="footer-link footer-social-link"
              >
                <IoLogoTiktok />
                <span>TikTok</span>
              </a>
              <a
                href="https://wa.me/233244238419"
                target="_blank"
                rel="noopener noreferrer"
                className="footer-link footer-social-link"
              >
                <IoLogoWhatsapp />
                <span>WhatsApp</span>
              </a>
            </div>
          </div>

          <div className="footer-contact-list footer-contact-under">
            <a href="https://maps.app.goo.gl/ykfi2iVEBfEneTx16" target="_blank" rel="noreferrer">
              <Location size="18" variant="Linear" />
              <span>Sakumono Broadway, Tema, Ghana</span>
            </a>
            <a href="tel:+233244238419">
              <Call size="18" variant="Linear" />
              <span>+233 24 423 8419</span>
            </a>
            <a href="mailto:info@reebspartythemes.com">
              <Sms size="18" variant="Linear" />
              <span>info@reebspartythemes.com</span>
            </a>
            <p className="footer-hours">Open Monday to Saturday | 8:30am - 7:00pm</p>
          </div>
        </div>
      </div>

      <section className="footer-rates" aria-labelledby="footer-rates-heading">
        <div className="footer-rates-head">
          <div>
            <h3 id="footer-rates-heading">Currency Conversion</h3>
          </div>
          <span className="footer-rates-active">Active: {currency}</span>
        </div>

        <div className="footer-rates-row" role="list" aria-label="Currency conversion rates">
          {conversionRows.map((row) => (
            <div
              key={row.code}
              className={`footer-rate-pill ${row.isActive ? 'is-active' : ''}`.trim()}
              role="listitem"
            >
              <span className="footer-rate-base">1 {row.code}</span>
              <span className="footer-rate-equals">=</span>
              <strong className="footer-rate-value">{row.rate}</strong>
              <span className="footer-rate-code">GHS</span>
            </div>
          ))}
        </div>
      </section>

      <div className="footer-bottom">
        <span>&copy; {new Date().getFullYear()} REEBS Party Themes. All rights reserved.</span>
        <span>Made to matter. Made By Nana.</span>
        <span>Powered By Faako <img src='/imgs/icons/logo2-white.svg' alt="Faako Logo"/></span>
      </div>
    </footer>
  );
}

export default Footer;
