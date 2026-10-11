import React from "react";

export function AppIcon({ icon: Icon, className = "", spin = false, pulse = false, ...props }) {
  if (!Icon) return null;
  return (
    <Icon
      {...props}
      className={["app-icon", className, spin || pulse ? "app-icon-spin" : ""]
        .filter(Boolean)
        .join(" ")}
      color={props.color || "currentColor"}
      size={props.size || 20}
      aria-hidden={props["aria-hidden"] ?? true}
    />
  );
}

export default AppIcon;
