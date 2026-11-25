import { Fragment, useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import type { ErpBranding, ErpNavItem } from "@faako/types";
import { isPathActive } from "@faako/utils";
import { SidebarEdgeToggle } from "./SidebarEdgeToggle";
import { ErpStatusBadge } from "./ErpStatusBadge";
import type { IconRenderer } from "./types";

interface ErpNavSidebarProps {
  brand: ErpBranding;
  items: ErpNavItem[];
  currentPath: string;
  renderIcon?: IconRenderer;
  footer?: ReactNode;
  fallbackPath?: string;
  searchPlaceholder?: string;
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
  /** Controlled apps may use their existing guarded navigation instead of Router links. */
  onNavigate?: (path: string) => void;
  renderContext?: (item: ErpNavItem) => ReactNode;
  hideBrandEyebrow?: boolean;
  navLabel?: string;
  className?: string;
}

const DESKTOP_QUERY = "(min-width: 901px)";

const renderFallbackIcon = (label: string, iconKey?: string) => {
  const basis = (iconKey || label).replace(/[^a-z0-9]/gi, "").toUpperCase();
  return basis.slice(0, 2) || "ER";
};

const renderBrandMark = (brand: ErpBranding) => {
  const basis = (brand.shortName || brand.name).replace(/[^a-z0-9]/gi, "").toUpperCase();
  return basis.slice(0, 2) || "ER";
};

const getSearchShortcutLabel = () => {
  if (typeof navigator === "undefined") return "Ctrl K";
  const platform =
    (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData
      ?.platform ||
    navigator.platform ||
    "";
  return /Mac|iPhone|iPad|iPod/i.test(platform) ? "Cmd K" : "Ctrl K";
};

const matchesDesktop = () => {
  if (typeof window === "undefined") return true;
  return window.matchMedia(DESKTOP_QUERY).matches;
};

export function ErpNavSidebar({
  brand,
  items,
  currentPath,
  renderIcon,
  footer,
  fallbackPath = "/",
  searchPlaceholder = "Search modules...",
  collapsed = false,
  onToggleCollapsed,
  onNavigate,
  renderContext,
  hideBrandEyebrow = false,
  navLabel,
  className,
}: ErpNavSidebarProps) {
  const searchFieldId = useId();
  const searchFieldRef = useRef<HTMLInputElement | null>(null);
  const pendingSearchFocusRef = useRef(false);
  const [navQuery, setNavQuery] = useState("");
  const brandMark = useMemo(() => renderBrandMark(brand), [brand]);
  const searchShortcutLabel = useMemo(() => getSearchShortcutLabel(), []);
  const filteredItems = useMemo(() => {
    const term = navQuery.trim().toLowerCase();
    if (!term) return items;

    return items.filter((item) =>
      [item.label, item.description, item.path, item.iconKey]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term)),
    );
  }, [items, navQuery]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (!matchesDesktop()) return;
      if (!(event.metaKey || event.ctrlKey)) return;
      if (event.key.toLowerCase() !== "k") return;

      event.preventDefault();
      if (collapsed && onToggleCollapsed) {
        pendingSearchFocusRef.current = true;
        onToggleCollapsed();
        return;
      }
      searchFieldRef.current?.focus();
      searchFieldRef.current?.select();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [collapsed, onToggleCollapsed]);

  useEffect(() => {
    if (!pendingSearchFocusRef.current || collapsed) return;
    if (typeof window === "undefined") return undefined;

    const frame = window.requestAnimationFrame(() => {
      searchFieldRef.current?.focus();
      searchFieldRef.current?.select();
      pendingSearchFocusRef.current = false;
    });

    return () => window.cancelAnimationFrame(frame);
  }, [collapsed]);

  const brandContent = (
    <>
      <span className="erp-nav-sidebar__brand-mark" aria-hidden="true">
        {brand.sidebarMarkUrl ? (
          <img className="erp-nav-sidebar__brand-mark-image" src={brand.sidebarMarkUrl} alt="" />
        ) : brandMark}
      </span>
      <span className="erp-nav-sidebar__brand-copy">
        {!hideBrandEyebrow && <span className="erp-nav-sidebar__eyebrow">{brand.shortName || "ERP"}</span>}
        <span className="erp-nav-sidebar__title">{brand.sidebarTitle || brand.name}</span>
      </span>
    </>
  );
  return (
    <aside className={["erp-nav-sidebar", collapsed ? "is-collapsed" : "", className].filter(Boolean).join(" ")}>
      <div className="erp-nav-sidebar__panel">
        <div className="erp-nav-sidebar__header">
          {onNavigate ? (
            <button type="button" className="erp-nav-sidebar__brand-link"
              aria-label={brand.sidebarTitle || brand.name}
              onClick={() => onNavigate(brand.homePath || fallbackPath)}>
              {brandContent}
            </button>
          ) : (
            <Link className="erp-nav-sidebar__brand-link" to={brand.homePath || fallbackPath}
              title={collapsed ? brand.sidebarTitle || brand.name : undefined}
              aria-label={collapsed ? brand.sidebarTitle || brand.name : undefined}>
              {brandContent}
            </Link>
          )}
        </div>

        <label className="erp-nav-sidebar__search" htmlFor={searchFieldId}>
          <span className="erp-nav-sidebar__search-icon" aria-hidden="true">
            <svg viewBox="0 0 20 20" fill="none" focusable="false">
              <circle cx="9" cy="9" r="5" stroke="currentColor" strokeWidth="1.8" />
              <path d="M12.5 12.5L16 16" stroke="currentColor" strokeWidth="1.8" />
            </svg>
          </span>
          <input
            ref={searchFieldRef}
            className="erp-nav-sidebar__search-input"
            id={searchFieldId}
            type="search"
            value={navQuery}
            onChange={(event) => setNavQuery(event.target.value)}
            placeholder={searchPlaceholder}
          />
          <span className="erp-nav-sidebar__search-hint" aria-hidden="true">
            {searchShortcutLabel}
          </span>
        </label>

        <nav className="erp-nav-sidebar__nav" aria-label={navLabel || `${brand.name} navigation`}>
          {filteredItems.length > 0 ? (
            filteredItems.map((item) => {
              const isActive = isPathActive(currentPath, item, fallbackPath);
              const icon = renderIcon
                ? renderIcon(item.iconKey, item.label)
                : renderFallbackIcon(item.label, item.iconKey);
              const itemLabel =
                item.description && collapsed ? `${item.label}: ${item.description}` : item.label;
              const badges = Array.isArray(item.badges) ? item.badges : [];
              const linkClassName = [
                "erp-nav-sidebar__link",
                isActive ? "is-active" : "",
                item.enabled === false ? "is-disabled" : "",
              ].filter(Boolean).join(" ");

              const content = (
                <span className="erp-nav-sidebar__link-main">
                  <span className="erp-nav-sidebar__icon" aria-hidden="true">
                    {icon}
                  </span>
                  <span className="erp-nav-sidebar__copy">
                    <span className="erp-nav-sidebar__label-row">
                      <span className="erp-nav-sidebar__label">{item.label}</span>
                      {badges.length > 0 ? (
                        <span className="erp-nav-sidebar__badges" aria-label="Module state">
                          {badges.map((badge) => (
                            <ErpStatusBadge key={badge.key} badge={badge} />
                          ))}
                        </span>
                      ) : null}
                    </span>
                    {item.description ? (
                      <span className="erp-nav-sidebar__description">{item.description}</span>
                    ) : null}
                  </span>
                </span>
              );

              if (item.external) {
                return (
                  <a
                    key={item.id}
                    className={linkClassName}
                    href={item.path}
                    rel="noreferrer"
                    target="_blank"
                    data-module-group={item.group}
                    data-module-status={item.status}
                    data-module-state={item.state}
                    data-module-visibility={item.visibility}
                    data-module-status-label={item.statusLabel}
                    title={collapsed ? itemLabel : undefined}
                    aria-label={collapsed ? itemLabel : undefined}
                  >
                    {content}
                  </a>
                );
              }

              if (onNavigate) {
                return (
                  <Fragment key={item.id}>
                    <button type="button" className={linkClassName}
                      disabled={item.enabled === false}
                      aria-label={item.label} title={collapsed ? itemLabel : undefined}
                      aria-current={isActive ? "page" : undefined}
                      onClick={() => onNavigate(item.path)}>
                      {content}
                    </button>
                    {isActive && !collapsed ? renderContext?.(item) : null}
                  </Fragment>
                );
              }

              return (
                <Link
                  key={item.id}
                  className={linkClassName}
                  to={item.path}
                  data-module-group={item.group}
                  data-module-status={item.status}
                  data-module-state={item.state}
                  data-module-visibility={item.visibility}
                  data-module-status-label={item.statusLabel}
                  title={collapsed ? itemLabel : undefined}
                  aria-label={collapsed ? itemLabel : undefined}
                >
                  {content}
                </Link>
              );
            })
          ) : (
            <p className="erp-nav-sidebar__empty" role="status" aria-live="polite">
              No modules match "{navQuery.trim()}".
            </p>
          )}
        </nav>

        {footer ? <div className="erp-nav-sidebar__footer">{footer}</div> : null}
      </div>
      {onToggleCollapsed ? (
        <SidebarEdgeToggle
          collapsed={collapsed}
          onClick={onToggleCollapsed}
          expandedLabel="Collapse navigation"
          collapsedLabel="Expand navigation"
        />
      ) : null}
    </aside>
  );
}
