export const FORM_DRAFT_TTL_MS = 5 * 60 * 1000;

const isBrowser = () => typeof window !== "undefined" && Boolean(window.localStorage);

export const loadExpiringDraft = (key, { ttlMs = FORM_DRAFT_TTL_MS } = {}) => {
  if (!isBrowser()) return null;

  const raw = window.localStorage.getItem(key);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    const savedAt = Number(parsed?.savedAt);
    const data = parsed?.data;
    if (!Number.isFinite(savedAt) || typeof data === "undefined") {
      window.localStorage.removeItem(key);
      return null;
    }

    if (Date.now() - savedAt > ttlMs) {
      window.localStorage.removeItem(key);
      return null;
    }

    return data;
  } catch {
    window.localStorage.removeItem(key);
    return null;
  }
};

export const saveExpiringDraft = (key, data) => {
  if (!isBrowser()) return;
  if (data == null) {
    window.localStorage.removeItem(key);
    return;
  }

  window.localStorage.setItem(
    key,
    JSON.stringify({
      savedAt: Date.now(),
      data,
    })
  );
};

export const clearExpiringDraft = (key) => {
  if (!isBrowser()) return;
  window.localStorage.removeItem(key);
};
