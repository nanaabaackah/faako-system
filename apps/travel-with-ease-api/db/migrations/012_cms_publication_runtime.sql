-- Additive: preserve draft revisions and historic publication manifests.
ALTER TABLE twe.content_items ADD COLUMN published_body JSONB
  CHECK (published_body IS NULL OR jsonb_typeof(published_body) = 'object');
ALTER TABLE twe.content_items ADD COLUMN publication_initialized BOOLEAN NOT NULL DEFAULT false;
UPDATE twe.content_items c SET publication_initialized = true
WHERE c.published_revision_id IS NOT NULL OR EXISTS (
  SELECT 1 FROM twe.publication_jobs j
  CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(j.manifest->'pages') = 'array' THEN j.manifest->'pages' ELSE '[]'::jsonb END) p
  WHERE j.organisation_id = c.organisation_id AND j.status = 'live' AND p->>'id' = c.id::text
);
ALTER TABLE twe.publication_jobs
  DROP CONSTRAINT publication_jobs_status_check,
  ADD CONSTRAINT publication_jobs_status_check
    CHECK (status IN ('pending', 'building', 'deploying', 'verifying', 'live', 'failed')),
  ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN recovery_deployment_id TEXT,
  ADD COLUMN requested_by UUID REFERENCES twe.staff_users(id);
DROP INDEX twe.publication_one_active;
CREATE UNIQUE INDEX publication_one_active ON twe.publication_jobs (organisation_id, environment)
  WHERE status IN ('pending', 'building', 'deploying', 'verifying');
