import React, { useEffect, useMemo, useState } from "react";
import "./AdminQuickActions.css";
import { useLocation, useNavigate } from "react-router-dom";
import { AppIcon } from "/src/components/Icon/Icon";
import { faBars, faXmark } from "/src/icons/iconSet";
import { useAuth } from "../AuthContext/AuthContext";
import { getAdminQuickActions } from "../../utils/adminQuickActions";

const WORKSPACE_ROUTES = new Set([
  "/admin",
  "/admin/inventory",
  "/admin/purchases",
  "/admin/offline",
  "/admin/advanced",
]);

const normalizePath = (pathname) => {
  if (!pathname) return "/admin";
  const trimmed = pathname.replace(/\/+$/, "");
  return trimmed || "/admin";
};

function AdminQuickActions() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);

  const normalizedPath = useMemo(() => normalizePath(location.pathname), [location.pathname]);
  const actions = useMemo(() => getAdminQuickActions(user?.role), [user?.role]);
  const isWorkspaceRoute = WORKSPACE_ROUTES.has(normalizedPath);

  useEffect(() => {
    setOpen(false);
  }, [location.pathname, location.search]);

  useEffect(() => {
    if (!open) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  if (!actions.length) return null;

  return (
    <>
      {open ? (
        <button
          type="button"
          className="admin-quick-actions__backdrop"
          aria-label="Close quick actions"
          onClick={() => setOpen(false)}
        />
      ) : null}
      <div
        className={`admin-quick-actions ${open ? "is-open" : ""} ${
          isWorkspaceRoute ? "is-workspace-route" : ""
        }`}
      >
        <div className="admin-quick-actions__panel" aria-hidden={!open}>
          <div className="admin-quick-actions__header">
            <strong>Quick Actions</strong>
            <button
              type="button"
              className="admin-quick-actions__close"
              onClick={() => setOpen(false)}
              aria-label="Close quick actions"
            >
              <AppIcon icon={faXmark} />
            </button>
          </div>
          <div className="admin-quick-actions__grid">
            {actions.map((action) => {
              const isActive =
                normalizedPath === action.path ||
                (action.path !== "/admin" && normalizedPath.startsWith(`${action.path}/`));
              return (
                <button
                  key={action.path}
                  type="button"
                  className={`admin-quick-actions__link ${isActive ? "is-active" : ""}`}
                  onClick={() => {
                    setOpen(false);
                    navigate(action.path);
                  }}
                >
                  {action.label}
                </button>
              );
            })}
          </div>
        </div>
        <button
          type="button"
          className="admin-quick-actions__toggle"
          aria-expanded={open}
          aria-label={open ? "Close quick actions" : "Open quick actions"}
          onClick={() => setOpen((prev) => !prev)}
        >
          <AppIcon icon={open ? faXmark : faBars} />
          <span>Quick Actions</span>
        </button>
      </div>
    </>
  );
}

export default AdminQuickActions;
