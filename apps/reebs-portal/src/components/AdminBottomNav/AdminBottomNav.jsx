import React, { useMemo } from "react";
import "./AdminBottomNav.css";
import { useLocation, useNavigate } from "react-router-dom";
import { AppIcon } from "/src/components/Icon/Icon";
import {
  faBoxesStacked,
  faCalendarDays,
  faHome,
  faReceipt,
  faStore,
  faTruck,
  faUserGroup,
} from "/src/icons/iconSet";
import { useAuth } from "../AuthContext/AuthContext";
import {
  canAccessStandardPortalArea,
  canAccessWaterPortalArea,
  isDriverPortalRole,
  isWaterPortalRole,
} from "../../utils/adminAccess";

const BASE_NAV_ITEMS = [
  { id: "home", label: "Home", path: "/admin", icon: faHome },
  { id: "inventory", label: "Stock", path: "/admin/inventory", icon: faBoxesStacked },
  { id: "purchases", label: "Buy", path: "/admin/purchases", icon: faReceipt },
  { id: "store-mode", label: "POS", path: "/admin/store-mode", icon: faStore },
];

const DRIVER_NAV_ITEMS = [
  { id: "home", label: "Home", path: "/admin", icon: faHome },
  { id: "bookings", label: "Bookings", path: "/admin/bookings", icon: faCalendarDays },
  { id: "delivery", label: "Delivery", path: "/admin/delivery", icon: faTruck },
  { id: "customers", label: "Customers", path: "/admin/directory?tab=customers", icon: faUserGroup },
];

const WATER_NAV_ITEMS = [{ id: "water", label: "Water", path: "/admin/water", icon: faBoxesStacked }];

const normalizePath = (pathname) => {
  const [basePath = ""] = String(pathname || "").split("?");
  const trimmed = basePath.replace(/\/+$/, "");
  return trimmed || "/admin";
};

const getNavItems = (role) => {
  if (isWaterPortalRole(role)) {
    return WATER_NAV_ITEMS;
  }

  if (isDriverPortalRole(role)) {
    return DRIVER_NAV_ITEMS;
  }

  const items = canAccessStandardPortalArea(role) ? [...BASE_NAV_ITEMS] : [];
  if (canAccessWaterPortalArea(role)) {
    items.push(WATER_NAV_ITEMS[0]);
  }
  return items;
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
            className={`aw-nav-btn ${isActive ? "is-active" : ""}`}
            onClick={() => navigate(item.path)}
          >
            <AppIcon icon={item.icon} />
            <span>{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

export default AdminBottomNav;
