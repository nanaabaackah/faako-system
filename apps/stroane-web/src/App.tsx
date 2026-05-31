import "./styles/globals.css";
import React, { lazy, Suspense } from "react";
import { BrowserRouter as Router, useLocation } from "react-router-dom";
import { resolveAppSurface } from "./config/appSurface";

const PortalApp = lazy(() => import("./PortalApp"));
const StorefrontApp = lazy(() => import("./StorefrontApp"));

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
      <Suspense fallback={<p>Loading...</p>}>
        <SurfaceApp />
      </Suspense>
    </Router>
  );
};

export default App;
