import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import type { ErpBranding, ErpNavItem, IconRenderer } from "@faako/types";
import { isPathActive } from "@faako/utils";

interface ErpNavSidebarProps {
  brand: ErpBranding;
  items: ErpNavItem[];
  currentPath: string;
  renderIcon?: IconRenderer;
  footer?: ReactNode;
  fallbackPath?: string;
}

const renderFallbackIcon = (label: string, iconKey?: string) => {
  const basis = (iconKey || label).replace(/[^a-z0-9]/gi, "").toUpperCase();
  return basis.slice(0, 2) || "ER";
};

export function ErpNavSidebar({
  brand,
  items,
  currentPath,
  renderIcon,
  footer,
  fallbackPath = "/",
}: ErpNavSidebarProps) {
  return (
    <aside className="erp-nav-sidebar">
      <div className="erp-nav-sidebar__brand">
        <span className="erp-nav-sidebar__eyebrow">{brand.shortName || "ERP"}</span>
        <Link className="erp-nav-sidebar__brand-link" to={brand.homePath || fallbackPath}>
          <div className="erp-nav-sidebar__title">{brand.sidebarTitle || brand.name}</div>
        </Link>
      </div>

      <nav className="erp-nav-sidebar__nav" aria-label={`${brand.name} navigation`}>
        {items.map((item) => {
          const isActive = isPathActive(currentPath, item, fallbackPath);
          const icon = renderIcon
            ? renderIcon(item.iconKey, item.label)
            : renderFallbackIcon(item.label, item.iconKey);

          const content = (
            <>
              <span className="erp-nav-sidebar__icon" aria-hidden="true">
                {icon}
              </span>
              <span>
                <span className="erp-nav-sidebar__label">{item.label}</span>
                {item.description ? (
                  <span className="erp-nav-sidebar__description">{item.description}</span>
                ) : null}
              </span>
            </>
          );

          if (item.external) {
            return (
              <a
                key={item.id}
                className="erp-nav-sidebar__link"
                href={item.path}
                rel="noreferrer"
                target="_blank"
              >
                {content}
              </a>
            );
          }

          return (
            <Link
              key={item.id}
              className={`erp-nav-sidebar__link ${isActive ? "is-active" : ""}`}
              to={item.path}
            >
              {content}
            </Link>
          );
        })}
      </nav>

      {footer ? <div className="erp-nav-sidebar__footer">{footer}</div> : null}
    </aside>
  );
}
