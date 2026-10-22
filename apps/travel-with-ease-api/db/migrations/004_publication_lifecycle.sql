ALTER TABLE twe.publication_jobs
  ADD COLUMN source_sha TEXT CHECK (source_sha ~ '^[a-f0-9]{40}$'),
  ADD COLUMN build_token UUID,
  ADD COLUMN last_error TEXT;
CREATE UNIQUE INDEX publication_one_active ON twe.publication_jobs (organisation_id, environment)
  WHERE status IN ('pending', 'building');
CREATE FUNCTION twe.protect_publication_manifest() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.manifest IS DISTINCT FROM OLD.manifest OR NEW.source_sha IS DISTINCT FROM OLD.source_sha
    OR NEW.organisation_id IS DISTINCT FROM OLD.organisation_id OR NEW.environment IS DISTINCT FROM OLD.environment THEN
    RAISE EXCEPTION 'Publication snapshot is immutable';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER immutable_publication_manifest BEFORE UPDATE ON twe.publication_jobs
  FOR EACH ROW EXECUTE FUNCTION twe.protect_publication_manifest();
