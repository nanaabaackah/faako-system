import React, { useMemo } from "react";
import "./AdminBottomNav.css";
import { Link, useLocation } from "react-router-dom";
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
  canAccessPortalRoute,
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
  return items.filter((item) => item && canAccessPortalRoute(role, item.path)
    // The Water API permits owners, admins and dedicated Water operators only.
    && (item.id !== "water" || ["owner", "admin", "water"].includes(String(role).toLowerCase())));
};

function AdminBottomNav() {
  const location = useLocation();
  const { user } = useAuth();

  const normalizedPath = useMemo(() => normalizePath(location.pathname), [location.pathname]);
  const navItems = useMemo(() => getNavItems(user?.role), [user?.role]);

  if (!navItems.length) return null;
  const name = user?.name || user?.fullName || [user?.firstName, user?.lastName].filter(Boolean).join(" ") || user?.email || "Your account";
  const avatar = user?.imageUrl || user?.profilePhoto;
  const initials = name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();

  return (
    <div className="reebs-quick-access-shell">
    <nav
      className="reebs-quick-access"
      aria-label="Quick access"
      style={{
        // Preserve the central POS slot even when a role cannot see Finance or
        // Water. Empty space must never be filled with unauthorized links.
        gridTemplateColumns: `repeat(${navItems.some((item) => item.id === "pos") ? 5 : navItems.length}, minmax(0, 1fr))`,
      }}
    >
      {navItems.map((item) => {
        const itemPath = normalizePath(item.path);
        const isActive =
          normalizedPath === itemPath ||
          (itemPath !== "/admin" && normalizedPath.startsWith(`${itemPath}/`));

        return (
          <Link
            key={item.id}
            to={item.path}
            aria-current={isActive ? "page" : undefined}
            title={item.label}
            className={[
              "reebs-quick-access__item",
              item.id === "pos" ? "is-primary" : "",
              isActive ? "is-active" : "",
              item.enabled === false ? "is-disabled" : "",
            ].filter(Boolean).join(" ")}
            data-module-key={item.moduleKey}
            data-module-group={item.group}
            data-module-status={item.status}
            data-module-state={item.state}
            data-module-visibility={item.visibility}
            data-module-status-label={item.statusLabel}
          >
            <AppIcon icon={item.icon} />
            <span className="reebs-quick-access__label">
              <span>{item.label}</span>
              {Array.isArray(item.badges) && item.badges.length > 0 ? (
                <span className="reebs-quick-access__badges" aria-label="Module state">
                  {item.badges.map((badge) => (
                    <ErpStatusBadge key={badge.key} badge={badge} />
                  ))}
                </span>
              ) : null}
            </span>
          </Link>
        );
      })}
    </nav>
    <Link className="reebs-quick-access-account" to="/admin/profile" aria-label={`Profile settings for ${name}`}>
      <span className="reebs-quick-access-account__avatar">{avatar ? <img src={avatar} alt="" /> : initials}</span>
      <span><strong>{name}</strong><small>Your account</small></span>
    </Link>
    </div>
  );
}

export default AdminBottomNav;
