import React, { useEffect, type ReactNode } from "react";
import {
  HiOutlineCog,
  HiOutlineExternalLink,
  HiOutlineHome,
  HiOutlineLogout,
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
  shortName: "Stroane Solutions",
  sidebarMarkUrl: "/assets/logos/Emblem_logo-colour.png",
  sidebarTitle: "Portal",
  homePath: "/admin",
  publicUrl: STOREFRONT_BASE_URL,
};

const PORTAL_ITEMS: ErpNavItem[] = [
  { id: "overview", label: "Dashboard", path: "/admin", iconKey: "home" },
];

const MOBILE_ITEMS = PORTAL_ITEMS;

const PAGE_TITLES: Record<string, string> = {
  "/admin": "Dashboard",
  "/admin/inventory": "Module reset",
  "/admin/suppliers": "Module reset",
  "/admin/products": "Module reset",
  "/admin/operations": "Module reset",
  "/admin/orders": "Module reset",
  "/admin/reports": "Module reset",
  "/admin/settings": "Module reset",
};

const renderPortalIcon = (iconKey?: string): ReactNode => {
  if (iconKey === "home") return <HiOutlineHome />;
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
      searchPlaceholder="Search dashboard..."
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
