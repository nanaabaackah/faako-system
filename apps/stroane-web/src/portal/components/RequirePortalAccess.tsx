import React from "react";
import { Navigate, Outlet } from "react-router-dom";
import { AnimatedLoadingState } from "@faako/ui";
import { useAdminPortal } from "../context/AdminPortalContext";

const PORTAL_ROLES = new Set(["ADMIN", "VIEWER"]);

const RequirePortalAccess: React.FC = () => {
  const { session, authChecking } = useAdminPortal();

  if (authChecking) {
    return (
      <AnimatedLoadingState
        page
        title="Checking portal access"
        message="Confirming your secure Stroane session."
      />
    );
  }

  if (!session || !PORTAL_ROLES.has(session.role)) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
};

export default RequirePortalAccess;
