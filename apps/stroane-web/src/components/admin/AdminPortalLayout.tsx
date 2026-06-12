import React, { useEffect, useRef, useState, type ReactNode } from "react";
import {
  HiOutlineChevronDown,
  HiOutlineCog,
  HiOutlineDesktopComputer,
  HiOutlineExternalLink,
  HiOutlineHome,
  HiOutlineLogout,
  HiOutlineMoon,
  HiOutlineSun,
  HiOutlineUserCircle,
} from "react-icons/hi";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  ErpBottomNav,
  ErpNavSidebar,
  ErpPageContent,
  ErpShellFrame,
  ErpShellTopbar,
  useSidebarCollapsedState,
} from "@faako/ui";
import { useOnlineStatus, useSyncQueueSummary } from "@faako/offline-sync";
import type { ErpBranding, ErpNavItem } from "@faako/types";
import { useAdminPortal } from "../../context/AdminPortalContext";
import {
  getAdminDisplayName,
  type AdminAppearancePreference,
} from "../../api/adminSession";
import { STOREFRONT_BASE_URL } from "../../config/appSurface";
import {
  STROANE_PORTAL_QUEUE_CHANGED_EVENT,
  STROANE_PORTAL_QUEUE_ORGANIZATION_ID,
  STROANE_PORTAL_QUEUE_SOURCE_APP,
} from "../../offline/portalOfflineQueue";
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
  { id: "profile", label: "Profile", path: "/admin/profile", iconKey: "profile" },
];

const MOBILE_ITEMS = PORTAL_ITEMS;

const PAGE_TITLES: Record<string, string> = {
  "/admin": "Dashboard",
  "/admin/profile": "Profile",
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
  if (iconKey === "profile") return <HiOutlineUserCircle />;
  return <HiOutlineCog />;
};

const APPEARANCE_OPTIONS: Array<{
  value: AdminAppearancePreference;
  label: string;
  icon: ReactNode;
}> = [
  { value: "system", label: "System", icon: <HiOutlineDesktopComputer aria-hidden="true" /> },
  { value: "light", label: "Light", icon: <HiOutlineSun aria-hidden="true" /> },
  { value: "dark", label: "Dark", icon: <HiOutlineMoon aria-hidden="true" /> },
];

const getUserInitials = (displayName?: string) => {
  const parts = displayName?.trim().split(/\s+/).filter(Boolean) || [];
  return parts.map((part) => part[0]).join("").slice(0, 2).toUpperCase() || "U";
};

