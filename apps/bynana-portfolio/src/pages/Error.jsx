import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Refresh } from 'iconsax-react';
import { HiArrowRight } from 'react-icons/hi2';
import Seo from '../components/Seo';
import '../styles/pages/Error.css';

const quickLinks = [
  { to: '/projects', label: 'Projects', meta: 'case studies' },
  { to: '/about', label: 'About', meta: 'story' },
  { to: '/blog', label: 'Blog', meta: 'notes' },
  { to: '/contact', label: 'Contact', meta: 'start here' },
];

function ErrorPage({ variant = 'error', error, onReset }) {
  const location = useLocation();
  const isNotFound = variant === 'not-found';
  const statusCode = isNotFound ? '404' : '500';
  const title = isNotFound ? 'This page slipped out of frame.' : 'The page hit a snag.';
  const message = isNotFound
    ? 'The route is missing, moved, or still waiting to become real. Let’s get you back to something useful.'
    : 'Something interrupted the view. Refresh the page or jump back into the portfolio from a known section.';
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
        description="The requested By Nana portfolio page could not be loaded."
        path={location?.pathname || '/'}
        type="website"
        noIndex
      />

      <section className="error-stage" aria-labelledby="error-title">
        <div className="error-stage__glow" aria-hidden="true" />

        <div className="error-orbit" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>

        <div className="error-mark" aria-hidden="true">
          <span>{statusCode}</span>
        </div>

        <div className="error-copy">
          <p className="error-kicker">Lost route / byNana</p>
          <h1 id="error-title">{title}</h1>
          <p className="error-summary">{message}</p>

          {detail ? (
            <p className="error-detail">
              <span>Detail</span>
              {detail}
            </p>
          ) : null}

          {location?.pathname ? (
            <p className="error-path">
              <span>Requested</span>
              <code>{location.pathname}</code>
            </p>
          ) : null}

          <div className="error-actions" aria-label="Primary error actions">
            <Link className="error-action error-action--primary" to="/">
              <span>Back home</span>
              <HiArrowRight size={17} aria-hidden="true" />
            </Link>

            {!isNotFound ? (
              <button type="button" className="error-action" onClick={handleRetry}>
                <span>Try again</span>
                <Refresh size={16} variant="Bold" aria-hidden="true" />
              </button>
            ) : null}
          </div>
        </div>

        <nav className="error-links" aria-label="Helpful portfolio links">
          {quickLinks.map((item, index) => (
            <Link key={item.to} to={item.to} className="error-link">
              <span className="error-link__index">{String(index + 1).padStart(2, '0')}</span>
              <span className="error-link__label">{item.label}</span>
              <span className="error-link__meta">{item.meta}</span>
              <HiArrowRight className="error-link__arrow" size={17} aria-hidden="true" />
            </Link>
          ))}
        </nav>
      </section>
    </main>
  );
}

export default ErrorPage;
