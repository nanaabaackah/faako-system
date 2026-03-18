import React, { useEffect, useState } from 'react';
import "./About.css";
import CookieBanner from '/src/components/CookieBanner/CookieBanner';
import { Link } from 'react-router-dom';
import { fetchInventoryWithCache, splitInventory } from '/src/utils/inventoryCache';

const formatCount = (value) => (Number.isFinite(value) ? `${value}+` : '…');

const ABOUT_HERO_BADGES = [
    'Ghana-wide delivery',
    'Same-day options',
    'Free planning consult',
    'Kid-friendly crew'
];

const ABOUT_MISSION_BULLETS = [
    'Curated themes and decor that feel fresh every season.',
    'Clear timelines so you always know what happens next.',
    'Flexible options: full setup, partial styling, or DIY kits.'
];

const ABOUT_REACH_TAGS = [
    'Corporate family days',
    'Kid birthdays',
    'School funfairs',
    'Bridal & baby showers'
];

const ABOUT_VALUES = [
    {
        title: 'Playful design with polish',
        copy: 'Modern palettes, curated props, and on-trend styling that still feels warm and family-friendly.'
    },
    {
        title: 'Zero-stress coordination',
        copy: 'We plan logistics, timelines, and vendor handoffs so you can stay present with your guests.'
    },
    {
        title: 'Safety first, always',
        copy: 'Sanitized rentals, kid-safe setups, and trained crew members who care about every detail.'
    },
    {
        title: 'Flexible for every budget',
        copy: 'From DIY party boxes to full-service decor, we tailor packages to what matters most to you.'
    }
];

