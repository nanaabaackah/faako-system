import { apiPath } from "../../api/config";
import type { AdminSession } from "./adminSession";

const parseJsonResponse = async <T>(response: Response, fallbackMessage: string): Promise<T> => {
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      body && typeof body === "object" && "error" in body && typeof body.error === "string"
        ? body.error
        : fallbackMessage;
    throw new Error(message);
  }
  if (!body) throw new Error(fallbackMessage);
  return body as T;
};

const authRequest = (_session: AdminSession): RequestInit => ({
  credentials: "include",
});

const withQuery = (path: string, filters: object = {}) => {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== "") params.set(key, String(value));
  });
  const query = params.toString();
  return apiPath(`${path}${query ? `?${query}` : ""}`);
};

export type AdminAuditLogSource =
  | ""
  | "inventory"
  | "orders"
  | "payments"
  | "receipts"
  | "accounting"
  | "crm"
  | "team";

export type AdminAuditLogRange = "24h" | "7d" | "30d" | "90d" | "all";

export interface AdminAuditLogFilters {
  range?: AdminAuditLogRange;
  source?: AdminAuditLogSource;
  search?: string;
  limit?: number;
}

export interface AdminAuditLogEntry {
  id: string;
  source: string;
  category: string;
  action: string;
  severity: "info" | "warning" | "error" | string;
  status: string;
  summary: string;
  actorName?: string;
  targetType?: string;
  targetId?: string;
  createdAt?: string;
  metadata?: Record<string, unknown>;
}

export interface AdminAuditLogSummary {
  total: number;
  warnings: number;
  errors: number;
  bySource: Record<string, number>;
  latestAt?: string | null;
}

export const adminAuditLogsApi = {
  async listAuditLogs(session: AdminSession, filters: AdminAuditLogFilters = {}) {
    const response = await fetch(withQuery("/api/admin/audit-logs", filters), {
      ...authRequest(session),
    });
    return parseJsonResponse<{
      entries: AdminAuditLogEntry[];
      summary: AdminAuditLogSummary;
      filters: Required<Pick<AdminAuditLogFilters, "range" | "limit">> & {
        source: AdminAuditLogSource;
        search: string;
      };
    }>(response, "Unable to load audit logs.");
  },
};
