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
      const requests = [
        ["incidents", apiGet("/api/monitoring/incidents?take=100")],
        ["maintenance", apiGet("/api/monitoring/maintenance-windows")],
        ["notifications", apiGet("/api/monitoring/notifications")],
        ...(canManage ? [
          ["rules", apiGet("/api/monitoring/alert-rules")],
          ["channels", apiGet("/api/monitoring/channels")],
          ["policies", apiGet("/api/monitoring/escalation-policies")],
          ["responders", apiGet("/api/monitoring/responders")],
        ] : []),
      ];
      const results = await Promise.allSettled(requests.map(([, request]) => request));
      const payloads = Object.fromEntries(results.map((result, index) => [
        requests[index][0],
        result.status === "fulfilled" ? result.value : null,
      ]));
      const unavailable = results
        .map((result, index) => result.status === "rejected" ? requests[index][0] : null)
        .filter(Boolean);

      setData((current) => ({
        incidents: payloads.incidents?.incidents || current.incidents,
        maintenanceWindows: payloads.maintenance?.maintenanceWindows || current.maintenanceWindows,
        notifications: payloads.notifications?.notifications || current.notifications,
        unreadCount: payloads.notifications?.unreadCount ?? current.unreadCount,
        alertRules: payloads.rules?.alertRules || current.alertRules,
        channels: payloads.channels?.channels || current.channels,
        providerStatus: payloads.channels?.providerStatus || current.providerStatus,
        escalationPolicies: payloads.policies?.escalationPolicies || current.escalationPolicies,
        responders: payloads.responders || current.responders,
      }));
      setError(unavailable.length ? `Some incident tools are temporarily unavailable: ${unavailable.join(", ")}.` : "");
      return payloads.incidents;
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
