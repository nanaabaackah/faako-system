import {
  forwardRef,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type ReactNode,
} from "react";

const joinClasses = (...values: Array<string | false | null | undefined>) =>
  values.filter(Boolean).join(" ");

type ERPActionAlign = "start" | "end" | "between" | "center";
type ERPActionSize = "sm" | "md" | "lg";

export function ERPActionBar({
  className = "",
  align = "end",
  children,
  ...props
}: HTMLAttributes<HTMLDivElement> & {
  align?: ERPActionAlign;
}) {
  return (
    <div className={joinClasses("ui-erp-action-bar", `ui-erp-action-bar--${align}`, className)} {...props}>
      {children}
    </div>
  );
}

export function ERPButtonGroup({
  className = "",
  children,
  "aria-label": ariaLabel = "Action group",
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={joinClasses("ui-erp-button-group", className)} role="group" aria-label={ariaLabel} {...props}>
      {children}
    </div>
  );
}

type ERPActionProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  loading?: boolean;
  loadingLabel?: ReactNode;
  icon?: ReactNode;
  trailingIcon?: ReactNode;
  size?: ERPActionSize;
};

function ERPActionContent({
  children,
  icon,
  trailingIcon,
  loading,
  loadingLabel,
}: {
  children?: ReactNode;
  icon?: ReactNode;
  trailingIcon?: ReactNode;
  loading?: boolean;
  loadingLabel?: ReactNode;
}) {
  return (
    <>
      {loading ? <span className="ui-erp-action__spinner" aria-hidden="true" /> : icon ? (
        <span className="ui-erp-action__icon" aria-hidden="true">
          {icon}
        </span>
      ) : null}
      <span className="ui-erp-action__label">{loading && loadingLabel ? loadingLabel : children}</span>
      {trailingIcon ? (
        <span className="ui-erp-action__icon" aria-hidden="true">
          {trailingIcon}
        </span>
      ) : null}
    </>
  );
}

function createActionComponent(tone: "primary" | "secondary" | "danger") {
  return forwardRef<HTMLButtonElement, ERPActionProps>(function ERPAction(
    {
      className = "",
      type = "button",
      loading = false,
      loadingLabel,
      disabled = false,
      icon,
      trailingIcon,
      size = "md",
      children,
      ...props
    },
    ref,
  ) {
    return (
      <button
        ref={ref}
        type={type}
        className={joinClasses(
          "ui-erp-action",
          `ui-erp-action--${tone}`,
          `ui-erp-action--${size}`,
          loading && "is-loading",
          className,
        )}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        {...props}
      >
        <ERPActionContent
          icon={icon}
          trailingIcon={trailingIcon}
          loading={loading}
          loadingLabel={loadingLabel}
        >
          {children}
        </ERPActionContent>
      </button>
    );
  });
}

export const ERPPrimaryAction = createActionComponent("primary");
export const ERPSecondaryAction = createActionComponent("secondary");
export const ERPDangerAction = createActionComponent("danger");

export const ERPIconAction = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & {
    label?: string;
    loading?: boolean;
    tone?: "default" | "primary" | "danger";
    size?: ERPActionSize;
  }
>(function ERPIconAction(
  {
    className = "",
    type = "button",
    label,
    loading = false,
    disabled = false,
    tone = "default",
    size = "md",
    children,
    "aria-label": ariaLabel,
    ...props
  },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={joinClasses(
        "ui-erp-icon-action",
        `ui-erp-icon-action--${tone}`,
        `ui-erp-icon-action--${size}`,
        loading && "is-loading",
        className,
      )}
      disabled={disabled || loading}
      aria-label={ariaLabel || label}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? <span className="ui-erp-action__spinner" aria-hidden="true" /> : children}
    </button>
  );
});
