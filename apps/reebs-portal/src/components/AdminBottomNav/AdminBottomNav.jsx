import React, { useMemo } from "react";
import "./AdminBottomNav.css";
import { useLocation, useNavigate } from "react-router-dom";
import { ErpStatusBadge } from "@faako/ui";
import { AppIcon } from "/src/components/Icon/Icon";
import { useAuth } from "../AuthContext/AuthContext";
import {
  getReebsBaseBottomNavItems,
  getReebsDriverBottomNavItems,
  WATER_BOTTOM_NAV_ITEMS,
} from "../../config/adminNavigation";
import {
  canAccessStandardPortalArea,
  canAccessWaterPortalArea,
  isDriverPortalRole,
  isWaterPortalRole,
} from "../../utils/adminAccess";

const normalizePath = (pathname) => {
  const [basePath = ""] = String(pathname || "").split("?");
  const trimmed = basePath.replace(/\/+$/, "");
  return trimmed || "/admin";
};

const getNavItems = (role) => {
  if (isWaterPortalRole(role)) {
    return WATER_BOTTOM_NAV_ITEMS;
  }

  if (isDriverPortalRole(role)) {
    return getReebsDriverBottomNavItems();
  }

  const items = canAccessStandardPortalArea(role) ? [...getReebsBaseBottomNavItems()] : [];
  if (canAccessWaterPortalArea(role)) {
    items.push(WATER_BOTTOM_NAV_ITEMS[0]);
  }
  return items.filter(Boolean);
};

function AdminBottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();

  const normalizedPath = useMemo(() => normalizePath(location.pathname), [location.pathname]);
  const navItems = useMemo(() => getNavItems(user?.role), [user?.role]);

  if (!navItems.length) return null;

  return (
    <nav
      className="aw-nav"
      aria-label="Admin navigation"
      style={{
        gridTemplateColumns: `repeat(${navItems.length}, minmax(0, 1fr))`,
        "--aw-nav-count": navItems.length,
      }}
    >
      {navItems.map((item) => {
        const itemPath = normalizePath(item.path);
        const isActive =
          normalizedPath === itemPath ||
          (itemPath !== "/admin" && normalizedPath.startsWith(`${itemPath}/`));

        return (
          <button
            key={item.id}
            type="button"
            className={[
              "aw-nav-btn",
              isActive ? "is-active" : "",
              item.enabled === false ? "is-disabled" : "",
            ].filter(Boolean).join(" ")}
            data-module-key={item.moduleKey}
            data-module-group={item.group}
            data-module-status={item.status}
            data-module-state={item.state}
            data-module-visibility={item.visibility}
            data-module-status-label={item.statusLabel}
            onClick={() => navigate(item.path)}
          >
            <AppIcon icon={item.icon} />
            <span className="aw-nav-btn-label">
              <span>{item.label}</span>
              {Array.isArray(item.badges) && item.badges.length > 0 ? (
                <span className="aw-nav-btn-badges" aria-label="Module state">
                  {item.badges.map((badge) => (
                    <ErpStatusBadge key={badge.key} badge={badge} className="aw-nav-btn-badge" />
                  ))}
                </span>
              ) : null}
            </span>
          </button>
        );
      })}
    </nav>
  );
}

export default AdminBottomNav;
