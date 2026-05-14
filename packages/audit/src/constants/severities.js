export const AUDIT_SEVERITIES = Object.freeze({
  INFO: "info",
  WARNING: "warning",
  ERROR: "error",
  CRITICAL: "critical",
});

export const AUDIT_SEVERITY_LABELS = Object.freeze({
  [AUDIT_SEVERITIES.INFO]: "Info",
  [AUDIT_SEVERITIES.WARNING]: "Warning",
  [AUDIT_SEVERITIES.ERROR]: "Error",
  [AUDIT_SEVERITIES.CRITICAL]: "Critical",
});
