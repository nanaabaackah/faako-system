const DEFAULT_DRAFT_STORAGE_PREFIX = "faako-local-draft";
const LOCAL_DRAFT_STORAGE_VERSION = 1;

const nowIso = () => new Date().toISOString();

const sanitizeKeyPart = (value) =>
  String(value ?? "")
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);

const resolveStorage = (storage = "localStorage") => {
  if (storage && typeof storage.getItem === "function") return storage;
  if (typeof window === "undefined") return null;
  if (storage === "sessionStorage") return window.sessionStorage || null;
  return window.localStorage || null;
};

export const buildScopedDraftKey = ({
  prefix = DEFAULT_DRAFT_STORAGE_PREFIX,
  sourceApp,
  organizationId,
  actorId,
  draftType,
  recordId = "global",
} = {}) => {
  const parts = [
    sanitizeKeyPart(prefix),
    sanitizeKeyPart(sourceApp),
    sanitizeKeyPart(organizationId),
    sanitizeKeyPart(actorId),
    sanitizeKeyPart(draftType),
    sanitizeKeyPart(recordId || "global"),
  ];

  return parts.every(Boolean) ? parts.join(":") : "";
};

export const createDraftMetadata = ({
  sourceApp = "",
  organizationId = "",
  actorId = "",
  draftType = "",
  recordId = "",
  savedAt = nowIso(),
  lastRestoredAt = "",
} = {}) => ({
  sourceApp: sanitizeKeyPart(sourceApp),
  organizationId: sanitizeKeyPart(organizationId),
  actorId: sanitizeKeyPart(actorId),
  draftType: sanitizeKeyPart(draftType),
  recordId: sanitizeKeyPart(recordId),
  savedAt,
  lastRestoredAt,
  syncEnabled: false,
});

export const createLocalDraftEnvelope = (data = {}, options = {}) => {
  const savedAt = options.savedAt || nowIso();
  return {
    version: options.version || LOCAL_DRAFT_STORAGE_VERSION,
    savedAt,
    metadata: createDraftMetadata({
      ...options.metadata,
      savedAt,
    }),
    data: data && typeof data === "object" ? { ...data } : {},
  };
};

export const readLocalDraft = (key, options = {}) => {
  const storage = resolveStorage(options.storage);
  if (!key || !storage) return null;

  try {
    const raw = storage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    if (parsed.version !== (options.version || LOCAL_DRAFT_STORAGE_VERSION)) return null;
    if (!parsed.data || typeof parsed.data !== "object") return null;
    return parsed;
  } catch {
    return null;
  }
};

export const writeLocalDraft = (key, data = {}, options = {}) => {
  const storage = resolveStorage(options.storage);
  if (!key || !storage) return null;

  const envelope = createLocalDraftEnvelope(data, options);
  try {
    storage.setItem(key, JSON.stringify(envelope));
    return envelope;
  } catch {
    return null;
  }
};

export const clearLocalDraft = (key, options = {}) => {
  const storage = resolveStorage(options.storage);
  if (!key || !storage) return;
  storage.removeItem(key);
};

export const listLocalDrafts = ({ prefix = DEFAULT_DRAFT_STORAGE_PREFIX, storage: storageOption } = {}) => {
  const storage = resolveStorage(storageOption);
  const safePrefix = sanitizeKeyPart(prefix);
  if (!storage || !safePrefix) return [];

  const drafts = [];
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (!key || !key.startsWith(`${safePrefix}:`)) continue;
    const draft = readLocalDraft(key, { storage });
    if (draft) drafts.push({ key, ...draft });
  }
  return drafts.sort((left, right) => String(right.savedAt || "").localeCompare(String(left.savedAt || "")));
};

export {
  DEFAULT_DRAFT_STORAGE_PREFIX,
  LOCAL_DRAFT_STORAGE_VERSION,
};
