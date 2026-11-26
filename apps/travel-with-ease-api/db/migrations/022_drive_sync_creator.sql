-- Scheduled imports are system actions, not impersonated staff actions.
-- Existing staff creator references remain intact. A system-created asset
-- must have validated Drive provenance; migration 009 enforces completeness.
ALTER TABLE twe.media
  ALTER COLUMN created_by DROP NOT NULL,
  ADD CONSTRAINT media_system_creator_requires_drive CHECK (
    created_by IS NOT NULL OR source_folder_id IS NOT NULL
  );
