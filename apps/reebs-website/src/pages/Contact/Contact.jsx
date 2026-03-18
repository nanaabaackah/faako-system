import React from 'react';
import "./Contact.css";
import CookieBanner from '/src/components/CookieBanner/CookieBanner';
import Map from '/src/components/Map/Map';
import { Link } from 'react-router-dom';
import ContactForm from '/src/components/ContactForm/ContactForm';
import { AppIcon } from '/src/components/Icon/Icon';
import { faEnvelope, faPhone, faLocationDot, faClock } from '/src/icons/iconSet';
import { faWhatsapp, faFacebook, faInstagram, faTiktok } from '/src/icons/iconSet';

const CONTACT_PHONE_LABEL = '+233 24 423 8419';
const CONTACT_PHONE_HREF = 'tel:+233244238419';
const CONTACT_EMAIL = 'info@reebspartythemes.com';
const CONTACT_WHATSAPP_URL = 'https://wa.me/233244238419';
const CONTACT_MAP_URL = 'https://maps.app.goo.gl/ykfi2iVEBfEneTx16';

const CONTACT_HERO_CHIPS = [
    'Same-day delivery options',
    'Custom themes',
    'Friendly, fast replies'
];

const CONTACT_HERO_META = [
    { icon: faClock, text: '8:30am – 7pm (Mon–Sat)' },
    { icon: faLocationDot, text: 'Sakumono Broadway, Tema' }
];

const CONTACT_STUDIO_HOURS = [
    { label: 'Weekdays', value: '8:30am – 7pm' },
    { label: 'Saturday', value: '8:30am – 7pm' }
];

const CONTACT_SOCIAL_LINKS = [
    {
        href: 'https://www.facebook.com/reebspartythemes',
        label: 'Facebook',
        icon: faFacebook
    },
    {
        href: 'https://www.instagram.com/reebspartythemes_/',
        label: 'Instagram',
        icon: faInstagram
    },
    {
        href: 'https://www.tiktok.com/@reebspartythemes_',
        label: 'TikTok',
        icon: faTiktok
    }
];

function Contact() {
    return (
        <div className="contact-page">
            <a href="#main" className="skip-link">Skip to main content</a>
            <CookieBanner />
            <main className="contact-shell page-shell" id="main" role="main">
                <section className="contact-hero page-hero" aria-labelledby="contact-hero-heading">
                    <div className="contact-hero-grid">
                        <div className="contact-hero-copy page-hero-copy">
                            <p className="kicker">Let's plan your party</p>
                            <h1 id="contact-hero-heading" className="page-hero-title">Contact REEBS</h1>
                            <p className="hero-sub">
                                We’ll help with rentals, decor, or a full setup plan. Reach out and we’ll get you a
                                clear game plan fast.
                            </p>
                            <div className="contact-chips" aria-label="Quick highlights">
                                {CONTACT_HERO_CHIPS.map((item) => (
                                    <span key={item}>{item}</span>
                                ))}
                            </div>
                            <div className="contact-actions" role="group" aria-label="Ways to reach us">
                                <a className="hero-btn hero-btn-primary" href={CONTACT_PHONE_HREF}>
                                    <AppIcon icon={faPhone} /> Call us
                                </a>
                                <a
                                    className="hero-btn hero-btn-ghost"
                                    href={CONTACT_WHATSAPP_URL}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    <AppIcon icon={faWhatsapp} /> WhatsApp
                                </a>
                                <Link className="hero-btn hero-btn-link" to="/rentals">
                                    Plan my setup
                                </Link>
                            </div>
                            <div className="contact-meta">
                                {CONTACT_HERO_META.map((item) => (
                                    <span key={item.text}>
                                        <AppIcon icon={item.icon} /> {item.text}
                                    </span>
                                ))}
                            </div>
                        </div>
                        <div className="contact-hero-card" aria-label="Studio details">
                            <div className="contact-card-header">
                                <AppIcon icon={faLocationDot} />
                                <div>
                                    <p className="kicker">Visit or pickup</p>
                                    <h2>Swing by our store</h2>
                                </div>
                            </div>
                            <p className="contact-hero-lede">
                                Stop by in person, grab balloons, or chat through ideas with our team.
                            </p>
                            <div className="contact-card-actions">
                                <a href={CONTACT_MAP_URL} target="_blank" rel="noopener noreferrer" className="hero-btn hero-btn-ghost">
                                    Open in Maps
                                </a>
                                <a href={`mailto:${CONTACT_EMAIL}`} className="hero-btn hero-btn-link">
                                    {CONTACT_EMAIL}
                                </a>
                            </div>
                            <div className="contact-hours">
                                {CONTACT_STUDIO_HOURS.map((item) => (
                                    <div key={item.label}>
                                        <span>{item.label}</span>
                                        <strong>{item.value}</strong>
                                    </div>
                                ))}
                                <p className="contact-hours-note">
                                    We alternate some Mondays—call ahead to confirm. Holiday hours may vary.
                                </p>
                            </div>
                        </div>
                    </div>
                </section>

                <section className="contact-info-grid" aria-label="Stay connected">
                    <article className="contact-card">
                        <div className="contact-card-header">
                            <AppIcon icon={faPhone} />
                            <h3>Talk to someone</h3>
                        </div>
                        <p>Need quick answers on availability or pricing? Call or text and we’ll confirm details right away.</p>
                        <div className="contact-links">
                            <a href={CONTACT_PHONE_HREF}>{CONTACT_PHONE_LABEL}</a>
                            <a href={CONTACT_WHATSAPP_URL} target="_blank" rel="noopener noreferrer">Message on WhatsApp</a>
                        </div>
                    </article>
                    <article className="contact-card">
                        <div className="contact-card-header">
                            <AppIcon icon={faEnvelope} />
                            <h3>Send a brief</h3>
                        </div>
                        <p>Share your theme, date, guest count, and budget. We’ll reply within one business day with options.</p>
                        <div className="contact-links">
                            <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
                            <Link to="/faq">View FAQs</Link>
                        </div>
                    </article>
                    <article className="contact-card">
                        <div className="contact-card-header">
                            <AppIcon icon={faFacebook} />
                            <h3>Follow along</h3>
                        </div>
                        <p>See new setups, balloons, and party inspo from events across Ghana.</p>
                        <div className="contact-socials">
                            {CONTACT_SOCIAL_LINKS.map((item) => (
                                <a
                                    href={item.href}
                                    key={item.label}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    aria-label={item.label}
                                >
                                    <AppIcon icon={item.icon} />
                                </a>
                            ))}
                        </div>
                    </article>
                </section>

                <section className="contact-panels" aria-label="Send a message or find us">
                    <article className="contact-card contact-form-card">
                        <div className="contact-card-header">
                            <p className="kicker">Tell us about your event</p>
                            <h3>Send a message</h3>
                        </div>
                        <p className="contact-card-intro">
                            We’ll confirm availability, pricing, and next steps within one business day.
                        </p>
                        <ContactForm />
                    </article>
                    <article className="contact-card contact-map-card">
                        <div className="contact-card-header">
                            <p className="kicker">Find us</p>
                            <h3>Map & directions</h3>
                        </div>
                        <div className="map-wrapper">
                            <Map />
                        </div>
                        <div className="contact-card-intro">
                            <p>Use “Get Directions” on the map for a quick route from your location.</p>
                        </div>
                    </article>
                </section>
            </main>
        </div>
    );
}

export default Contact;
