import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Refresh } from 'iconsax-react';
import { HiArrowRight } from 'react-icons/hi2';
import Seo from '../components/Seo';
import FuzzyText from '../components/FuzzyText';
import '../styles/pages/Error.css';

const quickLinks = [
  { to: '/about', label: 'About' },
  { to: '/projects', label: 'Projects' },
  { to: '/blog', label: 'Blog' },
  { to: '/contact', label: 'Contact' },
];

function AnimatedLine({ as = 'span', className = '', children }) {
  return (
    <FuzzyText
      as={as}
      className={className}
      baseFrequency={0.0048}
      hoverFrequency={0.013}
      baseScale={5}
      hoverScale={12}
    >
      {children}
    </FuzzyText>
  );
}

function ErrorPage({ variant = 'error', error, onReset }) {
  const location = useLocation();
  const isNotFound = variant === 'not-found';
  const title = isNotFound ? 'Page Not Found' : 'Something Went Wrong';
  const message = isNotFound
    ? 'The page you are looking for does not exist or may have moved.'
    : 'An unexpected error occurred. You can refresh, head back home, or start with a different section.';
  const detail = error?.message;

  const handleRetry = () => {
    if (onReset) {
      onReset();
      return;
    }
    window.location.reload();
  };

  return (
    <main id="main-content" tabIndex="-1" className="error-case">
      <Seo
        title={isNotFound ? '404 | By Nana' : 'Error | By Nana'}
        description="An error occurred while loading this page."
        path={location?.pathname || '/'}
        type="website"
      />

      <section className="error-shell" data-scroll-reveal="fadeInUp">
        <p className="error-code-mark" aria-hidden="true">
          <AnimatedLine>{isNotFound ? '404' : 'ERROR'}</AnimatedLine>
        </p>

        <header className="error-hero">
          <div className="error-hero__copy">
            <p className="error-eyebrow">
              <AnimatedLine>{isNotFound ? '404' : 'Error'}</AnimatedLine>
            </p>
            <h1 className="error-title">
              <AnimatedLine>{title}</AnimatedLine>
            </h1>
            <p className="error-hero__summary">
              <AnimatedLine>{message}</AnimatedLine>
            </p>

            {!isNotFound && detail ? (
              <div className="error-card error-card--soft">
                <p className="error-card__eyebrow">
                  <AnimatedLine>Details</AnimatedLine>
                </p>
                <p>
                  <AnimatedLine>{detail}</AnimatedLine>
                </p>
              </div>
            ) : null}

            {location?.pathname ? (
              <p className="error-path">
                <AnimatedLine>Path:</AnimatedLine> <code>{location.pathname}</code>
              </p>
            ) : null}

            <div className="error-actions">
              <Link className="error-button error-button--primary" to="/">
                <AnimatedLine>Back to home</AnimatedLine>
              </Link>
              <Link className="error-button error-button--ghost" to="/projects">
                <AnimatedLine>View projects</AnimatedLine>
              </Link>
              {!isNotFound ? (
                <button type="button" className="error-button error-button--ghost" onClick={handleRetry}>
                  <AnimatedLine>Try again</AnimatedLine> <Refresh size={16} variant="Bold" aria-hidden="true" />
                </button>
              ) : null}
              <a
                className="error-button error-button--ghost"
                href="https://dev.nanaabaackah.com/book"
                target="_blank"
                rel="noreferrer noopener"
              >
                <AnimatedLine>Book a working session</AnimatedLine> <HiArrowRight size={16} aria-hidden="true" />
              </a>
            </div>
          </div>

          <aside className="error-hero__panel">
            <div className="error-card">
              <p className="error-card__eyebrow">
                <AnimatedLine>What you can do</AnimatedLine>
              </p>
              <ul className="error-list">
                <li>
                  <AnimatedLine>Check the URL for typos or extra characters.</AnimatedLine>
                </li>
                <li>
                  <AnimatedLine>Visit the projects page to pick a new case study.</AnimatedLine>
                </li>
                <li>
                  <AnimatedLine>Use the booking link if you want help right away.</AnimatedLine>
                </li>
              </ul>
            </div>
            <div className="error-card error-card--soft">
              <p className="error-card__eyebrow">
                <AnimatedLine>Quick links</AnimatedLine>
              </p>
              <div className="error-link-grid">
                {quickLinks.map((item) => (
                  <Link key={item.to} to={item.to}>
                    <AnimatedLine>{item.label}</AnimatedLine>
                  </Link>
                ))}
              </div>
            </div>
          </aside>
        </header>
      </section>
    </main>
  );
}

export default ErrorPage;
