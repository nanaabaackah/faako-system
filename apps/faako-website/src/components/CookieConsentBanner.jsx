import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  readFaakoCookiePreferences,
  saveFaakoCookiePreferences,
} from "../utils/cookieConsent";
import "../styles/components/cookie-consent.css";

export default function CookieConsentBanner() {
  const [visible, setVisible] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [analytics, setAnalytics] = useState(false);

  useEffect(() => {
    const saved = readFaakoCookiePreferences();
    setVisible(!saved);
    setAnalytics(Boolean(saved?.analytics));
  }, []);

  const persist = (nextAnalytics) => {
    saveFaakoCookiePreferences({ analytics: nextAnalytics });
    setVisible(false);
    setExpanded(false);
  };

  if (!visible) return null;

  return (
    <aside
      className={`cookie-consent ${expanded ? "is-expanded" : ""}`}
      role="dialog"
      aria-modal="false"
      aria-label="Cookie and privacy preferences"
    >
      <div className="cookie-consent__panel">
        <div className="cookie-consent__copy">
          <span>Cookie preferences</span>
          <h2>Clear choices for site storage</h2>
          <p>
            Faako uses essential browser storage for theme/language preferences,
            form drafts, abuse prevention, and security. Optional analytics helps
            improve pages in aggregate. When a client project uses Paystack,
            payment credentials are entered with Paystack and are not stored on
            Faako systems.
          </p>
          <Link to="/privacy">Privacy and cookie details</Link>
        </div>

        <div className="cookie-consent__actions">
          <button type="button" onClick={() => persist(false)}>
            Reject optional
          </button>
          <button
            type="button"
            onClick={() => setExpanded((current) => !current)}
            aria-expanded={expanded}
          >
            Customize
          </button>
          <button type="button" className="is-primary" onClick={() => persist(true)}>
            Accept analytics
          </button>
        </div>

        <div className="cookie-consent__prefs" hidden={!expanded}>
          <div className="cookie-consent__pref">
            <div>
              <strong>Essential</strong>
              <small>Security, forms, preferences, consent choice, and language tools.</small>
            </div>
            <em>Always on</em>
          </div>
          <div className="cookie-consent__pref">
            <div>
              <strong id="faako-analytics-consent-label">Analytics</strong>
              <small>Page paths, browser/device type, approximate region, and performance signals.</small>
            </div>
            <input
              id="faako-analytics-consent"
              type="checkbox"
              checked={analytics}
              onChange={(event) => setAnalytics(event.target.checked)}
              aria-labelledby="faako-analytics-consent-label"
            />
          </div>
          <button type="button" className="cookie-consent__save is-primary" onClick={() => persist(analytics)}>
            Save choices
          </button>
        </div>
      </div>
    </aside>
  );
}
