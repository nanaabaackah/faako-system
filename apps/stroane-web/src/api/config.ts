const trimTrailingSlashes = (value: string) => value.replace(/\/+$/, "");

export const normalizeApiBaseUrl = (value: string) => {
  const normalized = trimTrailingSlashes(value.trim());

  // API helpers append their own /api routes. Accept an accidentally configured
  // trailing /api so local and hosted environments do not request /api/api/*.
  return normalized.endsWith("/api") ? normalized.slice(0, -4) : normalized;
};

export const API_BASE_URL = normalizeApiBaseUrl(
  import.meta.env.VITE_API_BASE_URL ||
    import.meta.env.VITE_BACKEND_BASE_URL ||
    (import.meta.env.PROD ? "https://api.stroanesolutions.com" : "")
);

export const apiPath = (path: string) => {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${API_BASE_URL}${normalizedPath}`;
};

export const describeApiBaseUrl = () => API_BASE_URL || "(same-origin fallback)";
