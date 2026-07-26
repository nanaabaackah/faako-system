import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { DocumentDownload } from 'iconsax-react';
import { SiGithub, SiGmail } from 'react-icons/si';
import { BsLinkedin } from 'react-icons/bs';

import '../styles/components/SideRails.css';

const RESUME_PDF = '/documents/Nana Aba Ackah Resume.pdf';

const SOCIAL_LINKS = [
  {
    href: 'https://www.linkedin.com/in/nana-aba-ackah/',
    label: 'LinkedIn',
    icon: BsLinkedin,
  },
  {
    href: 'mailto:nanaabaackah@gmail.com',
    label: 'Email',
    icon: SiGmail,
    external: false,
  },
  {
    href: 'https://github.com/nanaabaackah/',
    label: 'GitHub',
    icon: SiGithub,
  },
];

function SideRails({ lightStyle = false }) {
  const [stopTop, setStopTop] = useState(null);

  useEffect(() => {
    const footer = document.getElementById('site-footer');
    if (!footer) return undefined;

    const updateStopState = () => {
      if (window.matchMedia('(max-width: 720px)').matches) {
        setStopTop(null);
        return;
      }

      const revealHeightVar = getComputedStyle(document.documentElement)
        .getPropertyValue('--footer-reveal-height')
        .trim();
      const revealHeight = Number.parseFloat(revealHeightVar) || footer.offsetHeight || 0;
      const maxScrollY = Math.max(
        0,
        document.documentElement.scrollHeight - window.innerHeight,
      );
      const boundaryTop = Math.max(0, maxScrollY - revealHeight);

      if (boundaryTop > 0 && window.scrollY >= boundaryTop) {
        setStopTop(boundaryTop);
        return;
      }

      setStopTop(null);
    };

    updateStopState();
    window.addEventListener('scroll', updateStopState, { passive: true });
    window.addEventListener('resize', updateStopState);

    return () => {
      window.removeEventListener('scroll', updateStopState);
      window.removeEventListener('resize', updateStopState);
    };
  }, []);

  const sideRailStyle = useMemo(() => {
    if (stopTop === null) return undefined;

    return {
      position: 'absolute',
      top: `${stopTop}px`,
      left: 0,
      right: 0,
      height: '100vh',
    };
  }, [stopTop]);

  const handleScrollTop = useCallback(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const handleScrollToFooter = useCallback(() => {
    const footer = document.getElementById('site-footer') ?? document.querySelector('.site-footer');

    if (footer) {
      footer.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }

    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
  }, []);

  const sideRailClassNames = ['site-side-rails'];
  if (stopTop !== null) sideRailClassNames.push('is-stopped');
  if (lightStyle) sideRailClassNames.push('is-light-section');

  return (
    <div className={sideRailClassNames.join(' ')} style={sideRailStyle}>
      <aside className="site-side-rails__left" aria-label="Side controls">
        <div className="site-side-rails__scroll">
          <button
            type="button"
            className="site-side-rails__button"
            onClick={handleScrollTop}
            aria-label="Scroll to top"
          >
            <span className="site-side-rails__dot" aria-hidden="true" />
          </button>

          <span className="site-side-rails__line" aria-hidden="true" />

          <button
            type="button"
            className="site-side-rails__button"
            onClick={handleScrollToFooter}
            aria-label="Scroll to footer"
          >
            <span className="site-side-rails__dot" aria-hidden="true" />
          </button>
        </div>

        <div className="site-side-rails__social" aria-label="Social media links">
          {SOCIAL_LINKS.map(({ href, label, icon, external = true }) => (
            <a
              key={label}
              href={href}
              className="site-side-rails__social-link"
              target={external ? '_blank' : undefined}
              rel={external ? 'noreferrer noopener' : undefined}
              aria-label={label}
            >
              {React.createElement(icon, { size: 18, 'aria-hidden': 'true' })}
              <span className="sr-only">{label}</span>
            </a>
          ))}
        </div>
      </aside>

      <a
        className="site-side-rails__resume-tab"
        href={RESUME_PDF}
        target="_blank"
        rel="noreferrer noopener"
        aria-label="Open resume PDF"
      >
        <DocumentDownload size={16} variant="Bold" aria-hidden="true" />
        <span className="site-side-rails__resume-label">Resume</span>
      </a>
    </div>
  );
}

export default SideRails;
