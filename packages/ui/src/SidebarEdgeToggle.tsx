import type { ButtonHTMLAttributes } from "react";

interface SidebarEdgeToggleProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "aria-label" | "title" | "type"> {
  collapsed: boolean;
  collapsedLabel?: string;
  expandedLabel?: string;
}

export function SidebarEdgeToggle({
  collapsed,
  collapsedLabel = "Expand navigation",
  expandedLabel = "Collapse navigation",
  className,
  ...buttonProps
}: SidebarEdgeToggleProps) {
  const buttonLabel = collapsed ? collapsedLabel : expandedLabel;

  return (
    <button
      {...buttonProps}
      type="button"
      className={["ui-sidebar-edge-toggle", className].filter(Boolean).join(" ")}
      aria-label={buttonLabel}
      title={buttonLabel}
    >
      <span className="ui-sidebar-edge-toggle__icon" aria-hidden="true">
        <svg viewBox="0 0 16 16" fill="none" focusable="false">
          {collapsed ? (
            <path d="M6 3.5 10.5 8 6 12.5" />
          ) : (
            <path d="M10 3.5 5.5 8 10 12.5" />
          )}
        </svg>
      </span>
    </button>
  );
}
