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
