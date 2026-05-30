import React from "react";
import { Navigate, Outlet } from "react-router-dom";
import { useAdminPortal } from "../../context/AdminPortalContext";

const PORTAL_ROLES = new Set(["ADMIN", "VIEWER"]);

const RequirePortalAccess: React.FC = () => {
  const { session } = useAdminPortal();

  if (!session || !PORTAL_ROLES.has(session.role)) {
    return <Navigate to="/admin/signin" replace />;
  }

  return <Outlet />;
};

export default RequirePortalAccess;
