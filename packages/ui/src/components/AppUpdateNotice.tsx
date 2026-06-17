import { useEffect, useMemo, useRef, useState } from "react";

const DEFAULT_CHECK_INTERVAL_MS = 5 * 60 * 1000;

export interface AppUpdateNoticeProps {
  appName?: string;
  checkIntervalMs?: number;
  checkUrl?: string;
  className?: string;
  dismissStorageKey?: string;
  enabled?: boolean;
}

const normalizeAssetPath = (value: string) => {
  try {
    const url = new URL(value, window.location.origin);
    if (url.origin !== window.location.origin) return "";
    return `${url.pathname}${url.search}`;
  } catch {
    return value;
  }
};

const getDocumentBuildSignature = (doc: Document) => {
  const assetSelectors = [
    "script[src]",
    'link[rel="stylesheet"][href]',
    'link[rel="modulepreload"][href]',
  ];
  const assets = assetSelectors.flatMap((selector) =>
    Array.from(doc.querySelectorAll(selector)).map((node) => {
      if (node instanceof HTMLScriptElement) return node.src;
      if (node instanceof HTMLLinkElement) return node.href;
      return "";
    })
  );

  return assets
    .filter(Boolean)
    .map(normalizeAssetPath)
    .filter(Boolean)
    .sort()
    .join("|");
};

const getCheckUrl = (explicitUrl?: string) => {
  const url = new URL(explicitUrl || "/", window.location.origin);
  url.hash = "";
  url.searchParams.set("__faako_update_check", String(Date.now()));
  return url.toString();
};

export const AppUpdateNotice = ({
  appName = "this app",
  checkIntervalMs = DEFAULT_CHECK_INTERVAL_MS,
  checkUrl,
  className = "",
  dismissStorageKey,
  enabled = true,
}: AppUpdateNoticeProps) => {
  const [latestSignature, setLatestSignature] = useState("");
  const initialSignatureRef = useRef("");
  const parserRef = useRef<DOMParser | null>(null);
  const storageKey = useMemo(
    () => dismissStorageKey || `faako:update-dismissed:${appName}`,
    [appName, dismissStorageKey]
  );

  useEffect(() => {
    if (!enabled || typeof window === "undefined" || typeof document === "undefined") return;

    initialSignatureRef.current = getDocumentBuildSignature(document);
    if (!initialSignatureRef.current) return;

    parserRef.current = new DOMParser();
    let cancelled = false;

    const checkForUpdate = async () => {
      try {
        const response = await fetch(getCheckUrl(checkUrl), {
          cache: "no-store",
          credentials: "same-origin",
          headers: { Accept: "text/html" },
        });
        const contentType = response.headers.get("content-type") || "";
        if (!response.ok || !contentType.includes("text/html")) return;

        const html = await response.text();
        if (cancelled) return;

        const nextDocument = parserRef.current?.parseFromString(html, "text/html");
        if (!nextDocument) return;

        const nextSignature = getDocumentBuildSignature(nextDocument);
        const dismissedSignature =
          typeof window.localStorage !== "undefined"
            ? window.localStorage.getItem(storageKey)
            : "";

        if (
          nextSignature &&
          nextSignature !== initialSignatureRef.current &&
          nextSignature !== dismissedSignature
        ) {
          setLatestSignature(nextSignature);
        }
      } catch {
        // Update checks should never interrupt the active app session.
      }
    };

    const intervalId = window.setInterval(checkForUpdate, Math.max(30_000, checkIntervalMs));
    const visibilityHandler = () => {
      if (document.visibilityState === "visible") void checkForUpdate();
    };

    document.addEventListener("visibilitychange", visibilityHandler);
    void checkForUpdate();

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", visibilityHandler);
    };
  }, [checkIntervalMs, checkUrl, enabled, storageKey]);

  if (!enabled || !latestSignature) return null;

  const rootClassName = ["ui-app-update-notice", className].filter(Boolean).join(" ");

  return (
    <aside className={rootClassName} aria-live="polite" aria-label="App update available">
      <div className="ui-app-update-notice__copy">
        <strong>Update ready</strong>
        <span>A newer version of {appName} is available. Finish your current work, then refresh.</span>
      </div>
      <div className="ui-app-update-notice__actions">
        <button
          type="button"
          className="ui-app-update-notice__button ui-app-update-notice__button--primary"
          onClick={() => window.location.reload()}
        >
          Refresh now
        </button>
        <button
          type="button"
          className="ui-app-update-notice__button"
          onClick={() => {
            try {
              window.localStorage.setItem(storageKey, latestSignature);
            } catch {
              // Ignore storage failures; dismissal can remain in-memory.
            }
            setLatestSignature("");
          }}
        >
          Later
        </button>
      </div>
    </aside>
  );
};

export default AppUpdateNotice;
