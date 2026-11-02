-- Widen the reviewed list without rewriting or deleting saved template rows.
ALTER TABLE twe.email_templates
  DROP CONSTRAINT email_templates_slug_check;
ALTER TABLE twe.email_templates
  ADD CONSTRAINT email_templates_slug_check
  CHECK (slug IN ('enquiry-acknowledgement', 'staff-invitation'));
-- Rollback: keep this additive constraint while invitation rows exist. Never
-- delete staff/template data merely to restore the previous application code.
