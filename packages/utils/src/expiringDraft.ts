export const FORM_DRAFT_TTL_MS = 5 * 60 * 1000;

export interface DraftStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface DraftReadOptions {
  ttlMs?: number;
  storage?: DraftStorage | null;
  now?: () => number;
}

export interface DraftWriteOptions {
  storage?: DraftStorage | null;
  now?: () => number;
}

const getDefaultStorage = (): DraftStorage | null => {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage || null;
  } catch {
    return null;
  }
};

export const loadExpiringDraft = <Data = unknown>(
  key: string,
  {
    ttlMs = FORM_DRAFT_TTL_MS,
    storage = getDefaultStorage(),
    now = Date.now,
  }: DraftReadOptions = {},
): Data | null => {
  if (!storage) return null;

  const raw = storage.getItem(key);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as { savedAt?: unknown; data?: Data };
    const savedAt = Number(parsed?.savedAt);
    const data = parsed?.data;

    if (!Number.isFinite(savedAt) || typeof data === "undefined") {
      storage.removeItem(key);
      return null;
    }

    if (now() - savedAt > ttlMs) {
      storage.removeItem(key);
      return null;
    }

    return data;
  } catch {
    storage.removeItem(key);
    return null;
  }
};

export const saveExpiringDraft = (
  key: string,
  data: unknown,
  {
    storage = getDefaultStorage(),
    now = Date.now,
  }: DraftWriteOptions = {},
) => {
  if (!storage) return;
  if (data == null) {
    storage.removeItem(key);
    return;
  }

  storage.setItem(
    key,
    JSON.stringify({
      savedAt: now(),
      data,
    }),
  );
};

export const clearExpiringDraft = (
  key: string,
  { storage = getDefaultStorage() }: Pick<DraftWriteOptions, "storage"> = {},
) => {
  if (!storage) return;
  storage.removeItem(key);
};
