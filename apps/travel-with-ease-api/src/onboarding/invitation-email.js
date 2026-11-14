import { createHmac } from "node:crypto";

const EMAIL_TEST_RECIPIENT = "testing@travelwitheasegh.com";
export const invitationEmailTestRecipient = EMAIL_TEST_RECIPIENT;

export function readInvitationDeliveryConfig(env = process.env) {
  if (env.TWE_INVITATION_DELIVERY_ENABLED !== "true") return null;
  const value = env.TWE_INVITATION_DELIVERY_SECRET;
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(value))
    throw new Error("Invitation email delivery requires an independently generated 32-byte base64url secret.");
  const key = Buffer.from(value, "base64url");
  if (key.length !== 32) throw new Error("Invalid invitation delivery secret.");
  return Object.freeze({ key });
}

// No plaintext activation code is saved to the invitation, queue, audit trail or logs.
// This secret must be shared ONLY between the same-environment TWE API and worker.
// Do not rotate it until all outstanding emailed invitations are expired/revoked.
export function invitationEmailCode(config, { id, organisationId, environment, subject }) {
  if (!config?.key || !id || !organisationId || !environment || !subject)
    throw new Error("Invitation email code inputs are incomplete.");
  return createHmac("sha256", config.key)
    .update(["twe-staff-invitation-v1", environment, organisationId, id, subject].join("\n"))
    .digest("base64url");
}

export function readInvitationPortalOrigin(env = process.env) {
  const value = env.TWE_INVITATION_PORTAL_ORIGIN;
  if (!value) throw new Error("TWE_INVITATION_PORTAL_ORIGIN is required for automatic invitation emails.");
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash ||
      url.pathname !== "/" || !url.hostname || url.port)
    throw new Error("Invitation portal origin must be a reviewed HTTPS origin.");
  return url.origin;
}
