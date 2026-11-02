CREATE TABLE twe.staff_invitations (
  id uuid PRIMARY KEY,
  organisation_id uuid NOT NULL REFERENCES twe.organisations(id),
  environment text NOT NULL,
  issuer text NOT NULL,
  audience text NOT NULL,
  subject text NOT NULL,
  role text NOT NULL CHECK (role IN ('owner','editor')),
  token_hash text NOT NULL UNIQUE,
  approval_reference text NOT NULL,
  issued_by_identity_hash text NOT NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  accepted_at timestamptz,
  revoked_at timestamptz,
  FOREIGN KEY (organisation_id,created_by) REFERENCES twe.staff_users(organisation_id,id),
  CHECK (expires_at > created_at)
);
CREATE INDEX staff_invitations_workspace ON twe.staff_invitations(organisation_id,created_at);
-- Durable per-verified-identity attempt limits survive container restarts.
CREATE TABLE twe.activation_attempts (
  organisation_id uuid NOT NULL REFERENCES twe.organisations(id),
  identity_hash text NOT NULL,
  window_start timestamptz NOT NULL DEFAULT now(),
  attempts integer NOT NULL DEFAULT 1,
  PRIMARY KEY (organisation_id,identity_hash)
);
