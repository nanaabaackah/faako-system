-- Additive email-binding for simplified staff invitations. Existing subject-bound
-- invitations and first-Owner installer codes retain their original semantics.
ALTER TABLE twe.staff_invitations
  ADD COLUMN invited_email TEXT;
ALTER TABLE twe.staff_invitations
  ADD CONSTRAINT staff_invitation_email_normalized CHECK (
    invited_email IS NULL OR (
      invited_email = lower(invited_email) AND
      length(invited_email) BETWEEN 3 AND 254 AND
      invited_email !~ '[[:space:]]'
    )
  );
CREATE INDEX staff_invitation_email_lookup
  ON twe.staff_invitations(organisation_id, invited_email)
  WHERE invited_email IS NOT NULL AND accepted_at IS NULL AND revoked_at IS NULL;
