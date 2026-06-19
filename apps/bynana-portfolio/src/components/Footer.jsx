import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AppBottomBar } from '@faako/ui';
import { Link } from 'react-router-dom';
import '../styles/components/Footer.css';

const footerLinks = [
  { href: '/', label: 'Home' },
  { href: '/projects', label: 'Projects' },
  { href: '/about', label: 'About' },
  { href: '/contact', label: 'Contact' },
  { href: '/privacy', label: 'Privacy & Cookies' },
  { href: 'https://dev.nanaabaackah.com/book', label: 'Book', external: true },
];

const socialLinks = [
  {
    href: 'mailto:nanaabaackah@gmail.com',
    label: 'Email',
    external: false,
  },
  {
    href: 'https://www.linkedin.com/in/nana-aba-ackah/',
    label: 'Linkedin',
  },
  {
    href: 'https://github.com/nanaabaackah/',
    label: 'Github',
  },
];

const CONTACT_EMAIL = 'nanaabaackah@gmail.com';
const CONTACT_PHONE_LABEL = '+1 (647) 916-2361 || +233 554 024-694';
const CONTACT_PHONE_HREF = 'tel:+16479162361';

function Footer() {
  const year = new Date().getFullYear();
  const [now, setNow] = useState(() => new Date());
  const footerRef = useRef(null);

  useEffect(() => {
    const timerId = window.setInterval(() => {
      setNow(new Date());
    }, 60000);

    return () => window.clearInterval(timerId);
  }, []);

  useEffect(() => {
    const footerElement = footerRef.current;
    if (!footerElement) return undefined;

    const applyRevealHeight = () => {
      const nextHeight = Math.ceil(footerElement.getBoundingClientRect().height);
      document.documentElement.style.setProperty('--footer-reveal-height', `${nextHeight}px`);
    };

    applyRevealHeight();

    const resizeObserver =
      typeof ResizeObserver === 'function' ? new ResizeObserver(() => applyRevealHeight()) : null;
    resizeObserver?.observe(footerElement);
    window.addEventListener('resize', applyRevealHeight);

    return () => {
      window.removeEventListener('resize', applyRevealHeight);
      resizeObserver?.disconnect();
    };
  }, []);

  const localTimeLabel = useMemo(() => {
    const timeLabel = new Intl.DateTimeFormat(undefined, {
      hour: 'numeric',
      minute: '2-digit',
    }).format(now);

    const offsetMinutes = -now.getTimezoneOffset();
    const sign = offsetMinutes >= 0 ? '+' : '-';
    const absoluteOffset = Math.abs(offsetMinutes);
    const offsetHours = Math.floor(absoluteOffset / 60);
    const offsetRemainder = absoluteOffset % 60;

    const offsetLabel =
      offsetRemainder === 0
        ? `UTC${sign}${offsetHours}`
        : `UTC${sign}${String(offsetHours).padStart(2, '0')}:${String(offsetRemainder).padStart(2, '0')}`;

    return `${timeLabel} ${offsetLabel}`;
  }, [now]);

  return (
    <footer ref={footerRef} id="site-footer" className="site-footer">
      <div className="site-footer__shell">
        <div className="site-footer__grid">
          <div className="site-footer__columns" data-scroll-reveal="fadeInUp">
            <section className="site-footer__column" aria-label="Footer links">
              <h2>Links</h2>
              <ul>
                {footerLinks.map(({ href, label, external = false }) => (
                  <li key={href}>
                    {external ? (
                      <a href={href} target="_blank" rel="noreferrer noopener">
                        {label}
                      </a>
                    ) : (
                      <Link to={href}>{label}</Link>
                    )}
                  </li>
                ))}
              </ul>
            </section>

            <section className="site-footer__column" aria-label="Social links">
              <h2>Socials</h2>
              <ul>
                {socialLinks.map(({ href, label, external = true }) => (
                  <li key={label}>
                    <a
                      href={href}
                      target={external ? '_blank' : undefined}
                      rel={external ? 'noreferrer noopener' : undefined}
                    >
                      {label}
                    </a>
                  </li>
                ))}
              </ul>
            </section>

            <section className="site-footer__column" aria-label="Local time">
              <h2>Local Time</h2>
              <p>{localTimeLabel}</p>
            </section>

            <section className="site-footer__column" aria-label="Version">
              <h2>Version</h2>
              <p>{year} © Edition</p>
            </section>
          </div>

          <div className="site-footer__contact" data-scroll-reveal="fadeInUp">
            <a className="site-footer__pill" href={CONTACT_PHONE_HREF}>
              {CONTACT_PHONE_LABEL}
            </a>
            <a className="site-footer__pill" href={`mailto:${CONTACT_EMAIL}`}>
              {CONTACT_EMAIL}
            </a>
          </div>
        </div>
      </div>
      <div className="site-footer__brand" data-scroll-reveal="fadeInUp">
        <img
          className="site-footer__logo-mark"
          src="/assets/bn-long-white.svg"
          alt="By Nana logo"
          loading="lazy"
        />
        <p className="site-footer__copyright">© {year} MADE TO MATTER. MADE BY NANA</p>
      </div>
      <div className="site-footer__shell site-footer__shell--bottom-bar" data-scroll-reveal="fadeInUp">
        <AppBottomBar variant="footer" />
      </div>
    </footer>
  );
}

export default Footer;
