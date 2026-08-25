import { createElement } from "react";
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

function PublicOnly({ children }) {
  const { user, authReady } = useAuth();
  if (!authReady) return <RouteFallback />;
  return user ? <Navigate to="/admin" replace /> : children;
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

  return canAccess
    ? children
    : <Navigate to={getPortalAccessFallbackPath(role)} replace />;
}

function DefaultRedirect() {
  const { user, authReady } = useAuth();
  if (!authReady) return <RouteFallback />;
  return <Navigate to={user ? "/admin" : "/login"} replace />;
}

const renderRouteElement = (route) => {
  if (route.redirect) {
    return <Navigate to={route.redirect} replace />;
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
