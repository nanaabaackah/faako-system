import { forwardRef, type HTMLAttributes } from "react";

interface ErpMobileBottomNavFrameProps extends HTMLAttributes<HTMLElement> {
  ariaLabel?: string;
}

export const ErpMobileBottomNavFrame = forwardRef<HTMLElement, ErpMobileBottomNavFrameProps>(
  ({ ariaLabel = "Primary mobile navigation", className, children, ...props }, ref) => (
    <nav
      ref={ref}
      className={["erp-mobile-bottom-nav-frame", className].filter(Boolean).join(" ")}
      aria-label={ariaLabel}
      data-erp-shell-region="mobile-nav"
      {...props}
    >
      {children}
    </nav>
  ),
);

ErpMobileBottomNavFrame.displayName = "ErpMobileBottomNavFrame";
