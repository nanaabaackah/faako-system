const INVENTORY_CACHE_KEY = "reebs_inventory_cache_v1";
const INVENTORY_CACHE_TTL = 5 * 60 * 1000;
let inventoryRequestPromise = null;

const normalizeSource = (item) =>
  (item?.sourceCategoryCode || item?.sourcecategorycode || "")
    .toString()
    .trim()
    .toLowerCase();

export const readInventoryCache = () => {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(INVENTORY_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.items || !parsed?.ts) return null;
    if (Date.now() - parsed.ts > INVENTORY_CACHE_TTL) return null;
    return parsed.items;
  } catch {
    return null;
  }
};

export const writeInventoryCache = (items) => {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(
      INVENTORY_CACHE_KEY,
      JSON.stringify({ ts: Date.now(), items })
    );
  } catch {
    // ignore cache write failures
  }
};

const createAbortError = () => {
  if (typeof DOMException === "function") {
    return new DOMException("The operation was aborted.", "AbortError");
  }
  const error = new Error("The operation was aborted.");
  error.name = "AbortError";
  return error;
};

const withAbortSignal = (promise, signal) => {
  if (!signal) return promise;
  if (signal.aborted) {
    return Promise.reject(createAbortError());
  }

  return new Promise((resolve, reject) => {
    const handleAbort = () => {
      signal.removeEventListener("abort", handleAbort);
      reject(createAbortError());
    };

    signal.addEventListener("abort", handleAbort, { once: true });
    promise.then(
      (value) => {
        signal.removeEventListener("abort", handleAbort);
        resolve(value);
      },
      (error) => {
        signal.removeEventListener("abort", handleAbort);
        reject(error);
      }
    );
  });
};

export const fetchInventoryWithCache = async ({ signal } = {}) => {
  const cached = readInventoryCache();
  if (cached) {
    return { items: cached, cached: true };
  }

  if (!inventoryRequestPromise) {
    inventoryRequestPromise = (async () => {
      const response = await fetch("/.netlify/functions/inventory");
      if (!response.ok) {
        throw new Error(`Inventory request failed: ${response.status}`);
      }

      const data = await response.json();
      const items = Array.isArray(data) ? data : [];
      writeInventoryCache(items);
      return items;
    })().finally(() => {
      inventoryRequestPromise = null;
    });
  }

  const items = await withAbortSignal(inventoryRequestPromise, signal);
  return { items, cached: false };
};

export const splitInventory = (items = []) => {
  const rentals = [];
  const products = [];

  for (const item of items) {
    const source = normalizeSource(item);
    const isRental = source
      ? source === "rental"
      : (item?.sku || "").toString().toUpperCase().startsWith("REN");
    if (isRental) {
      rentals.push(item);
    } else {
      products.push(item);
    }
  }

  return { rentals, products };
};
