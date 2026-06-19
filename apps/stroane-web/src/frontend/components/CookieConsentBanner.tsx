import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  readStroaneCookiePreferences,
  writeStroaneCookiePreferences,
} from "../utils/cookieConsent";
import "./CookieConsentBanner.css";

const CookieConsentBanner: React.FC = () => {
  const [visible, setVisible] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [marketing, setMarketing] = useState(false);

  useEffect(() => {
    const saved = readStroaneCookiePreferences();
    setVisible(!saved);
    setAnalytics(Boolean(saved?.analytics));
    setMarketing(Boolean(saved?.marketing));
  }, []);

  const persist = (next: { analytics: boolean; marketing: boolean }) => {
    writeStroaneCookiePreferences({
      necessary: true,
      analytics: next.analytics,
      marketing: next.marketing,
    });
    setVisible(false);
    setExpanded(false);
  };

  if (!visible) return null;

  return (
    <aside
      className={`stroane-cookie ${expanded ? "is-expanded" : ""}`}
      role="dialog"
      aria-modal="false"
      aria-label="Cookie and privacy choices"
    >
      <div className="stroane-cookie__shell">
        <div className="stroane-cookie__copy">
          <span className="stroane-cookie__kicker">Privacy choices</span>
          <h2>Cookies that keep ordering simple</h2>
          <p>
            Stroane uses essential browser storage for your cart, customer session,
            checkout progress, and security. Optional analytics helps us improve
            pages in aggregate. Card, mobile money, and bank details are entered
            with Paystack and are not stored on Stroane systems.
          </p>
          <Link to="/cookies" className="stroane-cookie__link">
            Read the Cookie Policy
          </Link>
        </div>

        <div className="stroane-cookie__actions">
          <button type="button" onClick={() => persist({ analytics: false, marketing: false })}>
            Reject optional
          </button>
          <button
            type="button"
            className="stroane-cookie__secondary"
            onClick={() => setExpanded((current) => !current)}
            aria-expanded={expanded}
          >
            Customize
          </button>
          <button
            type="button"
            className="stroane-cookie__primary"
            onClick={() => persist({ analytics: true, marketing: true })}
          >
            Accept all
          </button>
        </div>

        <div className="stroane-cookie__prefs" hidden={!expanded}>
          <div className="stroane-cookie__pref is-locked">
            <div>
              <strong>Essential storage</strong>
              <span>Cart, checkout, account session, fraud prevention, and consent choice.</span>
            </div>
            <em>Always on</em>
          </div>
          <div className="stroane-cookie__pref">
            <div>
              <strong id="stroane-analytics-consent-label">Analytics</strong>
              <span>Page visits, device/browser type, approximate region, and performance signals.</span>
            </div>
            <input
              type="checkbox"
              checked={analytics}
              onChange={(event) => setAnalytics(event.target.checked)}
              aria-labelledby="stroane-analytics-consent-label"
            />
          </div>
          <div className="stroane-cookie__pref">
            <div>
              <strong id="stroane-marketing-consent-label">Marketing</strong>
              <span>Saved campaign preferences if Stroane runs optional promotions.</span>
            </div>
            <input
              type="checkbox"
              checked={marketing}
              onChange={(event) => setMarketing(event.target.checked)}
              aria-labelledby="stroane-marketing-consent-label"
            />
          </div>
          <button
            type="button"
            className="stroane-cookie__save"
            onClick={() => persist({ analytics, marketing })}
          >
            Save choices
          </button>
        </div>
      </div>
    </aside>
  );
};

export default CookieConsentBanner;
