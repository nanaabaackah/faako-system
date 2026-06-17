import "./styles/globals.css";
import React, { lazy, Suspense } from "react";
import { BrowserRouter as Router, useLocation } from "react-router-dom";
import { AppBottomBar, AnimatedLoadingState, AppUpdateNotice, GoogleAnalyticsRouteTracker } from "@faako/ui";
import { resolveAppSurface } from "./config/appSurface";

const PortalApp = lazy(() => import("./portal/PortalApp"));
const StorefrontApp = lazy(() => import("./frontend/StorefrontApp"));

const GOOGLE_ANALYTICS_MEASUREMENT_ID = import.meta.env.VITE_GA_MEASUREMENT_ID || import.meta.env.VITE_GA_ID;
const GOOGLE_ANALYTICS_ENABLED =
  import.meta.env.PROD || import.meta.env.VITE_ENABLE_GA_IN_DEV === "true";

const SurfaceApp: React.FC = () => {
  const location = useLocation();
  const surface = resolveAppSurface();
  const isLocalPortalPath =
    surface === "combined" &&
    (location.pathname === "/login" || location.pathname.startsWith("/admin"));

  if (surface === "portal" || isLocalPortalPath) return <PortalApp />;
  return <StorefrontApp />;
};

const App: React.FC = () => {
  return (
    <Router>
      <GoogleAnalyticsRouteTracker
        measurementId={GOOGLE_ANALYTICS_MEASUREMENT_ID}
        enabled={GOOGLE_ANALYTICS_ENABLED}
      />
      <AppUpdateNotice
        appName="Stroane"
        checkUrl="/"
        enabled={import.meta.env.PROD || import.meta.env.VITE_ENABLE_APP_UPDATE_NOTICE === "true"}
      />
      <Suspense
        fallback={
          <AnimatedLoadingState
            page
            title="Loading Stroane"
            message="Preparing the next view."
          />
        }
      >
        <SurfaceApp />
      </Suspense>

      <div className="ui-bottom-bar-shell portal-app-bottom-bar-shell">
        <AppBottomBar />
      </div>
    </Router>
  );
};

export default App;
