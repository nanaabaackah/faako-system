import type {
  InventoryAlertSummary,
  InventoryItem,
  InventoryMovement,
  SupplierSummary,
} from "../api/adminInventory";
import type { AdminProduct } from "../api/adminProducts";
import type { AdminSession } from "../api/adminSession";

const PORTAL_OVERVIEW_CACHE_PREFIX = "stroane_portal_overview_cache_v1";

export interface PortalOverviewSnapshot {
  inventory: InventoryItem[];
  suppliers: SupplierSummary[];
  movements: InventoryMovement[];
  products: AdminProduct[];
  alerts: InventoryAlertSummary;
  cachedAt: string;
}

const getCacheKey = (session: AdminSession) =>
  `${PORTAL_OVERVIEW_CACHE_PREFIX}:${session.username.trim().toLowerCase()}`;

const isPortalOverviewSnapshot = (value: unknown): value is PortalOverviewSnapshot => {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<PortalOverviewSnapshot>;
  return (
    Array.isArray(candidate.inventory) &&
    Array.isArray(candidate.suppliers) &&
    Array.isArray(candidate.movements) &&
    Array.isArray(candidate.products) &&
    Boolean(candidate.alerts) &&
    typeof candidate.cachedAt === "string"
  );
};

export const loadPortalOverviewSnapshot = (session: AdminSession): PortalOverviewSnapshot | null => {
  if (typeof window === "undefined") return null;
  try {
    const parsed = JSON.parse(window.localStorage.getItem(getCacheKey(session)) || "null");
    return isPortalOverviewSnapshot(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

export const savePortalOverviewSnapshot = (
  session: AdminSession,
  snapshot: Omit<PortalOverviewSnapshot, "cachedAt">
): PortalOverviewSnapshot | null => {
  if (typeof window === "undefined") return null;
  const nextSnapshot = {
    ...snapshot,
    cachedAt: new Date().toISOString(),
  };
  window.localStorage.setItem(getCacheKey(session), JSON.stringify(nextSnapshot));
  return nextSnapshot;
};
