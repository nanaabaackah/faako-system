const QUEUE_KEY = "reebs_admin_offline_queue_v1";
const INVENTORY_SNAPSHOT_KEY = "reebs_admin_inventory_snapshot_v1";
const CUSTOMERS_SNAPSHOT_KEY = "reebs_admin_customers_snapshot_v1";

const canUseStorage = () =>
  typeof window !== "undefined" && typeof window.localStorage !== "undefined";

const readJson = (key, fallback) => {
  if (!canUseStorage()) return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
};

const writeJson = (key, value) => {
  if (!canUseStorage()) return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore quota/storage failures
  }
};

const makeQueueId = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export const createQueueItem = ({ type, payload, label }) => ({
  id: makeQueueId(),
  type,
  payload,
  label: label || type,
  createdAt: new Date().toISOString(),
  status: "pending",
  attempts: 0,
  lastError: "",
});

export const loadOfflineQueue = () => {
  const queue = readJson(QUEUE_KEY, []);
  return Array.isArray(queue) ? queue : [];
};

export const saveOfflineQueue = (queue) => {
  writeJson(QUEUE_KEY, Array.isArray(queue) ? queue : []);
};

export const loadInventorySnapshot = () => {
  const items = readJson(INVENTORY_SNAPSHOT_KEY, []);
  return Array.isArray(items) ? items : [];
};

export const saveInventorySnapshot = (items) => {
  writeJson(INVENTORY_SNAPSHOT_KEY, Array.isArray(items) ? items : []);
};

export const loadCustomerSnapshot = () => {
  const customers = readJson(CUSTOMERS_SNAPSHOT_KEY, []);
  return Array.isArray(customers) ? customers : [];
};

export const saveCustomerSnapshot = (customers) => {
  writeJson(CUSTOMERS_SNAPSHOT_KEY, Array.isArray(customers) ? customers : []);
};
