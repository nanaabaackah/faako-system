export const ERP_MODULE_VISIBILITY = Object.freeze({
  VISIBLE: "visible",
  HIDDEN: "hidden",
  INTERNAL: "internal",
});

export const ERP_MODULE_STATES = Object.freeze({
  ENABLED: "enabled",
  DISABLED: "disabled",
  COMING_SOON: "coming_soon",
  EXPERIMENTAL: "experimental",
});

export const ERP_MODULE_VISIBILITY_LABELS = Object.freeze({
  [ERP_MODULE_VISIBILITY.VISIBLE]: "Visible",
  [ERP_MODULE_VISIBILITY.HIDDEN]: "Hidden",
  [ERP_MODULE_VISIBILITY.INTERNAL]: "Internal",
});

export const ERP_MODULE_STATE_LABELS = Object.freeze({
  [ERP_MODULE_STATES.ENABLED]: "Enabled",
  [ERP_MODULE_STATES.DISABLED]: "Disabled",
  [ERP_MODULE_STATES.COMING_SOON]: "Coming soon",
  [ERP_MODULE_STATES.EXPERIMENTAL]: "Experimental",
});
