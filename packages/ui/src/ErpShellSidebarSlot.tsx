import type { HTMLAttributes } from "react";

interface ErpShellSidebarSlotProps extends HTMLAttributes<HTMLElement> {
  collapsed?: boolean;
  open?: boolean;
}

export function ErpShellSidebarSlot({
  collapsed = false,
  open = false,
  className,
  children,
  ...props
}: ErpShellSidebarSlotProps) {
  return (
    <aside
      className={[
        "erp-shell-sidebar-slot",
        collapsed ? "is-collapsed" : "",
        open ? "is-open" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      data-erp-shell-region="sidebar"
      {...props}
    >
      {children}
    </aside>
  );
}
