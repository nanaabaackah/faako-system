import { Link } from "react-router-dom";
import type { ErpNavItem } from "@faako/types";
import { isPathActive } from "@faako/utils";
import { ErpStatusBadge } from "./ErpStatusBadge";
import type { IconRenderer } from "./types";

interface ErpBottomNavProps {
  items: ErpNavItem[];
  currentPath: string;
  renderIcon?: IconRenderer;
  fallbackPath?: string;
}

const renderFallbackIcon = (label: string, iconKey?: string) => {
  const basis = (iconKey || label).replace(/[^a-z0-9]/gi, "").toUpperCase();
  return basis.slice(0, 2) || "ER";
};

export function ErpBottomNav({
  items,
  currentPath,
  renderIcon,
  fallbackPath = "/",
}: ErpBottomNavProps) {
  if (!items.length) return null;

  return (
    <nav className="erp-bottom-nav" aria-label="Primary mobile navigation">
      {items.map((item) => {
        const isActive = isPathActive(currentPath, item, fallbackPath);
        const icon = renderIcon
          ? renderIcon(item.iconKey, item.label)
          : renderFallbackIcon(item.label, item.iconKey);
        const badges = Array.isArray(item.badges) ? item.badges : [];

        return (
          <Link
            key={item.id}
            className={[
              "erp-bottom-nav__button",
              isActive ? "is-active" : "",
              item.enabled === false ? "is-disabled" : "",
            ].filter(Boolean).join(" ")}
            to={item.path}
            data-module-group={item.group}
            data-module-status={item.status}
            data-module-state={item.state}
            data-module-visibility={item.visibility}
            data-module-status-label={item.statusLabel}
          >
            <span className="erp-bottom-nav__icon" aria-hidden="true">
              {icon}
            </span>
            <span className="erp-bottom-nav__label">
              <span>{item.label}</span>
              {badges.length > 0 ? (
                <span className="erp-bottom-nav__badges" aria-label="Module state">
                  {badges.map((badge) => (
                    <ErpStatusBadge key={badge.key} badge={badge} />
                  ))}
                </span>
              ) : null}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
