import type { CSSProperties, ReactNode } from "react";
import type { ErpBranding } from "@faako/types";

interface ErpShellFrameProps {
  brand?: ErpBranding;
  layout?: "overlay" | "split";
  className?: string;
  contentClassName?: string;
  sidebarCollapsed?: boolean;
  sidebar?: ReactNode;
  bottomNav?: ReactNode;
  children: ReactNode;
}

const toInlineShellVars = (shellVars: Record<string, string> = {}) => {
  const style: CSSProperties = {};

  Object.entries(shellVars).forEach(([key, value]) => {
    const cssVar = key.startsWith("--") ? key : `--${key}`;
    style[cssVar as keyof CSSProperties] = value;
  });

  return style;
};

export function ErpShellFrame({
  brand,
  layout = "overlay",
  className,
  contentClassName,
  sidebarCollapsed = false,
  sidebar,
  bottomNav,
  children,
}: ErpShellFrameProps) {
  const shellClassName = [
    "erp-shell-frame",
    `erp-shell-frame--${layout}`,
    sidebarCollapsed ? "is-sidebar-collapsed" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const shellContentClassName = [
    "erp-shell-frame__content",
    `erp-shell-frame__content--${layout}`,
    contentClassName,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={shellClassName} style={toInlineShellVars(brand?.shellVars)}>
      {sidebar}
      <div className={shellContentClassName}>{children}</div>
      {bottomNav}
    </div>
  );
}
