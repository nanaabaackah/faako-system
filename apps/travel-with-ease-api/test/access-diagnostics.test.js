import test from "node:test";
import assert from "node:assert/strict";
import { accessFailureReason } from "../src/auth/access-diagnostics.js";

test("Access diagnostics use only fixed safe reason codes", () => {
  for (const [code, expected] of [
    ["TWE_ACCESS_ASSERTION_INVALID", "assertion_malformed"],
    ["TWE_ACCESS_IDENTITY_INVALID", "staff_identity_invalid"],
    ["ERR_JWT_EXPIRED", "token_expired"],
    ["ERR_JWS_SIGNATURE_VERIFICATION_FAILED", "signature_invalid"],
    ["ERR_JWKS_TIMEOUT", "signing_keys_timeout"],
    ["ERR_JWKS_NO_MATCHING_KEY", "signing_key_not_found"],
  ]) assert.equal(accessFailureReason({ code, message: "SECRET", payload: "SECRET" }), expected);
  for (const claim of ["aud", "iss", "nbf", "iat", "exp", "sub"]) {
    assert.equal(accessFailureReason({ code: "ERR_JWT_CLAIM_VALIDATION_FAILED", claim }), `${claim}_invalid`);
    assert.equal(accessFailureReason({ code: "ERR_JWT_CLAIM_VALIDATION_FAILED", claim, reason: "missing" }), `${claim}_missing`);
  }
  assert.equal(accessFailureReason({ code: "ERR_JWT_CLAIM_VALIDATION_FAILED", claim: "SECRET" }), "claim_invalid");
  assert.equal(accessFailureReason({ code: "SECRET", message: "SECRET" }), "verification_failed");
  assert.equal(accessFailureReason(null), "verification_failed");
});
