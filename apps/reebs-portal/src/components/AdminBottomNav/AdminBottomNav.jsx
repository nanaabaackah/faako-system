import React, { useMemo } from "react";
import "./AdminBottomNav.css";
import { useLocation, useNavigate } from "react-router-dom";
import { AppIcon } from "/src/components/Icon/Icon";
import {
  faBoxesStacked,
  faCloudArrowUp,
  faHome,
  faReceipt,
} from "/src/icons/iconSet";
import { useAuth } from "../AuthContext/AuthContext";

const BASE_NAV_ITEMS = [
  { id: "home", label: "Home", path: "/admin", icon: faHome },
  { id: "inventory", label: "Stock", path: "/admin/inventory", icon: faBoxesStacked },
  { id: "purchases", label: "Buy", path: "/admin/purchases", icon: faReceipt },
  { id: "offline", label: "Sync", path: "/admin/offline", icon: faCloudArrowUp },
];

const WATER_NAV_ITEMS = [{ id: "water", label: "Water", path: "/admin/water", icon: faBoxesStacked }];

const normalizeRole = (value) => String(value || "").trim().toLowerCase();

const normalizePath = (pathname) => {
  if (!pathname) return "/admin";
  const trimmed = pathname.replace(/\/+$/, "");
  return trimmed || "/admin";
};

const getNavItems = (role) => {
  const roleKey = normalizeRole(role);
  if (roleKey === "water") {
    return WATER_NAV_ITEMS;
  }

  const items = [...BASE_NAV_ITEMS];
  if (roleKey === "admin" || roleKey === "manager") {
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
        const isActive =
          normalizedPath === item.path ||
          (item.path !== "/admin" && normalizedPath.startsWith(`${item.path}/`));

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
