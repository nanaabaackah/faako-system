ALTER TABLE twe.staff_invitations ADD COLUMN purpose TEXT;
UPDATE twe.staff_invitations SET purpose = CASE WHEN created_by IS NULL THEN 'initial_owner' ELSE 'staff' END;
-- Preserve inserts from the preceding runtime during an additive rollback.
CREATE FUNCTION twe.default_invitation_purpose() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.purpose IS NULL THEN
    NEW.purpose := CASE WHEN NEW.created_by IS NULL THEN 'initial_owner' ELSE 'staff' END;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER default_invitation_purpose BEFORE INSERT ON twe.staff_invitations
  FOR EACH ROW EXECUTE FUNCTION twe.default_invitation_purpose();
ALTER TABLE twe.staff_invitations ALTER COLUMN purpose SET NOT NULL;
ALTER TABLE twe.staff_invitations ADD CONSTRAINT invitation_purpose_check CHECK (
  (purpose = 'initial_owner' AND role = 'owner' AND created_by IS NULL) OR
  (purpose = 'staff' AND created_by IS NOT NULL)
);
CREATE TABLE twe.staff_role_changes (
  id UUID PRIMARY KEY,
  organisation_id UUID NOT NULL REFERENCES twe.organisations(id),
  actor_id UUID NOT NULL,
  user_id UUID NOT NULL,
  previous_role TEXT NOT NULL CHECK(previous_role IN ('owner','editor','platform_admin')),
  next_role TEXT NOT NULL CHECK(next_role IN ('owner','editor','platform_admin')),
  approval_reference TEXT NOT NULL CHECK(approval_reference ~ '^[A-Za-z0-9][A-Za-z0-9._/-]{2,119}$'),
  request_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  FOREIGN KEY (organisation_id,actor_id) REFERENCES twe.staff_users(organisation_id,id),
  FOREIGN KEY (organisation_id,user_id) REFERENCES twe.staff_users(organisation_id,id)
);
CREATE TRIGGER immutable_role_changes BEFORE UPDATE OR DELETE ON twe.staff_role_changes
  FOR EACH ROW EXECUTE FUNCTION twe.reject_history_mutation();
CREATE INDEX staff_role_changes_timeline ON twe.staff_role_changes(organisation_id,created_at DESC,id DESC);
CREATE INDEX audit_activity_cursor ON twe.audit_records(organisation_id,created_at DESC,id DESC);
