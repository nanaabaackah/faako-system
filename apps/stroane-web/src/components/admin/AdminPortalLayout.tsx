import React, { useEffect, type ReactNode } from "react";
import {
  HiOutlineChartBar,
  HiOutlineClipboardList,
  HiOutlineCog,
  HiOutlineCube,
  HiOutlineExternalLink,
  HiOutlineHome,
  HiOutlineLogout,
  HiOutlineOfficeBuilding,
  HiOutlineShoppingBag,
} from "react-icons/hi";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  ErpBottomNav,
  ErpNavSidebar,
  ErpPageContent,
  ErpShellFrame,
  ErpShellTopbar,
  useSidebarCollapsedState,
} from "@faako/ui";
import type { ErpBranding, ErpNavItem } from "@faako/types";
import { useAdminPortal } from "../../context/AdminPortalContext";
import { STOREFRONT_BASE_URL } from "../../config/appSurface";
import "../../styles/pages/AdminPortal.css";

const PORTAL_BRAND: ErpBranding = {
  name: "Stroane Operations",
  shortName: "ST",
  sidebarMarkUrl: "/assets/logos/Emblem_logo-colour.png",
  sidebarTitle: "Operations portal",
  homePath: "/admin",
  publicUrl: STOREFRONT_BASE_URL,
};

const PORTAL_ITEMS: ErpNavItem[] = [
  { id: "overview", label: "Overview", path: "/admin", iconKey: "home" },
  { id: "inventory", label: "Inventory", path: "/admin/inventory", iconKey: "inventory" },
  { id: "suppliers", label: "Suppliers", path: "/admin/suppliers", iconKey: "suppliers" },
  { id: "products", label: "Products", path: "/admin/products", iconKey: "products" },
  {
    id: "operations",
    label: "Operations",
    path: "/admin/operations",
    iconKey: "operations",
    matchPaths: ["/admin/orders"],
  },
  { id: "reports", label: "Reports", path: "/admin/reports", iconKey: "reports" },
  { id: "settings", label: "Settings", path: "/admin/settings", iconKey: "settings" },
];

const MOBILE_ITEMS = PORTAL_ITEMS.filter((item) =>
  ["overview", "inventory", "suppliers", "products", "settings"].includes(item.id)
);

const PAGE_TITLES: Record<string, string> = {
  "/admin": "Operations dashboard",
  "/admin/inventory": "Inventory",
  "/admin/suppliers": "Suppliers",
  "/admin/products": "Products",
  "/admin/operations": "Operations",
  "/admin/orders": "Operations",
  "/admin/reports": "Reports",
  "/admin/settings": "Settings",
};

const renderPortalIcon = (iconKey?: string): ReactNode => {
  if (iconKey === "home") return <HiOutlineHome />;
  if (iconKey === "inventory") return <HiOutlineCube />;
  if (iconKey === "suppliers") return <HiOutlineOfficeBuilding />;
  if (iconKey === "products") return <HiOutlineShoppingBag />;
  if (iconKey === "operations") return <HiOutlineClipboardList />;
  if (iconKey === "reports") return <HiOutlineChartBar />;
  return <HiOutlineCog />;
};

const getUserInitials = (username?: string) => {
  const parts = username?.trim().split(/\s+/).filter(Boolean) || [];
  return parts.map((part) => part[0]).join("").slice(0, 2).toUpperCase() || "U";
};

const AdminPortalLayout: React.FC = () => {
  const { session, signOut } = useAdminPortal();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarCollapsed, setSidebarCollapsed] = useSidebarCollapsedState({
    storageKey: "stroane-portal.sidebar-collapsed",
  });

  useEffect(() => {
    document.body.classList.add("stroane-admin-theme");
    return () => document.body.classList.remove("stroane-admin-theme");
  }, []);

  const handleSignOut = () => {
    signOut();
    navigate("/login", { replace: true });
  };

  const sidebar = (
    <ErpNavSidebar
      brand={PORTAL_BRAND}
      items={PORTAL_ITEMS}
      currentPath={location.pathname}
      renderIcon={renderPortalIcon}
      collapsed={sidebarCollapsed}
      onToggleCollapsed={() => setSidebarCollapsed((current) => !current)}
      searchPlaceholder="Search operations..."
      footer={
        <div className="stroane-admin-portal__sidebar-footer">
          <div className="stroane-admin-portal__sidebar-user" title={session?.username}>
            <span className="stroane-admin-portal__sidebar-avatar" aria-hidden="true">
              {getUserInitials(session?.username)}
            </span>
            <span className="stroane-admin-portal__sidebar-user-copy">
              <span>{session?.username}</span>
              <strong>{session?.role}</strong>
            </span>
          </div>
          <a href={STOREFRONT_BASE_URL} aria-label="Open storefront" title="Open storefront">
            <HiOutlineExternalLink aria-hidden="true" />
            <span>Storefront</span>
          </a>
        </div>
      }
    />
  );

  const topbar = (
    <ErpShellTopbar
      eyebrow="Internal operations"
      title={PAGE_TITLES[location.pathname] || "Operations portal"}
      viewer={session?.username}
      actions={
        <button type="button" className="stroane-admin-portal__signout" onClick={handleSignOut}>
          <HiOutlineLogout aria-hidden="true" />
          <span>Sign out</span>
        </button>
      }
    />
  );

  return (
    <ErpShellFrame
      brand={PORTAL_BRAND}
      layout="split"
      className="stroane-admin-portal"
      sidebarCollapsed={sidebarCollapsed}
      sidebar={sidebar}
      topbar={topbar}
      bottomNav={
        <ErpBottomNav
          items={MOBILE_ITEMS}
          currentPath={location.pathname}
          renderIcon={renderPortalIcon}
        />
      }
    >
      <ErpPageContent className="stroane-admin-portal__content">
        <Outlet />
      </ErpPageContent>
    </ErpShellFrame>
  );
};

export default AdminPortalLayout;
