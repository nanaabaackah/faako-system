import * as oidc from "openid-client";

export async function createOidcProvider(settings) {
  const configuration = await oidc.discovery(new URL(settings.issuer), settings.clientId, settings.clientSecret, undefined, { timeout: 10 });
  configuration.timeout = 10;
  return {
    async begin() {
      const verifier = oidc.randomPKCECodeVerifier();
      const state = oidc.randomState();
      const nonce = oidc.randomNonce();
      const url = oidc.buildAuthorizationUrl(configuration, {
        redirect_uri: settings.callbackUrl, scope: "openid", state, nonce,
        code_challenge: await oidc.calculatePKCECodeChallenge(verifier), code_challenge_method: "S256",
        acr_values: settings.mfaAcr, max_age: "300",
      });
      return { verifier, state, nonce, url: url.href };
    },
    async complete(url, flow) {
      const tokens = await oidc.authorizationCodeGrant(configuration, url, {
        pkceCodeVerifier: flow.verifier, expectedState: flow.state, expectedNonce: flow.nonce,
        idTokenExpected: true, maxAge: 300,
      });
      const claims = tokens.claims();
      if (!claims || claims.iss !== settings.issuer || typeof claims.sub !== "string" || !claims.sub || claims.acr !== settings.mfaAcr) {
        throw new Error("Verified staff identity and configured MFA assurance are required.");
      }
      // Access/refresh/ID tokens stay server-side and are deliberately discarded.
      return { issuer: claims.iss, subject: claims.sub };
    },
  };
}
