BEGIN;
CREATE SCHEMA IF NOT EXISTS ttngh_media;
CREATE TABLE ttngh_media.assets (
  id uuid PRIMARY KEY,
  source_folder_id text NOT NULL,
  source_file_id text NOT NULL,
  source_version text NOT NULL,
  source_checksum char(32) NOT NULL,
  source_name text NOT NULL,
  source_mime text NOT NULL CHECK (source_mime IN ('image/jpeg','image/png','image/webp')),
  source_bytes integer NOT NULL CHECK (source_bytes > 0 AND source_bytes <= 8388608),
  source_path text[] NOT NULL DEFAULT ARRAY[]::text[],
  source_sha256 char(64) NOT NULL,
  r2_variants jsonb NOT NULL,
  status text NOT NULL DEFAULT 'imported'
    CHECK (status IN ('imported','approved','archived')),
  alt text NOT NULL DEFAULT '',
  rights_evidence text NOT NULL DEFAULT '',
  sanity_asset_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_file_id, source_version, source_checksum)
);
CREATE INDEX assets_review_index ON ttngh_media.assets(status, created_at DESC);
COMMIT;
