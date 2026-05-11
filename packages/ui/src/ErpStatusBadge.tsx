import type { HTMLAttributes } from "react";

interface ErpStatusBadgeProps extends HTMLAttributes<HTMLSpanElement> {
  badge?: {
    key?: string;
    label?: string;
  };
  status?: string;
  label?: string;
}

const normalizeBadgeKey = (value: string | undefined) =>
  String(value || "stable").trim().toLowerCase().replace(/\s+/g, "_");

const toBadgeLabel = (value: string) => value.replace(/_/g, " ");

export function ErpStatusBadge({
  badge,
  status,
  label,
  className,
  ...props
}: ErpStatusBadgeProps) {
  const key = normalizeBadgeKey(badge?.key || status);
  const resolvedLabel = badge?.label || label || toBadgeLabel(key);

  return (
    <span
      className={[
        "erp-status-badge",
        "erp-module-badge",
        `erp-status-badge--${key}`,
        `erp-module-badge--${key}`,
        `is-${key}`,
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      data-erp-status={key}
      {...props}
    >
      {resolvedLabel}
    </span>
  );
}
