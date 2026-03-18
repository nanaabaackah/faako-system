import { Link } from "react-router-dom";
import type { ErpNavItem, IconRenderer } from "@faako/types";
import { isPathActive } from "@faako/utils";

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

        return (
          <Link
            key={item.id}
            className={`erp-bottom-nav__button ${isActive ? "is-active" : ""}`}
            to={item.path}
          >
            <span className="erp-bottom-nav__icon" aria-hidden="true">
              {icon}
            </span>
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