function About() {
    const [rentalsCount, setRentalsCount] = useState(null);
    const [productsCount, setProductsCount] = useState(null);

    useEffect(() => {
        let isMounted = true;
        const controller = new AbortController();
        const loadCounts = async () => {
            try {
                const { items } = await fetchInventoryWithCache({ signal: controller.signal });
                if (!isMounted) return;
                const { rentals, products } = splitInventory(items);
                setRentalsCount(rentals.length);
                setProductsCount(products.length);
            } catch (err) {
                if (err?.name === "AbortError") return;
                console.error("Error loading counts:", err);
                try {
                    const productsRes = await fetch("/.netlify/functions/inventoryCounts", {
                        signal: controller.signal,
                    });
                    if (!productsRes.ok) {
                        console.error(`Error fetching products: ${productsRes.status}`);
                        return;
                    }
                    const data = await productsRes.json();
                    if (!isMounted) return;
                    const rentals = Number(data?.rentals);
                    const products = Number(data?.products);
                    setRentalsCount(Number.isFinite(rentals) ? rentals : null);
                    setProductsCount(Number.isFinite(products) ? products : null);
                } catch (fallbackErr) {
                    if (fallbackErr?.name !== "AbortError") {
                        console.error("Error loading counts fallback:", fallbackErr);
                    }
                }
            }
        };

        loadCounts();
        return () => {
            isMounted = false;
            controller.abort();
        };
    }, []);

    const ownerImage = '/imgs/photos/owner.png';
    const highlights = [
        { label: 'Rental items', value: formatCount(rentalsCount) },
        { label: 'Shop items', value: formatCount(productsCount) },
        { label: 'Parties styled', value: '2k+' },
        { label: 'Cities served', value: '6+' },
        { label: 'Average response', value: 'under 1 hr' }
    ];

    return (
        <>
            <a href="#main" className="skip-link">Skip to main content</a>
            <CookieBanner />
            <main className="about page-shell" role="main" id="main">
                <section id="r2-intro" className="about-hero page-hero" aria-labelledby="about-heading about-tagline">
                    <div className="about-hero-copy page-hero-copy">
                        <h1 id="about-heading" className="page-hero-title">Sleek setups. <br/>Joyful memories.</h1>
                        <p id="about-tagline" className="about-lede">
                            REEBS Party Themes is your go-to team for playful, design-forward celebrations.
                            We pair modern decor with dependable logistics so you can show up, smile, and soak
                            in every moment.
                        </p>
                        <div className="about-tags" aria-label="What you can expect from us">
                            {ABOUT_HERO_BADGES.map((item) => (
                                <span key={item} className="about-pill">{item}</span>
                            ))}
                        </div>
                        <div className="hero-ctas" aria-label="About page actions">
                            <Link className="hero-btn hero-btn-primary" to="/Rentals">Browse rentals</Link>
                            <Link className="hero-btn hero-btn-ghost" to="/Contact">Plan with us</Link>
                        </div>
                    </div>
                    {/*<div className="about-hero-media">
                        <div className="about-photo">
                            <img
                                src="/imgs/photos/r4_b.png"
                                alt=""
                                loading="lazy"
                            />
                        </div>
                    </div>*/}
                </section>
                <section id='r2-info' className="about-highlights" aria-label="Company highlights">
                    <div className="about-metrics" aria-label="Highlights">
                        <h2>By the numbers</h2>
                        {highlights.map((item) => (
                            <div key={item.label}>
                                <strong>{item.value}</strong>
                                <span>{item.label}</span>
                            </div>
                        ))}
                    </div>
                </section>
                <section id='r2-mto' className="about-mto bees-swoop" >
                    <div className='r2-back-image'>
                        <figure>
                            <img
                                src={ownerImage}
                                alt="Portrait of Sabina Ackah, founder of REEBS Party Themes"
                            />
                            <figcaption className="sr-only">Sabina Ackah, founder of REEBS Party Themes</figcaption>
                        </figure>
                    </div>
                    <div className='r2-mto-back-heading'>
                        <h2>Meet the Owner</h2>
                        <p>
                        Our founder, <strong>Sabina Ackah</strong>, leads every project with creativity,
                        structure, and care. She helps each client turn a party idea into a clear plan
                        with beautiful results.
                        </p>
                    </div>
                </section>
                <section className="home-section about-mission bees-swoop alt2" aria-labelledby="mission-heading">
                    <div className="section-header">
                        <p className="kicker">What drives us</p>
                        <h2 id="mission-heading">Our mission & promise</h2>
                    </div>
                    <div className="about-grid">
                        <div className="about-card glass-card">
                            <h3>Memorable without the mayhem</h3>
                            <p>
                                We design parties that feel intentional and immersive, then back them with
                                punctual delivery, sanitized rentals, and friendly coordinators who keep
                                everything on track.
                            </p>
                            <ul className="about-list">
                                {ABOUT_MISSION_BULLETS.map((item) => (
                                    <li key={item}><span>▪</span><span>{item}</span></li>
                                ))}
                            </ul>
                        </div>
                        <div className="about-card glass-card about-highlight">
                            <h3>Local roots. Wide reach.</h3>
                            <p>
                                We call Ghana home and proudly serve families, schools, and brands across
                                Accra, Kumasi, Cape Coast, Takoradi, and beyond.
                            </p>
                            <div className="about-pill-row">
                                {ABOUT_REACH_TAGS.map((item) => (
                                    <span className="about-pill" key={item}>{item}</span>
                                ))}
                            </div>
                        </div>
                    </div>
                </section>

                <section className="home-section about-values " aria-labelledby="values-heading">
                    <div className="section-header">
                        <p className="kicker">How we show up</p>
                        <h2 id="values-heading">Values you can feel on party day</h2>
                    </div>
                    <ul className="about-values-grid">
                        {ABOUT_VALUES.map((item) => (
                            <li key={item.title} className="about-card glass-card">
                                <h3>{item.title}</h3>
                                <p>{item.copy}</p>
                            </li>
                        ))}
                    </ul>
                </section>

                <section className="home-section about-cta" aria-labelledby="cta-heading">
                    <div className="section-header">
                        <p className="kicker">Ready when you are</p>
                        <h2 id="cta-heading">Let’s make your party effortless</h2>
                        <h3>Tell us the theme, we’ll handle the sparkle.</h3>
                    </div>
                    <div className="cta-actions">
                        <a href="tel:+233244238419" className="cta-chip" aria-label="Call REEBS Party Themes">
                            Call us
                        </a>
                        <a
                            href="https://wa.me/233244238419"
                            className="cta-chip"
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label="Chat with us on WhatsApp"
                        >
                            WhatsApp
                        </a>
                        <a href="mailto:info@reebspartythemes.com" className="cta-chip" aria-label="Email REEBS Party Themes">
                            Email
                        </a>
                    </div>
                </section>
            </main>
        </>
    )
}

export default About;
