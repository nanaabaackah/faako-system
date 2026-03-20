import React from "react";
import * as iconRegistry from "/src/icons/iconSet";

const warnedMissingIcons = new Set();

const isRenderableIconComponent = (value) => {
  if (!value) return false;
  if (typeof value === "function") return true;
  return typeof value === "object" && typeof value.render === "function";
};

const toExportName = (value = "") => {
  const normalized = String(value).trim();
  if (!normalized) return "";
  if (normalized.startsWith("fa") && /[A-Z]/.test(normalized[2] || "")) {
    return normalized;
  }
  const pascal = normalized
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
  return pascal ? `fa${pascal}` : "";
};

const resolveIcon = (iconValue) => {
  if (!iconValue) return null;
  if (isRenderableIconComponent(iconValue)) return iconValue;

  if (typeof iconValue === "string") {
    const resolved = iconRegistry[toExportName(iconValue)];
    return isRenderableIconComponent(resolved) ? resolved : null;
  }

  if (Array.isArray(iconValue) && typeof iconValue[1] === "string") {
    const resolved = iconRegistry[toExportName(iconValue[1])];
    return isRenderableIconComponent(resolved) ? resolved : null;
  }

  if (typeof iconValue === "object") {
    if (typeof iconValue.iconName === "string") {
      const resolved = iconRegistry[toExportName(iconValue.iconName)];
      return isRenderableIconComponent(resolved) ? resolved : null;
    }
    if (typeof iconValue.name === "string") {
      const resolved = iconRegistry[toExportName(iconValue.name)];
      return isRenderableIconComponent(resolved) ? resolved : null;
    }
  }

  return null;
};

export function AppIcon({ icon, className, spin, pulse, ...props }) {
  const IconComponent = resolveIcon(icon);
  if (!IconComponent) {
    if (import.meta.env.DEV) {
      const key = String(icon?.iconName || icon?.name || icon || "unknown");
      if (!warnedMissingIcons.has(key)) {
        warnedMissingIcons.add(key);
        console.warn(`[AppIcon] Unable to resolve icon: ${key}`);
      }
    }
    return null;
  }

  const computedClassName = ["app-icon", className, spin || pulse ? "app-icon-spin" : null]
    .filter(Boolean)
    .join(" ");
  const iconProps = {
    ...props,
    className: computedClassName || undefined,
    color: props.color || "currentColor",
    size: props.size || 20,
  };

  return <IconComponent {...iconProps} />;
}

export default AppIcon;
