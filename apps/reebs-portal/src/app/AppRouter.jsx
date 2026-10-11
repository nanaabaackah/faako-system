import { createElement, useEffect } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "../components/AuthContext/AuthContext";
import SiteLoader from "../components/SiteLoader/SiteLoader";
import {
  canAccessOwnerAdminPortalArea,
  canAccessPortalRoute,
  canAccessPrivilegedPortalArea,
  canAccessStandardPortalArea,
  canAccessWaterPortalArea,
  getPortalAccessFallbackPath,
  getPortalEntryPath,
  normalizeAdminRole,
} from "../utils/adminAccess";
import { routeConfig } from "./routeConfig";

export function RouteFallback() {
  return (
    <SiteLoader
      label="Loading page"
      sublabel="Setting up your portal view."
      variant="portal"
    />
  );
}

function ExternalRedirect({ to }) {
  useEffect(() => {
    window.location.replace(to);
  }, [to]);
  return <RouteFallback />;
}

const entryRedirect = (path) => (
  /^https?:\/\//i.test(path)
    ? <ExternalRedirect to={path} />
    : <Navigate to={path} replace />
);

function PublicOnly({ children }) {
  const { user, authReady } = useAuth();
  if (!authReady) return <RouteFallback />;
  const entryPath = getPortalEntryPath(
    typeof window === "undefined" ? "" : window.location.hostname,
    user?.role
  );
  return user ? entryRedirect(entryPath) : children;
}

function RequireAuth({ children }) {
  const { user, authReady } = useAuth();
  if (!authReady) return <RouteFallback />;
  return user ? children : <Navigate to="/login" replace />;
}

function RequirePortalAccess({ children, access = "standard", path = "" }) {
  const { user, authReady } = useAuth();
  if (!authReady) return <RouteFallback />;

  const role = normalizeAdminRole(user?.role);
  const canAccess = path
    ? canAccessPortalRoute(role, path)
    : access === "ownerAdmin"
      ? canAccessOwnerAdminPortalArea(role)
      : access === "privileged"
        ? canAccessPrivilegedPortalArea(role)
        : access === "water"
          ? canAccessWaterPortalArea(role)
          : canAccessStandardPortalArea(role);

  if (canAccess) return children;
  return entryRedirect(getPortalAccessFallbackPath(role));
}

function DefaultRedirect() {
  const { user, authReady } = useAuth();
  if (!authReady) return <RouteFallback />;
  const entryPath = getPortalEntryPath(
    typeof window === "undefined" ? "" : window.location.hostname,
    user?.role
  );
  return user ? entryRedirect(entryPath) : <Navigate to="/login" replace />;
}

const renderRouteElement = (route) => {
  if (route.externalRedirect) return <ExternalRedirect to={route.externalRedirect} />;
  if (route.redirect) {
    return entryRedirect(route.redirect);
  }

  let element = createElement(route.component, route.props || {});

  if (route.access || route.accessPath) {
    element = (
      <RequirePortalAccess access={route.access} path={route.accessPath}>
        {element}
      </RequirePortalAccess>
    );
  }
  if (route.auth) element = <RequireAuth>{element}</RequireAuth>;
  if (route.publicOnly) element = <PublicOnly>{element}</PublicOnly>;

  return element;
};

export default function AppRouter() {
  return (
    <Routes>
      {routeConfig.map((route) => (
        <Route
          key={route.path}
          path={route.path}
          element={renderRouteElement(route)}
        />
      ))}
      <Route path="*" element={<DefaultRedirect />} />
    </Routes>
  );
}