const AdminPortalLayout: React.FC = () => {
  const { session, signOut, updateProfile } = useAdminPortal();
  const location = useLocation();
  const navigate = useNavigate();
  const isOnline = useOnlineStatus();
  const [savingAppearance, setSavingAppearance] = useState<AdminAppearancePreference | "">("");
  const [sidebarMenuOpen, setSidebarMenuOpen] = useState(false);
  const sidebarMenuRef = useRef<HTMLDivElement | null>(null);
  const { counts: queueCounts, refresh: refreshQueue } = useSyncQueueSummary({
    sourceApp: STROANE_PORTAL_QUEUE_SOURCE_APP,
    organizationId: STROANE_PORTAL_QUEUE_ORGANIZATION_ID,
    actorId: session?.username?.trim().toLowerCase() || "",
    enabled: Boolean(session),
    pollIntervalMs: 3000,
  });
  const [sidebarCollapsed, setSidebarCollapsed] = useSidebarCollapsedState({
    storageKey: "stroane-portal.sidebar-collapsed",
  });
  const displayName = getAdminDisplayName(session);
  const appearancePreference = session?.appearancePreference || "system";
  const userInitials = getUserInitials(displayName || session?.username);

  useEffect(() => {
    document.body.classList.add("stroane-admin-theme");
    return () => {
      document.body.classList.remove("stroane-admin-theme");
      document.body.removeAttribute("data-portal-theme");
      document.body.removeAttribute("data-portal-theme-preference");
      document.documentElement.style.removeProperty("color-scheme");
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const media = window.matchMedia("(prefers-color-scheme: dark)");

    const applyAppearance = () => {
      const resolvedTheme =
        appearancePreference === "system"
          ? media.matches
            ? "dark"
            : "light"
          : appearancePreference;
      document.body.setAttribute("data-portal-theme", resolvedTheme);
      document.body.setAttribute("data-portal-theme-preference", appearancePreference);
      document.documentElement.style.colorScheme = resolvedTheme;
    };

    applyAppearance();
    media.addEventListener("change", applyAppearance);
    return () => media.removeEventListener("change", applyAppearance);
  }, [appearancePreference]);

  useEffect(() => {
    if (!sidebarMenuOpen) return undefined;

    const handlePointerDown = (event: PointerEvent) => {
      if (!sidebarMenuRef.current?.contains(event.target as Node)) {
        setSidebarMenuOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSidebarMenuOpen(false);
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [sidebarMenuOpen]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const handleQueueChanged = () => {
      void refreshQueue();
    };
    window.addEventListener(STROANE_PORTAL_QUEUE_CHANGED_EVENT, handleQueueChanged);
    return () => window.removeEventListener(STROANE_PORTAL_QUEUE_CHANGED_EVENT, handleQueueChanged);
  }, [refreshQueue]);

  const handleSignOut = () => {
    signOut();
    navigate("/login", { replace: true });
  };

  const handleAppearanceChange = async (nextPreference: AdminAppearancePreference) => {
    if (nextPreference === appearancePreference) return;
    setSavingAppearance(nextPreference);
    try {
      await updateProfile({ appearancePreference: nextPreference });
    } finally {
      setSavingAppearance("");
    }
  };

  const avatar = session?.avatarUrl ? (
    <img src={session.avatarUrl} alt="" />
  ) : (
    <span aria-hidden="true">{userInitials}</span>
  );

  const queuedWorkCount = Number(queueCounts?.reviewable || 0);
  const statusLabel = isOnline ? "Live" : "Offline";

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
        <div
          className="stroane-admin-portal__sidebar-footer"
          ref={sidebarMenuRef}
        >
          <button
            type="button"
            className="stroane-admin-portal__sidebar-user-trigger"
            aria-haspopup="menu"
            aria-expanded={sidebarMenuOpen}
            onClick={() => setSidebarMenuOpen((current) => !current)}
          >
            <span className="stroane-admin-portal__sidebar-avatar" aria-hidden="true">
              {avatar}
            </span>
            <span className="stroane-admin-portal__sidebar-user-copy">
              <strong>{displayName || session?.username}</strong>
              <small>{session?.role}</small>
            </span>
            <HiOutlineChevronDown
              aria-hidden="true"
              className={`stroane-admin-portal__sidebar-menu-icon ${sidebarMenuOpen ? "is-open" : ""}`}
            />
          </button>

          {sidebarMenuOpen ? (
            <div className="stroane-admin-portal__sidebar-menu-panel" role="menu">
              <div
                className="stroane-admin-portal__sidebar-appearance-menu"
                aria-label="Appearance"
              >
                <span>Theme</span>
                <div>
                  {APPEARANCE_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      className={option.value === appearancePreference ? "is-active" : ""}
                      aria-pressed={option.value === appearancePreference}
                      onClick={() => void handleAppearanceChange(option.value)}
                      disabled={Boolean(savingAppearance)}
                      title={option.label}
                    >
                      {option.icon}
                      <span>{option.label}</span>
                    </button>
                  ))}
                </div>
              </div>
              <a
                href={STOREFRONT_BASE_URL}
                className="stroane-admin-portal__sidebar-menu-link"
                role="menuitem"
                aria-label="Open storefront"
                title="Open storefront"
              >
                <HiOutlineExternalLink aria-hidden="true" />
                <span>Storefront</span>
              </a>
              <button
                type="button"
                className="stroane-admin-portal__sidebar-menu-link is-danger"
                role="menuitem"
                onClick={handleSignOut}
              >
                <HiOutlineLogout aria-hidden="true" />
                <span>Sign out</span>
              </button>
            </div>
          ) : null}
        </div>
      }
    />
  );

  const topbar = (
    <ErpShellTopbar
      title={PAGE_TITLES[location.pathname] || "Operations portal"}
      actions={
        <span
          className="stroane-admin-portal__status"
          data-status={!isOnline ? "offline" : queuedWorkCount ? "queued" : "live"}
          role="status"
          aria-live="polite"
        >
          <span className="stroane-admin-portal__status-dot" aria-hidden="true" />
          {queuedWorkCount ? `${statusLabel} · ${queuedWorkCount} queued` : statusLabel}
        </span>
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
