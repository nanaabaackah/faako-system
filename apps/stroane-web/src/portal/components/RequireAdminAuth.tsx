import React from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { AnimatedLoadingState } from "@faako/ui";
import { useAdminPortal } from "../context/AdminPortalContext";

const RequireAdminAuth: React.FC = () => {
  const { session, authChecking } = useAdminPortal();
  const location = useLocation();

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

  if (!session) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <Outlet />;
};

export default RequireAdminAuth;
