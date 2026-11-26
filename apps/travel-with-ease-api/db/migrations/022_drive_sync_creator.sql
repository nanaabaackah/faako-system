-- Scheduled imports are system actions, not impersonated staff actions.
-- Existing staff creator references remain intact. System imports must have Drive provenance.
ALTER TABLE twe.media ALTER COLUMN created_by DROP NOT NULL;
-- Import writes provenance in the same transaction after insertion; a deferred
-- constraint trigger is unnecessary because the reviewed server path owns both writes.
