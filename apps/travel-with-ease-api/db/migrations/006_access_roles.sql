-- Additive, data-preserving migration. Legacy identities are intentionally not
-- linked to Access by email or silently granted an application audience.
ALTER TABLE twe.staff_users DROP CONSTRAINT staff_users_role_check;
ALTER TABLE twe.staff_users ADD CONSTRAINT staff_users_role_check
  CHECK (role IN ('platform_admin', 'owner', 'editor'));
ALTER TABLE twe.staff_users ADD COLUMN access_audience TEXT
  CHECK (access_audience IS NULL OR access_audience ~ '^[a-f0-9]{64}$');
ALTER TABLE twe.staff_users ADD CONSTRAINT platform_access_identity_required
  CHECK (role <> 'platform_admin' OR (access_audience IS NOT NULL AND issuer ~ '^https://[a-z0-9-]+\.cloudflareaccess\.com$'));
ALTER TABLE twe.staff_sessions ADD COLUMN access_assertion_hash TEXT UNIQUE
  CHECK (access_assertion_hash IS NULL OR access_assertion_hash ~ '^[a-f0-9]{64}$');

CREATE TABLE twe.support_grants (
  id UUID PRIMARY KEY,
  organisation_id UUID NOT NULL,
  user_id UUID NOT NULL,
  approved_by UUID NOT NULL,
  permission TEXT NOT NULL CHECK (permission = 'enquiries.read'),
  reason_reference TEXT NOT NULL CHECK (reason_reference ~ '^[A-Za-z0-9][A-Za-z0-9._/-]{2,119}$'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  CHECK (user_id <> approved_by),
  CHECK (expires_at > created_at AND expires_at <= created_at + interval '30 minutes'),
  FOREIGN KEY (organisation_id, user_id) REFERENCES twe.staff_users(organisation_id, id),
  FOREIGN KEY (organisation_id, approved_by) REFERENCES twe.staff_users(organisation_id, id)
);
CREATE INDEX support_grants_user_idx ON twe.support_grants(organisation_id, user_id, expires_at);
