import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BYNANA_COOKIE_PREFS_OPEN_EVENT,
  readByNanaCookiePreferences,
  saveByNanaCookiePreferences,
} from '../utils/cookieConsent';
import '../styles/components/CookieConsentBanner.css';

function CookieConsentBanner() {
  const [visible, setVisible] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [analytics, setAnalytics] = useState(false);

  useEffect(() => {
    const saved = readByNanaCookiePreferences();
    setVisible(!saved);
    setAnalytics(Boolean(saved?.analytics));

    const handleOpenPreferences = () => {
      const current = readByNanaCookiePreferences();
      setAnalytics(Boolean(current?.analytics));
      setExpanded(true);
      setVisible(true);
    };

    window.addEventListener(BYNANA_COOKIE_PREFS_OPEN_EVENT, handleOpenPreferences);
    return () => window.removeEventListener(BYNANA_COOKIE_PREFS_OPEN_EVENT, handleOpenPreferences);
  }, []);

  const persist = (nextAnalytics) => {
    saveByNanaCookiePreferences({ analytics: nextAnalytics });
    setVisible(false);
    setExpanded(false);
  };

  if (!visible) return null;

  return (
    <aside
      className={`bn-cookie ${expanded ? 'is-expanded' : ''}`}
      role="dialog"
      aria-modal="false"
      aria-label="Cookie preferences"
    >
      <div className="bn-cookie__panel">
        <div className="bn-cookie__copy">
          <span>Privacy choices</span>
          <h2>Small storage, clear purpose</h2>
          <p>
            This portfolio uses essential browser storage for theme preference,
            contact-form cooldown, and consent choice. Optional analytics helps
            me understand site performance in aggregate. This site does not
            collect payment details; Paystack handles payment credentials in any
            linked client payment flow.
          </p>
          <Link to="/privacy">Privacy and cookie details</Link>
        </div>

        <div className="bn-cookie__actions">
          <button type="button" onClick={() => persist(false)}>
            Reject optional
          </button>
          <button type="button" onClick={() => setExpanded((open) => !open)} aria-expanded={expanded}>
            Customize
          </button>
          <button type="button" className="is-primary" onClick={() => persist(true)}>
            Accept analytics
          </button>
        </div>

        <div className="bn-cookie__prefs" hidden={!expanded}>
          <div className="bn-cookie__pref">
            <div>
              <strong>Essential</strong>
              <small>Theme, contact-form cooldown, consent choice, and security basics.</small>
            </div>
            <em>Always on</em>
          </div>
          <div className="bn-cookie__pref">
            <div>
              <strong id="bynana-analytics-consent-label">Analytics</strong>
              <small>Page paths, device/browser type, approximate region, and performance signals.</small>
            </div>
            <input
              id="bynana-analytics-consent"
              type="checkbox"
              checked={analytics}
              onChange={(event) => setAnalytics(event.target.checked)}
              aria-labelledby="bynana-analytics-consent-label"
            />
          </div>
          <button type="button" className="bn-cookie__save is-primary" onClick={() => persist(analytics)}>
            Save choices
          </button>
        </div>
      </div>
    </aside>
  );
}

export default CookieConsentBanner;
