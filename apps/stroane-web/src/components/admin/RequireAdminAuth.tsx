import React from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAdminPortal } from "../../context/AdminPortalContext";

const RequireAdminAuth: React.FC = () => {
  const { session } = useAdminPortal();
  const location = useLocation();

  if (!session) {
    return <Navigate to="/admin/signin" replace state={{ from: location.pathname }} />;
  }

  return <Outlet />;
};

export default RequireAdminAuth;
