import { useEffect, useMemo, useRef, useState } from "react";
import { ErpStatusBadge, SidebarEdgeToggle } from "@faako/ui";
import { NavLink } from "react-router-dom";
import {
  FiLogOut,
  FiSearch,
  FiUser,
  FiX,
} from "react-icons/fi";

const MOBILE_QUERY = "(max-width: 900px)";

const getSearchShortcutLabel = () => {
  if (typeof navigator === "undefined") return "Ctrl K";
  const platform = navigator.userAgentData?.platform || navigator.platform || "";
  return /Mac|iPhone|iPad|iPod/i.test(platform) ? "Cmd K" : "Ctrl K";
};

const SideNav = ({
  className,
  style,
  isOpen,
  isCollapsed,
  visibleNavItems,
  navNotifications,
  formatNotificationCount,
  currentUser,
  onOpen,
  onClose,
  onToggleCollapsed,
  onExpand,
  onSignOut,
  onTouchStart,
  onTouchMove,
  onTouchEnd,
  onTouchCancel,
}) => {
  const searchFieldRef = useRef(null);
  const pendingSearchFocusRef = useRef(false);
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia(MOBILE_QUERY).matches;
  });
  const [navQuery, setNavQuery] = useState("");
  const isDesktopCollapsed = isCollapsed && !isMobile;

  const displayName =
    currentUser?.fullName ||
    [currentUser?.firstName, currentUser?.lastName].filter(Boolean).join(" ") ||
    currentUser?.email ||
    "Guest";
  const displayEmail = currentUser?.email || "No email available";
  const roleLabel = currentUser?.role?.name || currentUser?.roleName || "Admin workspace";
  const userInitials = displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("") || "GU";
  const searchShortcutLabel = useMemo(() => getSearchShortcutLabel(), []);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const media = window.matchMedia(MOBILE_QUERY);
    const handleChange = () => setIsMobile(media.matches);
    handleChange();
    if (media.addEventListener) {
      media.addEventListener("change", handleChange);
    } else {
      media.addListener(handleChange);
    }
    return () => {
      if (media.removeEventListener) {
        media.removeEventListener("change", handleChange);
      } else {
        media.removeListener(handleChange);
      }
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const handleKeyDown = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        pendingSearchFocusRef.current = true;
        if (isMobile && !isOpen) {
          onOpen?.();
          return;
        }
        if (!isMobile && isCollapsed) {
          onExpand?.();
          return;
        }
        searchFieldRef.current?.focus();
        searchFieldRef.current?.select?.();
        pendingSearchFocusRef.current = false;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isCollapsed, isMobile, isOpen, onExpand, onOpen]);

  useEffect(() => {
    if (!pendingSearchFocusRef.current) return;
    if (isMobile && !isOpen) return;
    if (!isMobile && isCollapsed) return;
    if (typeof window === "undefined") return;
    const frame = window.requestAnimationFrame(() => {
      searchFieldRef.current?.focus();
      searchFieldRef.current?.select?.();
      pendingSearchFocusRef.current = false;
    });
    return () => window.cancelAnimationFrame(frame);
  }, [isCollapsed, isMobile, isOpen]);

  const filteredNavItems = useMemo(() => {
    const term = navQuery.trim().toLowerCase();
    if (!term) return visibleNavItems;
    return visibleNavItems.filter((item) =>
      [item.label, item.to, item.module]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term))
    );
  }, [navQuery, visibleNavItems]);

  const handleSelect = () => {
    if (isMobile) {
      onClose?.();
    }
  };

  const handleSignOutClick = () => {
    onClose?.();
    onSignOut?.();
  };

  return (
    <>
      <aside
        className={[className, isDesktopCollapsed ? "is-collapsed" : ""].filter(Boolean).join(" ")}
        id="erp-sidebar"
        style={style}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchCancel}
      >
        <div className="erp-sidebar__panel">
          <div className="erp-sidebar__header">
            <div className="erp-sidebar__brand">
              <span className="erp-sidebar__brand-mark" aria-hidden="true">
                <img src="/imgs/dev-logo.png" alt="Brand Logo" />
              </span>
              <div className="erp-sidebar__brand-copy">
                <span className="erp-sidebar__brand-kicker">{roleLabel}</span>
                <span className="erp-sidebar__brand-title">Dev control</span>
              </div>
            </div>
            <button
              className="erp-sidebar__close"
              type="button"
              onClick={onClose}
              aria-label="Close navigation"
            >
              <FiX aria-hidden="true" />
            </button>
          </div>

          <label className="erp-sidebar__search" htmlFor="erp-sidebar-search">
            <FiSearch aria-hidden="true" />
            <input
              id="erp-sidebar-search"
              ref={searchFieldRef}
              type="search"
              value={navQuery}
              onChange={(event) => setNavQuery(event.target.value)}
              placeholder="Search modules..."
            />
            <span className="erp-sidebar__search-hint">{searchShortcutLabel}</span>
          </label>

          <nav className="erp-nav" aria-label="Primary admin navigation">
            {filteredNavItems.length > 0 ? (
              filteredNavItems.map((item) => {
                const Icon = item.Icon;
                const count = Number(navNotifications[item.to] || 0);
                const hasNotification = count > 0;
                const moduleBadges = Array.isArray(item.badges) ? item.badges : [];
                const collapsedNavLabel = hasNotification
                  ? `${item.label}, ${count} new`
                  : item.label;

                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.to === "/dashboard"}
                    className={({ isActive }) =>
                      [isActive ? "active" : "", item.enabled === false ? "is-disabled" : ""]
                        .filter(Boolean)
                        .join(" ")
                    }
                    data-module-key={item.key}
                    data-module-group={item.group}
                    data-module-status={item.status}
                    data-module-state={item.state}
                    data-module-visibility={item.visibility}
                    data-module-status-label={item.statusLabel}
                    onClick={handleSelect}
                    title={isDesktopCollapsed ? collapsedNavLabel : undefined}
                    aria-label={isDesktopCollapsed ? collapsedNavLabel : undefined}
                  >
                    <span className="nav-link-main">
                      <Icon
                        size={18}
                        color="currentColor"
                        variant="Linear"
                        className="nav-icon"
                        aria-hidden="true"
                      />
                      <span className="nav-link-label">
                        <span>{item.label}</span>
                        {moduleBadges.length > 0 ? (
                          <span className="nav-module-badges" aria-label="Module state">
                            {moduleBadges.map((badge) => (
                              <ErpStatusBadge key={badge.key} badge={badge} className="nav-module-badge" />
                            ))}
                          </span>
                        ) : null}
                      </span>
                    </span>
                    {hasNotification ? (
                      <span
                        className="nav-badge"
                        aria-label={`${count} new ${item.label.toLowerCase()}`}
                      >
                        {formatNotificationCount(count)}
                      </span>
                    ) : null}
                  </NavLink>
                );
              })
            ) : (
              <p className="erp-sidebar__empty" role="status" aria-live="polite">
                No modules match "{navQuery.trim()}".
              </p>
            )}
          </nav>

          <div className="erp-sidebar__footer">
            <button
              className="erp-sidebar__cta"
              type="button"
              onClick={handleSignOutClick}
              title={isDesktopCollapsed ? "Sign out" : undefined}
              aria-label={isDesktopCollapsed ? "Sign out" : undefined}
            >
              <FiLogOut aria-hidden="true" />
              <span>Sign out</span>
            </button>
            <NavLink
              to="/profile"
              className="erp-sidebar__profile"
              onClick={handleSelect}
              title={isDesktopCollapsed ? displayName : undefined}
              aria-label={isDesktopCollapsed ? `Profile for ${displayName}` : undefined}
            >
              <span className="erp-sidebar__avatar" aria-hidden="true">
                {userInitials}
              </span>
              <span className="erp-sidebar__profile-copy">
                <span className="erp-sidebar__profile-name">{displayName}</span>
                <span className="erp-sidebar__profile-email">{displayEmail}</span>
              </span>
              <FiUser className="erp-sidebar__profile-icon" aria-hidden="true" />
            </NavLink>
          </div>
        </div>
        {!isMobile ? (
          <SidebarEdgeToggle
            onClick={onToggleCollapsed}
            collapsed={isDesktopCollapsed}
          />
        ) : null}
      </aside>
      <button
        className={`nav-scrim ${isOpen ? "is-open" : ""}`}
        type="button"
        aria-label="Close navigation"
        onClick={onClose}
      />
    </>
  );
};

export default SideNav;
