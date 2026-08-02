export const INCIDENT_CAPABILITIES = Object.freeze({
  VIEW: "INCIDENT_VIEW",
  ACKNOWLEDGE: "INCIDENT_ACKNOWLEDGE",
  ASSIGN: "INCIDENT_ASSIGN",
  UPDATE: "INCIDENT_UPDATE",
  RESOLVE: "INCIDENT_RESOLVE",
  EXPORT: "INCIDENT_EXPORT",
  ALERT_RULE_MANAGE: "ALERT_RULE_MANAGE",
  ALERT_CHANNEL_MANAGE: "ALERT_CHANNEL_MANAGE",
  ESCALATION_POLICY_MANAGE: "ESCALATION_POLICY_MANAGE",
  MAINTENANCE_WINDOW_MANAGE: "MAINTENANCE_WINDOW_MANAGE",
  PLATFORM_VIEW: "PLATFORM_INCIDENT_VIEW",
  PLATFORM_MANAGE: "PLATFORM_INCIDENT_MANAGE",
});

export const INCIDENT_TRANSITIONS = Object.freeze({
  OPEN: new Set(["ACKNOWLEDGED", "RESOLVED"]),
  ACKNOWLEDGED: new Set(["RESOLVED"]),
  RESOLVED: new Set(["CLOSED", "OPEN"]),
  CLOSED: new Set(["OPEN"]),
});

export const getUserCapabilities = (user) => {
  const source = user?.role?.permissions?.capabilities ?? user?.permissions?.capabilities ?? user?.capabilities ?? [];
  return new Set(Array.isArray(source) ? source.map((value) => String(value || "").trim().toUpperCase()).filter(Boolean) : []);
};

export const hasIncidentCapability = (user, capability) => (
  user?.roleName === "Admin" || user?.role?.name === "Admin" || getUserCapabilities(user).has(capability)
);

export const createRequireIncidentCapability = (capability) => (req, res, next) => {
  if (!hasIncidentCapability(req.user, capability)) {
    return res.status(403).json({ error: "You do not have permission to perform this incident action.", requiredCapability: capability });
  }
  return next();
};
