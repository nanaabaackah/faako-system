-- Preserve the user's cookie-persistence choice through the one-use OIDC flow.
-- This does not extend the staff session's one-hour server-side expiry.
ALTER TABLE twe.auth_flows ADD COLUMN remember_me BOOLEAN NOT NULL DEFAULT false;
