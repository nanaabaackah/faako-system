import { createWorkspaceFixture } from './workspace.js';

// Playwright-only HTTP boundary: the shipped portal always uses its real API
// client. No synthetic identity or fixture adapter is reachable from src/.
export async function mockWorkspaceApi(page, { role = 'owner', requests = [], writes = [], templateDelay = 0, contentDelay = 0 } = {}) {
  const client = createWorkspaceFixture({ role });
  await page.route('**/api/**', async route => {
    const request = route.request();
    const url = new URL(request.url());
    requests.push(url.pathname);
    if (request.method() === "POST" && /^\/api\/agent\/content\/[a-z-]+\/draft$/.test(url.pathname)) {
      writes.push({ path: url.pathname, heading: request.postDataJSON()?.body?.heading });
    }
    if (request.method() === "GET" && url.pathname.startsWith("/api/agent/templates/") && templateDelay) {
      await new Promise(resolve => setTimeout(resolve, templateDelay));
    }
    // Deliberately slow one section to catch stale-editor interaction races.
    if (request.method() === "GET" && /^\/api\/agent\/content\/privacy(?:\/revisions)?$/.test(url.pathname) && contentDelay) {
      await new Promise(resolve => setTimeout(resolve, contentDelay));
    }
    if (/^\/api\/agent\/media\/(?:drive\/[^/]+\/preview|[^/]+\/preview)$/.test(url.pathname)) {
      return route.fulfill({ contentType: "image/webp",
        body: Buffer.from("UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA", "base64") });
    }
    try {
      const data = request.method() === 'POST'
        ? await client.post(url.pathname + url.search, { json: request.postDataJSON() || {} })
        : await client.get(url.pathname + url.search);
      await route.fulfill({ json: { ok: true, data, meta: { requestId: 'isolated-browser-fixture' } } });
    } catch (error) {
      await route.fulfill({ status: error.status || 500, json: {
        ok: false, error: { code: 'validation_error', message: error.message },
        meta: { requestId: 'isolated-browser-fixture' },
      } });
    }
  });
}
