import { useEffect, useState } from 'react';
import "./CookieBanner.css";

const CONSENT_COOKIE_NAME = 'reebsCookieConsent_v2';
const PREFS_STORAGE_KEY = 'reebsCookiePrefs';
const CONSENT_MAX_AGE_SECONDS = 150 * 24 * 60 * 60;

const readConsentCookie = () => {
  if (typeof document === 'undefined') return '';
  const prefix = `${CONSENT_COOKIE_NAME}=`;
  const cookiePart = document.cookie
    .split(';')
    .map((entry) => entry.trim())
    .find((entry) => entry.startsWith(prefix));
  return cookiePart ? decodeURIComponent(cookiePart.slice(prefix.length)) : '';
};

const writeConsentCookie = (value) => {
  if (typeof document === 'undefined') return;
  const isSecure = typeof window !== 'undefined' && window.location.protocol === 'https:';
  document.cookie = `${CONSENT_COOKIE_NAME}=${encodeURIComponent(value)}; Max-Age=${CONSENT_MAX_AGE_SECONDS}; Path=/; SameSite=Lax${isSecure ? '; Secure' : ''}`;
};

const CookieBanner = () => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [analyticsAllowed, setAnalyticsAllowed] = useState(true);
  const [marketingAllowed, setMarketingAllowed] = useState(false);

  useEffect(() => {
    const consentValue = readConsentCookie();
    setIsVisible(!consentValue);

    try {
      const savedPrefs = localStorage.getItem(PREFS_STORAGE_KEY);
      if (savedPrefs) {
        const parsed = JSON.parse(savedPrefs);
        setAnalyticsAllowed(Boolean(parsed.analytics));
        setMarketingAllowed(Boolean(parsed.marketing));
      }
    } catch (err) {
      console.warn('Unable to read cookie preferences', err);
    }
  }, []);

  const persistPreferences = (prefs) => {
    try {
      localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify(prefs));
    } catch (err) {
      console.warn('Unable to store cookie preferences', err);
    }

    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('consent', 'update', {
        ad_storage: prefs.marketing ? 'granted' : 'denied',
        analytics_storage: prefs.analytics ? 'granted' : 'denied',
      });
    }
  };

  const closeBanner = () => {
    setIsVisible(false);
    setIsExpanded(false);
  };

  const handleRejectAll = () => {
    setAnalyticsAllowed(false);
    setMarketingAllowed(false);
    persistPreferences({
      necessary: true,
      analytics: false,
      marketing: false,
    });
    writeConsentCookie('rejected');
    closeBanner();
  };

  const handleAcceptAll = () => {
    setAnalyticsAllowed(true);
    setMarketingAllowed(true);
    persistPreferences({
      necessary: true,
      analytics: true,
      marketing: true,
    });
    writeConsentCookie('accepted');
    closeBanner();
  };

  const handleSavePreferences = () => {
    persistPreferences({
      necessary: true,
      analytics: analyticsAllowed,
      marketing: marketingAllowed,
    });
    writeConsentCookie('customized');
    closeBanner();
  };

  if (!isVisible) return null;

  return (
    <aside
      className={`cookie-banner ${isExpanded ? 'is-expanded' : ''}`}
      role="dialog"
      aria-modal="false"
      aria-live="polite"
      aria-label="Cookie settings"
    >
      <div className="cookie-shell">
        <div className="cookie-copy">
          <h3 className="cookie-title">Cookie Settings</h3>
          <p className="cookie-sub">
            We use cookies to enhance your experience, analyze site traffic, and deliver personalized content.
            {' '}
            Read our
            {' '}
            <a href="/privacy-policy" className="cookie-link">Cookie Policy</a>
            .
          </p>
        </div>

        <div className="cookie-actions">
          <button type="button" className="cookie-btn cookie-decline" onClick={handleRejectAll}>
            Reject all
          </button>
          <button
            type="button"
            className="cookie-btn cookie-customize-btn"
            onClick={() => setIsExpanded((open) => !open)}
            aria-expanded={isExpanded}
          >
            Customize
          </button>
          <button type="button" className="cookie-btn cookie-accept" onClick={handleAcceptAll}>
            Accept all
          </button>
        </div>

        <div className={`cookie-preferences ${isExpanded ? 'is-open' : ''}`}>
          <div className="cookie-preference-card is-locked">
            <div>
              <p>Essential</p>
              <small>Required for cart, checkout, and basic site security.</small>
            </div>
            <span className="cookie-chip">Always on</span>
          </div>

          <div className="cookie-preference-card">
            <div>
              <p>Analytics</p>
              <small>Helps us improve pages and performance.</small>
            </div>
            <label className="cookie-switch">
              <input
                type="checkbox"
                checked={analyticsAllowed}
                onChange={(event) => setAnalyticsAllowed(event.target.checked)}
                aria-label="Toggle analytics cookies"
              />
              <span className="cookie-switch-slider" aria-hidden="true" />
            </label>
          </div>

          <div className="cookie-preference-card">
            <div>
              <p>Marketing</p>
              <small>Used for promos and personalized campaigns.</small>
            </div>
            <label className="cookie-switch">
              <input
                type="checkbox"
                checked={marketingAllowed}
                onChange={(event) => setMarketingAllowed(event.target.checked)}
                aria-label="Toggle marketing cookies"
              />
              <span className="cookie-switch-slider" aria-hidden="true" />
            </label>
          </div>

          <div className="cookie-preferences-actions">
            <button type="button" className="cookie-btn cookie-save-btn" onClick={handleSavePreferences}>
              Save choices
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
};

export default CookieBanner;
