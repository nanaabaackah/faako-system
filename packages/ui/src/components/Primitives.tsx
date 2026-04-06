import type {
  ButtonHTMLAttributes,
  HTMLAttributes,
  PropsWithChildren,
  ReactNode,
} from "react";
import { forwardRef } from "react";

const joinClasses = (...values: Array<string | false | null | undefined>) =>
  values.filter(Boolean).join(" ");

export function PageShell({
  className = "",
  children,
  ...props
}: HTMLAttributes<HTMLElement>) {
  return (
    <main className={joinClasses("ui-page-shell", className)} {...props}>
      {children}
    </main>
  );
}

export function PageHeader({
  className = "",
  copyClassName = "",
  actionsClassName = "ui-page-header__actions",
  eyebrow = "",
  eyebrowClassName = "ui-page-header__eyebrow",
  title,
  titleClassName = "",
  subtitle = "",
  subtitleClassName = "ui-page-header__subtitle",
  children = null,
  actions = null,
}: {
  className?: string;
  copyClassName?: string;
  actionsClassName?: string;
  eyebrow?: string;
  eyebrowClassName?: string;
  title?: ReactNode;
  titleClassName?: string;
  subtitle?: ReactNode;
  subtitleClassName?: string;
  children?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className={joinClasses("ui-page-header", className)}>
      <div className={copyClassName || undefined}>
        {eyebrow ? <p className={eyebrowClassName}>{eyebrow}</p> : null}
        {title ? <h1 className={titleClassName || undefined}>{title}</h1> : null}
        {subtitle ? <p className={subtitleClassName}>{subtitle}</p> : null}
        {children}
      </div>
      {actions ? <div className={actionsClassName || undefined}>{actions}</div> : null}
    </header>
  );
}

export function Card({
  className = "",
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <section className={joinClasses("ui-card", className)} {...props}>
      {children}
    </section>
  );
}

export const Button = forwardRef<
  HTMLButtonElement,
  PropsWithChildren<
    ButtonHTMLAttributes<HTMLButtonElement> & {
      variant?: "primary" | "secondary" | "ghost" | "danger";
    }
  >
>(function Button({ className = "", variant = "secondary", children, ...props }, ref) {
  return (
    <button
      ref={ref}
      className={joinClasses("ui-button", `ui-button--${variant}`, className)}
      {...props}
    >
      {children}
    </button>
  );
});

export const IconButton = forwardRef<
  HTMLButtonElement,
  PropsWithChildren<
    ButtonHTMLAttributes<HTMLButtonElement> & {
      tone?: "default" | "accent" | "danger";
    }
  >
>(function IconButton({ className = "", tone = "default", children, ...props }, ref) {
  return (
    <button
      ref={ref}
      className={joinClasses("ui-icon-button", `ui-icon-button--${tone}`, className)}
      {...props}
    >
      {children}
    </button>
  );
});

export function FilterBar({
  className = "",
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={joinClasses("ui-filter-bar", className)} {...props}>
      {children}
    </div>
  );
}

export function StatusPill({
  className = "",
  tone = "neutral",
  children,
}: PropsWithChildren<{
  className?: string;
  tone?: "neutral" | "success" | "warning" | "danger" | "info";
}>) {
  return (
    <span className={joinClasses("ui-status-pill", `ui-status-pill--${tone}`, className)}>
      {children}
    </span>
  );
}

export function KpiCard({
  className = "",
  label,
  value,
  detail,
  tone = "neutral",
}: {
  className?: string;
  label: ReactNode;
  value: ReactNode;
  detail?: ReactNode;
  tone?: "neutral" | "success" | "warning" | "danger" | "info";
}) {
  return (
    <Card className={joinClasses("ui-kpi-card", className)}>
      <span className="ui-kpi-card__label">{label}</span>
      <strong className="ui-kpi-card__value">{value}</strong>
      {detail ? (
        <span className={joinClasses("ui-kpi-card__detail", `is-${tone}`)}>{detail}</span>
      ) : null}
    </Card>
  );
}

export function EmptyState({
  className = "",
  title,
  message = "",
  actions = null,
}: {
  className?: string;
  title: ReactNode;
  message?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className={joinClasses("ui-empty-state", className)}>
      <strong className="ui-empty-state__title">{title}</strong>
      {message ? <p className="ui-empty-state__message">{message}</p> : null}
      {actions ? <div className="ui-empty-state__actions">{actions}</div> : null}
    </div>
  );
}

export function ModalFrame({
  className = "",
  title,
  subtitle = "",
  actions = null,
  children,
}: PropsWithChildren<{
  className?: string;
  title?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
}>) {
  return (
    <div className="ui-modal-frame">
      <div className={joinClasses("ui-modal-frame__panel", className)}>
        {(title || subtitle || actions) ? (
          <header className="ui-modal-frame__header">
            <div>
              {title ? <h2>{title}</h2> : null}
              {subtitle ? <p>{subtitle}</p> : null}
            </div>
            {actions ? <div className="ui-modal-frame__actions">{actions}</div> : null}
          </header>
        ) : null}
        <div className="ui-modal-frame__body">{children}</div>
      </div>
    </div>
  );
}
