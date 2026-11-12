const endpoint = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const action = "twe_enquiry";

export class TurnstileError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function createTurnstileVerifier({ secret = "", environment, fetchImpl = fetch }) {
  const hosted = ["staging", "production"].includes(environment);
  if (!hosted && !secret) return null;
  return async ({ token, origin }) => {
    // Missing configuration blocks this public mutation, not API startup/login.
    if (!secret || (hosted && /^[123]x0{10,}/.test(secret))) {
      throw new TurnstileError(503, "service_unavailable",
        "Enquiry security verification is not configured. Please contact us on WhatsApp.");
    }
    if (typeof token !== "string" || !token || token.length > 2048) {
      throw new TurnstileError(400, "validation_error",
        "Please complete the enquiry security check.");
    }
    let hostname;
    let protocol;
    try {
      const parsed = new URL(origin);
      hostname = parsed.hostname;
      protocol = parsed.protocol;
    } catch { hostname = ""; }
    const hosts = environment === "production"
      ? ["travelwitheasegh.com", "www.travelwitheasegh.com"]
      : environment === "staging" ? ["staging.travelwitheasegh.com"]
        : ["localhost", "127.0.0.1"];
    if (!hosts.includes(hostname) || (hosted && protocol !== "https:")) {
      throw new TurnstileError(403, "permission_error", "Submit from the Travel With Ease website.");
    }
    let result;
    try {
      const response = await fetchImpl(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ secret, response: token }),
        signal: AbortSignal.timeout(8000),
      });
      if (!response.ok) throw new Error("Verification provider unavailable.");
      result = await response.json();
    } catch {
      throw new TurnstileError(503, "service_unavailable",
        "The security check could not be confirmed. Please try again.");
    }
    if (result?.success !== true || result.hostname !== hostname || result.action !== action) {
      throw new TurnstileError(400, "validation_error",
        "The security check expired or could not be verified. Please complete it again.");
    }
  };
}
