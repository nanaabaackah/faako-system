const DEFAULT_UPSTREAM_URL = 'https://dev-production-9f73.up.railway.app/api/public/trust-stats';
const DEFAULT_UPSTREAM_TIMEOUT_MS = 4000;
const DEFAULT_CACHE_CONTROL = 'public, max-age=120, s-maxage=600, stale-while-revalidate=1200';
const env = globalThis.process?.env ?? {};

const buildBaseHeaders = () => ({
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': env.TRUST_STATS_CACHE_CONTROL || DEFAULT_CACHE_CONTROL,
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  Vary: 'Origin',
});

const toRoundedNonNegative = (value) => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.max(0, Math.round(value));
  }

  if (typeof value === 'string') {
    const parsed = Number(value.trim());
    if (Number.isFinite(parsed)) {
      return Math.max(0, Math.round(parsed));
    }
  }

  return null;
};

const parseCountValue = (value) => {
  const numeric = toRoundedNonNegative(value);
  if (numeric !== null) return numeric;

  if (Array.isArray(value)) {
    return value.length;
  }

  if (value && typeof value === 'object') {
    const nested =
      value.count ??
      value.total ??
      value.value ??
      value.organizations ??
      value.organizationCount ??
      value.items;

    return parseCountValue(nested);
  }

  return null;
};

const extractOrganizationsCount = (payload) => {
  const candidates = [
    payload?.organizations,
    payload?.organizationCount,
    payload?.stats?.organizations,
    payload?.data?.organizations,
    payload?.kpis?.organizations,
  ];

  for (const candidate of candidates) {
    const parsed = parseCountValue(candidate);
    if (parsed !== null) return parsed;
  }

  return null;
};

const normalizeOrigin = (value) => {
  if (typeof value !== 'string' || !value.trim()) return '';

  try {
    return new URL(value.trim()).origin;
  } catch {
    return '';
  }
};

const getRequestOrigin = (event) => {
  const originHeader = event?.headers?.origin || event?.headers?.Origin;
  const origin = normalizeOrigin(originHeader);
  if (origin) return origin;

  const refererHeader = event?.headers?.referer || event?.headers?.Referer;
  if (!refererHeader) return '';

  try {
    return new URL(refererHeader).origin;
  } catch {
    return '';
  }
};

const getAllowedOrigins = () => {
  const configured = env.TRUST_STATS_ALLOWED_ORIGINS;
  if (!configured) return [];

  return configured
    .split(',')
    .map((item) => normalizeOrigin(item))
    .filter(Boolean);
};

const isAllowedOrigin = (requestOrigin, allowedOrigins) => {
  if (!requestOrigin || allowedOrigins.length === 0) return true;
  return allowedOrigins.includes(requestOrigin);
};

const createJsonResponse = (statusCode, payload, options = {}) => {
  const { extraHeaders = {}, omitBody = false } = options;

  return {
    statusCode,
    headers: {
      ...buildBaseHeaders(),
      ...extraHeaders,
    },
    body: omitBody ? '' : JSON.stringify(payload),
  };
};

const parsePositiveInteger = (value, fallback) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
};

export async function handler(event) {
  const method = event?.httpMethod || 'GET';

  if (method === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: {
        ...buildBaseHeaders(),
        Allow: 'GET, HEAD, OPTIONS',
      },
      body: '',
    };
  }

  if (method !== 'GET' && method !== 'HEAD') {
    return createJsonResponse(
      405,
      { error: 'Method not allowed' },
      {
        extraHeaders: { Allow: 'GET, HEAD, OPTIONS' },
      }
    );
  }

  const requestOrigin = getRequestOrigin(event);
  const allowedOrigins = getAllowedOrigins();

  if (!isAllowedOrigin(requestOrigin, allowedOrigins)) {
    return createJsonResponse(403, { error: 'Forbidden' }, { omitBody: method === 'HEAD' });
  }

  const upstreamUrl = env.TRUST_STATS_UPSTREAM_URL || DEFAULT_UPSTREAM_URL;

  try {
    // Validate at runtime so bad env values fail closed.
    new URL(upstreamUrl);
  } catch {
    return createJsonResponse(500, { error: 'Proxy misconfigured' }, { omitBody: method === 'HEAD' });
  }

  const upstreamTimeoutMs = parsePositiveInteger(
    env.TRUST_STATS_UPSTREAM_TIMEOUT_MS,
    DEFAULT_UPSTREAM_TIMEOUT_MS
  );

  const abortController = new AbortController();
  const timeoutId = setTimeout(() => abortController.abort(), upstreamTimeoutMs);

  try {
    const upstreamHeaders = {
      Accept: 'application/json',
    };

    const upstreamToken = env.TRUST_STATS_UPSTREAM_TOKEN || env.TRUST_STATS_UPSTREAM_API_KEY;

    if (upstreamToken) {
      upstreamHeaders.Authorization = `Bearer ${upstreamToken}`;
    }

    const upstreamResponse = await fetch(upstreamUrl, {
      method: 'GET',
      headers: upstreamHeaders,
      signal: abortController.signal,
    });

    if (!upstreamResponse.ok) {
      return createJsonResponse(
        502,
        { error: 'Upstream unavailable' },
        { omitBody: method === 'HEAD' }
      );
    }

    const contentType = upstreamResponse.headers.get('content-type') || '';
    if (!contentType.toLowerCase().includes('application/json')) {
      return createJsonResponse(
        502,
        { error: 'Invalid upstream response' },
        { omitBody: method === 'HEAD' }
      );
    }

    const payload = await upstreamResponse.json();
    const organizations = extractOrganizationsCount(payload);

    if (organizations === null) {
      return createJsonResponse(
        502,
        { error: 'Invalid upstream payload' },
        { omitBody: method === 'HEAD' }
      );
    }

    return createJsonResponse(
      200,
      { organizations },
      { omitBody: method === 'HEAD' }
    );
  } catch (error) {
    const statusCode = error?.name === 'AbortError' ? 504 : 502;
    return createJsonResponse(
      statusCode,
      { error: 'Unable to load trust stats' },
      { omitBody: method === 'HEAD' }
    );
  } finally {
    clearTimeout(timeoutId);
  }
}
