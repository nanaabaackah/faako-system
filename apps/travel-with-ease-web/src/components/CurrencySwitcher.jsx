import { useEffect, useMemo, useState } from "react";
import { createBrowserApiClient } from "@faako/api-client/browser";
// eslint-disable-next-line no-unused-vars -- JSX component
import { SelectField, Button, IconsaxIcon } from "@faako/ui";
import {
  applyDisplayCurrency,
  currencyPreferenceKey,
  displayCurrencies,
  supportedCurrency,
  validateDisplayRate,
} from "../lib/currency-display.js";
import "../styles/components/currency-switcher.css";

export default function CurrencySwitcher() {
  const [currency, setCurrency] = useState("GHS");
  const [appliedCurrency, setAppliedCurrency] = useState("GHS");
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [status, setStatus] = useState(
    "Prices are shown in Ghanaian cedi (GHS).",
  );
  const api = useMemo(
    () =>
      createBrowserApiClient({
        baseUrl: import.meta.env.DEV
          ? ""
          : import.meta.env.PUBLIC_API_BASE_URL || "",
        credentials: "omit",
      }),
    [],
  );

  useEffect(() => {
    try {
      const saved = localStorage.getItem(currencyPreferenceKey);
      if (supportedCurrency(saved)) setCurrency(saved);
    } catch {
      /* Preference storage may be blocked; current-page use still works. */
    }
    setReady(true);
    const sync = (event) => {
      if (event.key === currencyPreferenceKey)
        setCurrency(supportedCurrency(event.newValue) ? event.newValue : "GHS");
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);

  useEffect(() => {
    if (!ready) return;
    const controller = new AbortController();
    let expiryTimer;
    setFailed(false);
    const save = (code) => {
      try {
        localStorage.setItem(currencyPreferenceKey, code);
      } catch {
        /* Optional preference storage. */
      }
    };
    // Never leave a previously selected currency visible while a new rate loads.
    applyDisplayCurrency(document);
    setAppliedCurrency("GHS");
    if (currency === "GHS") {
      save("GHS");
      setStatus("Prices are shown in Ghanaian cedi (GHS).");
      return () => controller.abort();
    }
    setStatus(
      `Loading ${currency} estimates. Prices remain in GHS until ready.`,
    );
    api
      .get(`/api/public/currency?currency=${currency}`, {
        signal: controller.signal,
        responseMode: "data",
        fallbackMessage:
          "Currency estimates are unavailable. Prices remain in GHS.",
      })
      .then((data) => {
        if (controller.signal.aborted) return;
        validateDisplayRate(data, currency);
        applyDisplayCurrency(document, currency, data.rate);
        setAppliedCurrency(currency);
        save(currency);
        const date = new Intl.DateTimeFormat("en-GH", {
          dateStyle: "medium",
          timeZone: "UTC",
        }).format(new Date(data.updatedAt));
        setStatus(
          `${currency} estimates${data.stale ? " · cached rate; refresh unavailable" : ""}. Rate dated ${date} (UTC). Original GHS prices remain alongside.`,
        );
        expiryTimer = window.setTimeout(() => {
          applyDisplayCurrency(document);
          setAppliedCurrency("GHS");
          setFailed(true);
          setStatus("The conversion rate has expired. All prices are now in GHS. Retry conversion for a current estimate.");
        }, Math.max(1, Date.parse(data.updatedAt) + 72 * 60 * 60_000 - Date.now()));
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        applyDisplayCurrency(document);
        setFailed(true);
        setStatus(
          `${currency} conversion is unavailable. All prices remain in GHS. Select another currency or try again.`,
        );
      });
    return () => {
      controller.abort();
      window.clearTimeout(expiryTimer);
    };
  }, [api, currency, ready, attempt]);

  return (
    <section className="footer-currency" aria-label="Display currency" title={status}>
      <div className="footer-currency__control">
        <SelectField
          label="Display currency"
          name="displayCurrency"
          value={appliedCurrency}
          disabled={!ready}
          aria-describedby="twe-currency-status"
          onChangeValue={value => {
            setCurrency(value);
            setAttempt(current => current + 1);
          }}
        >
          {displayCurrencies.map((item) => (
            <option key={item.code} value={item.code}>
              {item.code} · {item.name}
            </option>
          ))}
        </SelectField>
      </div>
        <p id="twe-currency-status" className="footer-currency__status" role="status" aria-live="polite">
          {status}
        </p>
        {failed && (
          <Button
            type="button"
            aria-label="Retry conversion"
            title={status}
            className="footer-currency__retry"
            onClick={() => setAttempt((value) => value + 1)}
          >
            <IconsaxIcon name="Refresh" />
          </Button>
        )}
    </section>
  );
}
