-- Additive only: existing uploaded media and immutable revisions remain intact.
ALTER TABLE twe.media
  ADD COLUMN source_folder_id TEXT,
  ADD COLUMN source_file_id TEXT,
  ADD COLUMN source_version TEXT,
  ADD COLUMN source_checksum TEXT,
  ADD CONSTRAINT media_drive_source_complete CHECK (
    (source_folder_id IS NULL AND source_file_id IS NULL
      AND source_version IS NULL AND source_checksum IS NULL)
    OR (
      source_folder_id IS NOT NULL AND source_folder_id ~ '^[A-Za-z0-9_-]{10,200}$'
      AND source_file_id IS NOT NULL AND source_file_id ~ '^[A-Za-z0-9_-]{10,200}$'
      AND source_version IS NOT NULL AND source_version ~ '^[0-9]{1,30}$'
      AND source_checksum IS NOT NULL AND source_checksum ~ '^[a-f0-9]{32}$'
    )
  ),
  ADD CONSTRAINT media_drive_revision_unique
    UNIQUE (organisation_id, source_folder_id, source_file_id, source_version);

-- No table/role grants change: runtime already has reviewed media INSERT/UPDATE.
-- Application rollback may leave these nullable columns in place safely.
