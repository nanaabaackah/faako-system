import React from "react";
import { Navigate, Outlet } from "react-router-dom";
import { AnimatedLoadingState } from "@faako/ui";
import { useAdminPortal } from "../context/AdminPortalContext";
import {
  ADMIN_ROLES,
  canAccessPortalModule,
  hasPortalPermission,
  type AdminRole,
  type AdminRoleAction,
  type AdminRoleModule,
} from "../api/adminSession";

const PORTAL_ROLES = new Set<AdminRole>(ADMIN_ROLES);

interface RequirePortalAccessProps {
  allowedRoles?: AdminRole[];
  moduleId?: AdminRoleModule;
  action?: AdminRoleAction;
  fallbackPath?: string;
  children?: React.ReactNode;
}

const getSessionFallbackPath = (session: ReturnType<typeof useAdminPortal>["session"]) =>
  canAccessPortalModule(session, "dashboard") ? "/admin" : "/admin/profile";

const RequirePortalAccess: React.FC<RequirePortalAccessProps> = ({
  allowedRoles,
  moduleId,
  action = "view",
  fallbackPath,
  children,
}) => {
  const { session, authChecking } = useAdminPortal();

  if (authChecking) {
    return (
      <AnimatedLoadingState
        page
        variant="portal"
        title="Checking portal access"
        message="Confirming your secure Stroane session."
      />
    );
  }

  if (!session || !PORTAL_ROLES.has(session.role)) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(session.role)) {
    return <Navigate to={fallbackPath || getSessionFallbackPath(session)} replace />;
  }

  if (moduleId && !hasPortalPermission(session, moduleId, action)) {
    return <Navigate to={fallbackPath || getSessionFallbackPath(session)} replace />;
  }

  return children ? <>{children}</> : <Outlet />;
};

export default RequirePortalAccess;
