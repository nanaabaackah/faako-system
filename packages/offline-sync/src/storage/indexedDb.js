import {
  DEFAULT_OFFLINE_DB_NAME,
  DEFAULT_OFFLINE_DB_VERSION,
  DEFAULT_OFFLINE_META_STORE,
  DEFAULT_OFFLINE_QUEUE_STORE,
} from "../constants/storageConstants.js";

export const isIndexedDbAvailable = () =>
  typeof indexedDB !== "undefined" && typeof indexedDB.open === "function";

export const openOfflineDatabase = (options = {}) =>
  new Promise((resolve, reject) => {
    if (!isIndexedDbAvailable()) {
      reject(new Error("IndexedDB is not available in this environment."));
      return;
    }

    const dbName = options.dbName || DEFAULT_OFFLINE_DB_NAME;
    const version = options.version || DEFAULT_OFFLINE_DB_VERSION;
    const queueStore = options.queueStore || DEFAULT_OFFLINE_QUEUE_STORE;
    const metaStore = options.metaStore || DEFAULT_OFFLINE_META_STORE;
    const request = indexedDB.open(dbName, version);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(queueStore)) {
        const store = db.createObjectStore(queueStore, { keyPath: "id" });
        store.createIndex("status", "status", { unique: false });
        store.createIndex("actionType", "actionType", { unique: false });
        store.createIndex("organizationId", "organizationId", { unique: false });
        store.createIndex("createdAt", "createdAt", { unique: false });
      }
      if (!db.objectStoreNames.contains(metaStore)) {
        db.createObjectStore(metaStore, { keyPath: "key" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Failed to open offline database."));
  });

export const withOfflineStore = async (mode, callback, options = {}) => {
  const queueStore = options.queueStore || DEFAULT_OFFLINE_QUEUE_STORE;
  const db = await openOfflineDatabase(options);

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(queueStore, mode);
    const store = transaction.objectStore(queueStore);
    let callbackResult;

    transaction.oncomplete = () => {
      db.close();
      resolve(callbackResult);
    };
    transaction.onerror = () => {
      db.close();
      reject(transaction.error || new Error("Offline queue transaction failed."));
    };

    try {
      callbackResult = callback(store);
    } catch (error) {
      transaction.abort();
      db.close();
      reject(error);
    }
  });
};
