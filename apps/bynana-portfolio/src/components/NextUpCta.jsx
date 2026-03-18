import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { HiArrowUp } from 'react-icons/hi2';
import '../styles/components/NextUpCta.css';

function NextUpCtaImage({ src, alt, className = '', placeholderLabel = 'Add image here' }) {
  const [hasError, setHasError] = useState(false);
  const showPlaceholder = !src || hasError;

  return (
    <div className={`next-up-cta-image ${className}`.trim()}>
      {showPlaceholder ? (
        <div className="next-up-cta-image__placeholder">
          <div>
            <strong>{placeholderLabel}</strong>
            <span>Placeholder for your visual asset</span>
          </div>
        </div>
      ) : (
        <img src={src} alt={alt} loading="lazy" onError={() => setHasError(true)} />
      )}
    </div>
  );
}

function NextUpCta({
  eyebrow = 'Next',
  title,
  href,
  imageSrc,
  imageAlt,
  placeholderLabel = 'Add next image',
  leftLabel = '',
  rightLabel = '',
  className = '',
}) {
  if (!title || !href) return null;

  const handleScrollToTop = () => {
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <section className={`next-up-cta ${className}`.trim()} data-scroll-reveal="fadeInUp">
      <p className="next-up-cta__eyebrow">{eyebrow}</p>
      <h2 className="next-up-cta__title">{title}</h2>

      <Link className="next-up-cta__visual-link" to={href}>
        <div className="next-up-cta__visual">
          <NextUpCtaImage
            src={imageSrc}
            alt={imageAlt || `${title} preview`}
            className="next-up-cta__image"
            placeholderLabel={placeholderLabel}
          />
          <div className="next-up-cta__hover-frame" aria-hidden="true">
            <NextUpCtaImage
              src={imageSrc}
              alt=""
              className="next-up-cta__hover-image-wrap"
              placeholderLabel={placeholderLabel}
            />
          </div>
        </div>
      </Link>

      <div className="next-up-cta__meta">
        <p className="next-up-cta__left">{leftLabel}</p>
        <button
          className="next-up-cta__up"
          type="button"
          onClick={handleScrollToTop}
          aria-label="Scroll to top"
        >
          <HiArrowUp size={26} aria-hidden="true" />
        </button>
        <p className="next-up-cta__right">{rightLabel}</p>
      </div>
    </section>
  );
}

export default NextUpCta;
