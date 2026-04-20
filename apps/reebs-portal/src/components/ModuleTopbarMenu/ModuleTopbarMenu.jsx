import React from "react";
import { Link } from "react-router-dom";
import { AppIcon } from "../Icon/Icon";
import { faEllipsisHorizontal } from "../../icons/iconSet";
import "./ModuleTopbarMenu.css";

export default function ModuleTopbarMenu({
  label = "Module menu",
  title = "Module menu",
  items = [],
  className = "",
}) {
  const safeItems = Array.isArray(items) ? items.filter(Boolean) : [];
  if (!safeItems.length) return null;

  return (
    <details className={`module-topbar-menu${className ? ` ${className}` : ""}`}>
      <summary className="admin-chip inventory-header-action module-topbar-menu__trigger" aria-label={label} title={label}>
        <AppIcon icon={faEllipsisHorizontal} size={16} />
        <span className="sr-only">{label}</span>
      </summary>
      <div className="module-topbar-menu__panel" role="menu" aria-label={label}>
        <p className="module-topbar-menu__title">{title}</p>
        <div className="module-topbar-menu__items">
          {safeItems.map((item) => {
            const content = (
              <>
                {item.icon && (
                  <span className="module-topbar-menu__icon" aria-hidden="true">
                    <AppIcon icon={item.icon} size={16} />
                  </span>
                )}
                <span className="module-topbar-menu__copy">
                  <strong>{item.label}</strong>
                  {item.description && <small>{item.description}</small>}
                </span>
              </>
            );

            if (item.to) {
              return (
                <Link key={item.key || item.to} to={item.to} className="module-topbar-menu__item" role="menuitem">
                  {content}
                </Link>
              );
            }

            return (
              <button
                key={item.key || item.label}
                type="button"
                className="module-topbar-menu__item"
                onClick={item.onClick}
                disabled={item.disabled}
                role="menuitem"
              >
                {content}
              </button>
            );
          })}
        </div>
      </div>
    </details>
  );
}
