import { createWorkspaceFixture } from './workspace.js';

// Playwright-only HTTP boundary: the shipped portal always uses its real API
// client. No synthetic identity or fixture adapter is reachable from src/.
export async function mockWorkspaceApi(page, { role = 'owner', requests = [], templateDelay = 0 } = {}) {
  const client = createWorkspaceFixture({ role });
  await page.route('**/api/**', async route => {
    const request = route.request();
    const url = new URL(request.url());
    requests.push(url.pathname);
    if (request.method() === "GET" && url.pathname.startsWith("/api/agent/templates/") && templateDelay) {
      await new Promise(resolve => setTimeout(resolve, templateDelay));
    }
    if (/^\/api\/agent\/media\/[^/]+\/preview$/.test(url.pathname)) {
      return route.fulfill({ contentType: "image/svg+xml",
        body: '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800"><rect width="1200" height="800" fill="#f4ede3"/></svg>' });
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
