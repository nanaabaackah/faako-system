import { createRemoteJWKSet, jwtVerify } from "jose";
import { createHash } from "node:crypto";

export function createAccessVerifier(settings, keyResolver) {
  const keys = keyResolver || createRemoteJWKSet(new URL(settings.jwksUrl), {
    timeoutDuration: 5000, cooldownDuration: 30_000, cacheMaxAge: 300_000,
  });
  return {
    async verify(assertion) {
      if (typeof assertion !== "string" || assertion.length > 16_384 || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(assertion)) throw Object.assign(new Error("Invalid Access assertion."), { code: "TWE_ACCESS_ASSERTION_INVALID" });
      const { payload, protectedHeader } = await jwtVerify(assertion, keys, {
        algorithms: ["RS256"], issuer: settings.issuer, audience: settings.audience,
        requiredClaims: ["exp", "iat", "nbf", "sub", "iss", "aud"], clockTolerance: 0,
      });
      if (protectedHeader.typ !== "JWT" || !protectedHeader.kid || payload.type !== "app" ||
          !Array.isArray(payload.aud) || payload.aud.length !== 1 || payload.aud[0] !== settings.audience ||
          typeof payload.sub !== "string" || !payload.sub.trim() || payload.sub.length > 255 ||
          typeof payload.identity_nonce !== "string" || !payload.identity_nonce ||
          payload.common_name !== undefined || payload.service_token_id !== undefined || payload.service_token_status !== undefined ||
          payload.iat > Date.now() / 1000 || payload.exp <= payload.iat) throw Object.assign(new Error("A staff application identity is required."), { code: "TWE_ACCESS_IDENTITY_INVALID" });
      // MFA is enforced by the reviewed Access policy, not arbitrary JWT claims.
      return { issuer: payload.iss, subject: payload.sub, audience: settings.audience, email: typeof payload.email === "string" ? payload.email : null,
        expiresAt: new Date(payload.exp * 1000), assertionHash: createHash("sha256").update(assertion).digest("hex") };
    },
  };
}
