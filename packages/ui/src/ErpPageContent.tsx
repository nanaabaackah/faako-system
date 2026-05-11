import { type ElementType, type HTMLAttributes, type ReactNode } from "react";

interface ErpPageContentProps extends HTMLAttributes<HTMLElement> {
  as?: ElementType;
  children?: ReactNode;
}

export function ErpPageContent({
  as: Component = "main",
  className,
  children,
  ...props
}: ErpPageContentProps) {
  return (
    <Component
      className={["erp-page-content", className].filter(Boolean).join(" ")}
      data-erp-shell-region="content"
      {...props}
    >
      {children}
    </Component>
  );
}
