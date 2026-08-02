import { useCallback, useEffect, useState } from "react";
import { apiGet, apiPatch, apiPost } from "../../api/client";

const EMPTY = { incidents: [], maintenanceWindows: [], alertRules: [], channels: [], escalationPolicies: [], responders: { users: [], roles: [] }, notifications: [], unreadCount: 0, providerStatus: {} };

export const useIncidentResponse = ({ enabled = true, canManage = false } = {}) => {
  const [data, setData] = useState(EMPTY);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState("");
  const [acting, setActing] = useState("");
  const [incidentDetail, setIncidentDetail] = useState(null);

  const load = useCallback(async () => {
    if (!enabled) return null;
    setLoading(true);
    try {
      const baseRequests = [apiGet("/api/monitoring/incidents?take=100"), apiGet("/api/monitoring/maintenance-windows"), apiGet("/api/monitoring/notifications")];
      const adminRequests = canManage ? [apiGet("/api/monitoring/alert-rules"), apiGet("/api/monitoring/channels"), apiGet("/api/monitoring/escalation-policies"), apiGet("/api/monitoring/responders")] : [];
      const [incidentPayload, maintenancePayload, notificationPayload, rulesPayload, channelsPayload, policiesPayload, respondersPayload] = await Promise.all([...baseRequests, ...adminRequests]);
      setData({
        incidents: incidentPayload?.incidents || [], maintenanceWindows: maintenancePayload?.maintenanceWindows || [],
        notifications: notificationPayload?.notifications || [], unreadCount: notificationPayload?.unreadCount || 0,
        alertRules: rulesPayload?.alertRules || [], channels: channelsPayload?.channels || [], providerStatus: channelsPayload?.providerStatus || {},
        escalationPolicies: policiesPayload?.escalationPolicies || [],
        responders: respondersPayload || { users: [], roles: [] },
      });
      setError("");
      return incidentPayload;
    } catch (requestError) {
      setError(requestError.message || "Incident response data is unavailable.");
      return null;
    } finally { setLoading(false); }
  }, [canManage, enabled]);

  useEffect(() => { void load(); }, [load]);

  const mutate = useCallback(async (key, request) => {
    setActing(key); setError("");
    try { const result = await request(); if (result?.incident) setIncidentDetail(result.incident); await load(); return result; }
    catch (requestError) { setError(requestError.message || "Incident action failed."); throw requestError; }
    finally { setActing(""); }
  }, [load]);

  return {
    ...data, loading, error, acting, incidentDetail, reload: load,
    openIncident: async (id) => { setActing(`incident-${id}`); try { const payload = await apiGet(`/api/monitoring/incidents/${id}`); setIncidentDetail(payload.incident); return payload.incident; } catch (requestError) { setError(requestError.message || "Incident details are unavailable."); return null; } finally { setActing(""); } },
    closeIncident: () => setIncidentDetail(null),
    acknowledge: (id) => mutate(`incident-${id}`, () => apiPost(`/api/monitoring/incidents/${id}/acknowledge`, {})),
    assign: (id, payload) => mutate(`incident-${id}`, () => apiPost(`/api/monitoring/incidents/${id}/assign`, payload)),
    addNote: (id, note) => mutate(`incident-${id}`, () => apiPost(`/api/monitoring/incidents/${id}/notes`, { note })),
    resolve: (id, resolutionSummary) => mutate(`incident-${id}`, () => apiPost(`/api/monitoring/incidents/${id}/resolve`, { resolutionSummary })),
    close: (id) => mutate(`incident-${id}`, () => apiPost(`/api/monitoring/incidents/${id}/close`, {})),
    reopen: (id, note) => mutate(`incident-${id}`, () => apiPost(`/api/monitoring/incidents/${id}/reopen`, { note })),
    createRule: (payload) => mutate("rule-create", () => apiPost("/api/monitoring/alert-rules", payload)),
    toggleRule: (id, enabledValue) => mutate(`rule-${id}`, () => apiPost(`/api/monitoring/alert-rules/${id}/${enabledValue ? "enable" : "disable"}`, {})),
    createChannel: (payload) => mutate("channel-create", () => apiPost("/api/monitoring/channels", payload)),
    createMaintenance: (payload) => mutate("maintenance-create", () => apiPost("/api/monitoring/maintenance-windows", payload)),
    cancelMaintenance: (id) => mutate(`maintenance-${id}`, () => apiPost(`/api/monitoring/maintenance-windows/${id}/cancel`, {})),
    markNotificationRead: (id) => mutate(`notification-${id}`, () => apiPost(`/api/monitoring/notifications/${id}/read`, {})),
    updateRule: (id, payload) => mutate(`rule-${id}`, () => apiPatch(`/api/monitoring/alert-rules/${id}`, payload)),
  };
};
