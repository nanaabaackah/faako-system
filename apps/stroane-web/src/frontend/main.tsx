/* eslint-disable react-refresh/only-export-components */
import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, useLocation } from "react-router-dom";
import {
  AppUpdateNotice,
  GoogleAnalyticsRouteTracker,
  UiSystemProvider,
} from "@faako/ui";
import "@faako/ui/ui.css";
import "@faako/ui/compat.css";
import "../index.css";
import "../styles/globals.css";
import appSystem from "../../appSystem.js";
import StorefrontApp from "./StorefrontApp";
import {
  hasStroaneAnalyticsConsent,
  STROANE_COOKIE_PREFS_EVENT,
  type StroaneCookiePreferences,
} from "./utils/cookieConsent";

const measurementId =
  import.meta.env.VITE_GA_MEASUREMENT_ID || import.meta.env.VITE_GA_ID;
const analyticsEnabled =
  import.meta.env.PROD || import.meta.env.VITE_ENABLE_GA_IN_DEV === "true";
const updateNoticeEnabled =
  import.meta.env.PROD || import.meta.env.VITE_ENABLE_APP_UPDATE_NOTICE === "true";

const StorefrontRuntime = () => {
  const [analyticsAllowed, setAnalyticsAllowed] = useState(
    hasStroaneAnalyticsConsent,
  );
  useLocation();

  useEffect(() => {
    const handlePreferences = (event: Event) => {
      const detail = (event as CustomEvent<StroaneCookiePreferences>).detail;
      setAnalyticsAllowed(Boolean(detail?.analytics));
    };
    window.addEventListener(STROANE_COOKIE_PREFS_EVENT, handlePreferences);
    return () => window.removeEventListener(STROANE_COOKIE_PREFS_EVENT, handlePreferences);
  }, []);

  return (
    <>
      <GoogleAnalyticsRouteTracker
        measurementId={measurementId}
        enabled={analyticsEnabled}
        shouldTrack={() => analyticsAllowed}
      />
      <AppUpdateNotice
        appName="Stroane"
        checkUrl="/"
        mode="auto"
        enabled={updateNoticeEnabled}
      />
      <StorefrontApp />
    </>
  );
};

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <UiSystemProvider appSystem={appSystem}>
      <BrowserRouter>
        <StorefrontRuntime />
      </BrowserRouter>
    </UiSystemProvider>
  </StrictMode>,
);
