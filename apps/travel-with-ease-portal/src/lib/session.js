// Share only concurrent bootstrap work; never cache a session or retry a failed
// mutation automatically. React StrictMode can mount twice during local review.
export function createSessionLoader(api) {
  let pending;
  return function loadSession(mode) {
    if (pending) return pending;
    pending = (async () => {
      try {
        return await api.get("/api/auth/session", { responseMode: "data" });
      } catch (error) {
        if (error.status !== 401) throw error;
        if (mode !== "cloudflare_access") return null;
        await api.post("/api/auth/access-session", { responseMode: "data", headers: { "X-TWE-Session-Init": "1" } });
        return api.get("/api/auth/session", { responseMode: "data" });
      }
    })().finally(() => { pending = undefined; });
    return pending;
  };
}

// Foreground checks are read-only. Do not exchange a fresh token or replay a
// mutation after expiry/revocation. Network failures are not sign-outs.
export async function checkCurrentSession(api, previous) {
  try {
    const next = await api.get("/api/auth/session", { responseMode: "data", cache: "no-store" });
    if (!next?.user || typeof next.csrfToken !== "string") return { status: "unavailable" };
    if (next.user.id !== previous.user.id || next.user.organisationId !== previous.user.organisationId || next.user.role !== previous.user.role || next.csrfToken !== previous.csrfToken) return { status: "changed" };
    return { status: "active" };
  } catch (error) {
    return { status: error.status === 401 ? "expired" : "unavailable" };
  }
}
