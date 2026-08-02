export const filterIncidents = (incidents = [], filters = {}) => incidents.filter((incident) => {
  const search = String(filters.search || "").trim().toLowerCase();
  if (search && !`${incident.id} ${incident.title} ${incident.service?.name || ""} ${incident.assignedUser?.fullName || ""}`.toLowerCase().includes(search)) return false;
  if (filters.status && filters.status !== "all" && incident.status !== filters.status) return false;
  if (filters.severity && filters.severity !== "all" && incident.severity !== filters.severity) return false;
  return true;
});

export const summarizeIncidents = (incidents = []) => ({
  active: incidents.filter((incident) => ["OPEN", "ACKNOWLEDGED"].includes(incident.status)).length,
  unacknowledged: incidents.filter((incident) => incident.status === "OPEN").length,
  critical: incidents.filter((incident) => incident.severity === "CRITICAL" && !["RESOLVED", "CLOSED"].includes(incident.status)).length,
  breached: incidents.filter((incident) => incident.responseBreachedAt || incident.resolutionBreachedAt).length,
});
