import type { HTMLAttributes, ReactNode } from "react";

interface ErpPageHeaderProps extends Omit<HTMLAttributes<HTMLElement>, "title"> {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  metadata?: ReactNode;
}

export function ErpPageHeader({
  eyebrow,
  title,
  description,
  actions,
  metadata,
  className,
  children,
  ...props
}: ErpPageHeaderProps) {
  return (
    <header
      className={["erp-page-header", className].filter(Boolean).join(" ")}
      data-erp-shell-region="page-header"
      {...props}
    >
      <div className="erp-page-header__copy">
        {eyebrow ? <span className="erp-page-header__eyebrow">{eyebrow}</span> : null}
        <h1 className="erp-page-header__title">{title}</h1>
        {description ? <p className="erp-page-header__description">{description}</p> : null}
        {metadata ? <div className="erp-page-header__metadata">{metadata}</div> : null}
      </div>
      {actions || children ? (
        <div className="erp-page-header__actions">
          {actions}
          {children}
        </div>
      ) : null}
    </header>
  );
}
