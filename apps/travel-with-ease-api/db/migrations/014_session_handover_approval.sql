-- Staging handover approvals are bound to two independently authenticated
-- application sessions. Raw identity-provider assertions are never stored here.
CREATE TABLE twe.staff_handover_requests (
  id UUID PRIMARY KEY,
  organisation_id UUID NOT NULL REFERENCES twe.organisations(id),
  developer_id UUID NOT NULL,
  client_id UUID NOT NULL,
  developer_session_hash TEXT NOT NULL,
  approval_reference TEXT NOT NULL CHECK(approval_reference ~ '^[A-Za-z0-9][A-Za-z0-9._/-]{2,119}$'),
  request_id TEXT NOT NULL CHECK(length(request_id) BETWEEN 1 AND 120),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  approved_at TIMESTAMPTZ,
  approved_by UUID,
  cancelled_at TIMESTAMPTZ,
  CHECK (developer_id <> client_id),
  CHECK (expires_at > created_at AND expires_at <= created_at + interval '10 minutes'),
  CHECK ((approved_at IS NULL AND approved_by IS NULL) OR (approved_at IS NOT NULL AND approved_by = client_id)),
  CHECK (approved_at IS NULL OR cancelled_at IS NULL),
  FOREIGN KEY (organisation_id, developer_id) REFERENCES twe.staff_users(organisation_id, id),
  FOREIGN KEY (organisation_id, client_id) REFERENCES twe.staff_users(organisation_id, id),
  FOREIGN KEY (organisation_id, approved_by) REFERENCES twe.staff_users(organisation_id, id),
  FOREIGN KEY (developer_session_hash) REFERENCES twe.staff_sessions(token_hash)
);
CREATE UNIQUE INDEX staff_handover_one_open
  ON twe.staff_handover_requests(organisation_id)
  WHERE approved_at IS NULL AND cancelled_at IS NULL;
CREATE INDEX staff_handover_participants
  ON twe.staff_handover_requests(organisation_id, developer_id, client_id, expires_at DESC);
