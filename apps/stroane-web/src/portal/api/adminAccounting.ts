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

const jsonAuthRequest = (_session: AdminSession): RequestInit => ({
  credentials: "include",
  headers: {
    "Content-Type": "application/json",
  },
});

const withQuery = (path: string, filters: object = {}) => {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== "") params.set(key, String(value));
  });
  const query = params.toString();
  return apiPath(`${path}${query ? `?${query}` : ""}`);
};

export type AccountingEntryType =
  | "income"
  | "expense"
  | "asset"
  | "liability"
  | "equity"
  | "adjustment";

export interface AccountingOverviewFilters {
  period?: "30d" | "90d" | "12m" | "ytd" | "all" | "custom";
  from?: string;
  to?: string;
  limit?: number;
}

export interface AccountingSummary {
  currency: string;
  revenue: number;
  orderRevenue: number;
  manualIncome: number;
  expenses: number;
  costOfGoodsSold: number;
  grossProfit: number;
  netProfit: number;
  cashEstimate: number;
  receivables: number;
  stockRetailValue: number;
  stockCostValue: number;
  assetTotal: number;
  liabilityTotal: number;
  equity: number;
  netPosition: number;
  receiptValue: number;
  collectionRate: number;
  grossMargin: number;
  receiptCoverage: number;
  averageOrderValue: number;
  paidOrderCount: number;
  outstandingOrderCount: number;
  receiptCount: number;
  manualEntryCount: number;
  stockPricedItemCount: number;
  stockCostedItemCount: number;
  ordersWithKnownCost: number;
}

export interface AccountingSeriesPoint {
  period: string;
  revenue: number;
  expenses: number;
  net: number;
  orders: number;
  entries: number;
}

export interface AccountingCategoryBreakdown {
  category: string;
  amount: number;
}

export interface AccountingTransaction {
  id: string;
  source: "order" | "manual" | string;
  type: AccountingEntryType | string;
  date: string;
  label: string;
  description: string;
  category: string;
  amount: number;
  currency: string;
  reference?: string;
  status?: string;
}

export interface AccountingLedgerEntry {
  id: string;
  entryType: AccountingEntryType;
  category: string;
  description: string;
  amount: number;
  currency: string;
  entryDate: string;
  source: string;
  reference?: string;
  notes?: string;
  status: string;
  createdByName?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface AccountingOverview {
  range: {
    period: string;
    from?: string;
    to?: string;
  };
  summary: AccountingSummary;
  categoryBreakdown: AccountingCategoryBreakdown[];
  series: AccountingSeriesPoint[];
  transactions: AccountingTransaction[];
  manualEntries: AccountingLedgerEntry[];
  notices: string[];
}

export interface AccountingEntryCreatePayload {
  entryType: AccountingEntryType;
  category: string;
  description: string;
  amount: number | string;
  currency?: string;
  entryDate: string;
  source?: string;
  reference?: string;
  notes?: string;
}

export const adminAccountingApi = {
  async getOverview(session: AdminSession, filters: AccountingOverviewFilters = {}) {
    const response = await fetch(withQuery("/api/admin/accounting/overview", filters), {
      ...authRequest(session),
    });
    return parseJsonResponse<AccountingOverview>(response, "Unable to load accounting overview.");
  },

  async createEntry(session: AdminSession, payload: AccountingEntryCreatePayload) {
    const response = await fetch(apiPath("/api/admin/accounting/entries"), {
      method: "POST",
      ...jsonAuthRequest(session),
      body: JSON.stringify(payload),
    });
    return parseJsonResponse<{ entry: AccountingLedgerEntry }>(
      response,
      "Unable to save accounting entry."
    );
  },
};
