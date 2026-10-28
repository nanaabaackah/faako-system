// Closed vocabulary only: never log error messages, JWTs, claims or headers.
export function accessFailureReason(error) {
  switch (error?.code) {
    case "TWE_ACCESS_ASSERTION_INVALID": return "assertion_malformed";
    case "TWE_ACCESS_IDENTITY_INVALID": return "staff_identity_invalid";
    case "ERR_JWT_EXPIRED": return "token_expired";
    case "ERR_JWS_SIGNATURE_VERIFICATION_FAILED": return "signature_invalid";
    case "ERR_JWKS_TIMEOUT": return "signing_keys_timeout";
    case "ERR_JWKS_NO_MATCHING_KEY": return "signing_key_not_found";
    case "ERR_JWKS_INVALID": return "signing_keys_invalid";
    case "ERR_JOSE_ALG_NOT_ALLOWED": return "algorithm_invalid";
    case "ERR_JWS_INVALID":
    case "ERR_JWT_INVALID": return "assertion_malformed";
    case "ERR_JWT_CLAIM_VALIDATION_FAILED": {
      const claims = new Set(["aud", "iss", "exp", "iat", "nbf", "sub"]);
      if (!claims.has(error.claim)) return "claim_invalid";
      return `${error.claim}_${error.reason === "missing" ? "missing" : "invalid"}`;
    }
    default: return "verification_failed";
  }
}
