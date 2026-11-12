import { useEffect, useRef, useState } from "react";

let loading;
function loadTurnstile() {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (!loading) {
    loading = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      script.async = true;
      script.defer = true;
      script.addEventListener("load", () => resolve(window.turnstile), { once: true });
      script.addEventListener("error", () => {
        script.remove();
        loading = undefined;
        reject(new Error("Security check could not load."));
      }, { once: true });
      document.head.append(script);
    });
  }
  return loading;
}

export default function TurnstileChallenge({ siteKey, resetCount, onToken }) {
  const container = useRef(null);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!siteKey || !container.current) return;
    let cancelled = false;
    let widget;
    onToken("");
    setError("");
    loadTurnstile().then(api => {
      if (cancelled) return;
      widget = api.render(container.current, {
        sitekey: siteKey,
        action: "twe_enquiry",
        theme: "light",
        size: "compact",
        "response-field": false,
        callback: onToken,
        "expired-callback": () => onToken(""),
        "error-callback": () => {
          onToken("");
          setError("The security check needs another attempt. Retry it or contact us on WhatsApp.");
          return true;
        },
      });
    }).catch(() => {
      if (!cancelled) setError("The security check could not load. Check your connection or contact us on WhatsApp.");
    });
    return () => {
      cancelled = true;
      if (widget !== undefined) window.turnstile?.remove(widget);
    };
  }, [siteKey, resetCount, onToken]);
  return (
    <div className="enquiry-security-check">
      <div ref={container} />
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
