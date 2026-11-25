import { useEffect, useMemo, useRef, useState } from "react";

const DEFAULT_CHECK_INTERVAL_MS = 5 * 60 * 1000;

export interface AppUpdateNoticeProps {
  appName?: string;
  checkIntervalMs?: number;
  checkUrl?: string;
  className?: string;
  dismissStorageKey?: string;
  enabled?: boolean;
  mode?: "prompt" | "auto";
  /** In prompt mode, keep the update visible but disable refresh until work is safe. */
  refreshBlocked?: boolean;
  refreshBlockedMessage?: string;
  /** Optional daily UTC hour for applying pending prompt-mode updates when safe. */
  dailyRefreshHourUtc?: number;
  /** Optional marker for the exact app shell; never interpret a sign-in/error page as an update. */
  expectedDocumentMarker?: string;
}

const nextUtcDeadline = (hour: number, now = Date.now()) => {
  const deadline = new Date(now);
  deadline.setUTCHours(hour, 0, 0, 0);
  if (deadline.getTime() < now) deadline.setUTCDate(deadline.getUTCDate() + 1);
  return deadline.getTime();
};

const normalizeAssetPath = (value: string) => {
  try {
    const url = new URL(value, window.location.origin);
    if (url.origin !== window.location.origin) return "";
    return `${url.pathname}${url.search}`;
  } catch {
    return "";
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
      if (node.tagName === "SCRIPT") return node.getAttribute("src") || "";
      if (node.tagName === "LINK") return node.getAttribute("href") || "";
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
  mode = "prompt",
  refreshBlocked = false,
  refreshBlockedMessage = "Finish saving your current work before refreshing.",
  dailyRefreshHourUtc,
  expectedDocumentMarker,
}: AppUpdateNoticeProps) => {
  const [latestSignature, setLatestSignature] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [pendingUpdate, setPendingUpdate] = useState<{ signature: string; deadline: number } | null>(null);
  const automaticAttempt = useRef("");
  const scheduled = mode === "prompt" && typeof dailyRefreshHourUtc === "number" && Number.isInteger(dailyRefreshHourUtc) && dailyRefreshHourUtc >= 0 && dailyRefreshHourUtc <= 23;
  const initialSignatureRef = useRef("");
  const parserRef = useRef<DOMParser | null>(null);
  const storageKey = useMemo(
    () => dismissStorageKey || `faako:update-dismissed:${appName}`,
    [appName, dismissStorageKey]
  );
  const autoRefreshStorageKey = useMemo(() => `${storageKey}:auto-refreshing`, [storageKey]);

  useEffect(() => {
    if (!enabled || typeof window === "undefined" || typeof document === "undefined") return;

    if (expectedDocumentMarker && !document.querySelector(expectedDocumentMarker)) return;
    initialSignatureRef.current = getDocumentBuildSignature(document);
    if (!initialSignatureRef.current) return;
    try {
      if (window.sessionStorage.getItem(autoRefreshStorageKey) === initialSignatureRef.current) {
        window.sessionStorage.removeItem(autoRefreshStorageKey);
      }
    } catch {
      // Ignore storage failures; update checks can still run.
    }

    parserRef.current = new DOMParser();
    let cancelled = false;
    let checking = false;
    let checkQueued = false;

    const checkForUpdate = async () => {
      if (cancelled) return;
      if (checking) {
        // A foreground or interval check can arrive while the previous HTML
        // request is still pending. Coalesce it instead of losing the signal.
        checkQueued = true;
        return;
      }
      checking = true;
      try {
        const response = await fetch(getCheckUrl(checkUrl), {
          cache: "no-store",
          credentials: "same-origin",
          headers: { Accept: "text/html" },
        });
        const contentType = response.headers.get("content-type") || "";
        if (!response.ok || response.redirected || !contentType.includes("text/html")) return;

        const html = await response.text();
        if (cancelled) return;

        const nextDocument = parserRef.current?.parseFromString(html, "text/html");
        if (!nextDocument || (expectedDocumentMarker && !nextDocument.querySelector(expectedDocumentMarker))) return;

        const nextSignature = getDocumentBuildSignature(nextDocument);
        let dismissedSignature = "";
        try { dismissedSignature = window.localStorage.getItem(storageKey) || ""; } catch { /* Storage may be unavailable. */ }
        if (scheduled && nextSignature) {
          if (nextSignature === initialSignatureRef.current) {
            setPendingUpdate(null);
            setLatestSignature("");
          } else {
            const deadline = nextUtcDeadline(dailyRefreshHourUtc!);
            // A newer deployment or Later dismissal cannot postpone a pending deadline.
            setPendingUpdate(previous => previous?.signature === nextSignature ? previous : {
              signature: nextSignature, deadline: previous?.deadline ?? deadline,
            });
          }
        }

        if (
          nextSignature &&
          nextSignature !== initialSignatureRef.current &&
          nextSignature !== dismissedSignature
        ) {
          if (mode === "auto") {
            try {
              if (window.sessionStorage.getItem(autoRefreshStorageKey) === nextSignature) return;
              window.sessionStorage.setItem(autoRefreshStorageKey, nextSignature);
            } catch {
              // If storage is unavailable, a single reload is still the least surprising behavior.
            }
            window.location.reload();
            return;
          }
          setLatestSignature(nextSignature);
        } else if (scheduled && nextSignature) {
          // A rollback or an already-dismissed newer signature cannot leave
          // the old notice visible while a different build is pending.
          setLatestSignature("");
        }
      } catch {
        // Update checks should never interrupt the active app session.
      } finally {
        checking = false;
        if (checkQueued && !cancelled) {
          checkQueued = false;
          void checkForUpdate();
        }
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
  }, [autoRefreshStorageKey, checkIntervalMs, checkUrl, dailyRefreshHourUtc, enabled, mode, scheduled, storageKey, expectedDocumentMarker]);

  useEffect(() => {
    if (!enabled || !scheduled || !pendingUpdate || refreshBlocked || refreshing) return;
    const { signature, deadline } = pendingUpdate;
    const applyIfDue = () => {
      if (Date.now() < deadline || automaticAttempt.current === signature) return;
      automaticAttempt.current = signature;
      // A stale cache or unavailable deployment must not cause a reload loop.
      try {
        if (window.sessionStorage.getItem(autoRefreshStorageKey) === signature) return;
        window.sessionStorage.setItem(autoRefreshStorageKey, signature);
      } catch {
        // Without durable per-tab loop protection, keep manual Refresh available.
        setLatestSignature(signature);
        return;
      }
      window.location.reload();
    };
    const timeout = window.setTimeout(applyIfDue, Math.max(0, deadline - Date.now()));
    const onVisible = () => { if (document.visibilityState === "visible") applyIfDue(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearTimeout(timeout);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [autoRefreshStorageKey, enabled, pendingUpdate, refreshBlocked, refreshing, scheduled]);

  if (!enabled || !latestSignature) return null;

  const rootClassName = ["ui-app-update-notice", className].filter(Boolean).join(" ");
  const handleRefresh = () => {
    if (refreshBlocked || refreshing) return;
    setRefreshing(true);
    setLatestSignature("");
    setPendingUpdate(null);
    window.location.reload();
  };

  return (
    <aside className={rootClassName} aria-live="polite" aria-label="App update available">
      <div className="ui-app-update-notice__copy">
        <strong>Update ready</strong>
        <span>{refreshBlocked ? refreshBlockedMessage : `A newer version of ${appName} is available. Finish your current work, then refresh.${scheduled ? ` Pending updates refresh automatically at ${String(dailyRefreshHourUtc).padStart(2, "0")}:00 GMT when safe.` : ""}`}</span>
      </div>
      <div className="ui-app-update-notice__actions">
        <button
          type="button"
          className="ui-app-update-notice__button ui-app-update-notice__button--primary"
          onClick={handleRefresh}
          disabled={refreshing || refreshBlocked}
        >
          {refreshing ? "Refreshing..." : "Refresh now"}
        </button>
        <button
          type="button"
          className="ui-app-update-notice__button"
          disabled={refreshing}
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
