-- Durable, tenant-scoped staff invitation email queue. Never store plaintext
-- activation codes, complete email bodies or provider credentials here.
CREATE TABLE twe.staff_invitation_deliveries (
  invitation_id UUID PRIMARY KEY,
  organisation_id UUID NOT NULL,
  environment TEXT NOT NULL CHECK (environment IN ('development','test','staging','production')),
  recipient_email TEXT NOT NULL CHECK (length(recipient_email) BETWEEN 3 AND 254),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','sent','failed','cancelled')),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 5),
  available_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  first_attempt_at TIMESTAMPTZ,
  lease_token UUID,
  lease_until TIMESTAMPTZ,
  provider_id TEXT,
  last_error TEXT,
  template_snapshot JSONB CHECK (template_snapshot IS NULL OR jsonb_typeof(template_snapshot) = 'object'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  FOREIGN KEY (invitation_id) REFERENCES twe.staff_invitations(id),
  FOREIGN KEY (organisation_id) REFERENCES twe.organisations(id)
);
CREATE INDEX staff_invitation_deliveries_queue_idx
  ON twe.staff_invitation_deliveries(organisation_id, status, available_at);
CREATE INDEX staff_invitation_deliveries_expiry_idx
  ON twe.staff_invitation_deliveries(organisation_id, created_at);
