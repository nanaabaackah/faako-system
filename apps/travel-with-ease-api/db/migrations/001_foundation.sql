CREATE TABLE twe.organisations (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 160)
);

CREATE TABLE twe.staff_users (
  id UUID PRIMARY KEY,
  organisation_id UUID NOT NULL REFERENCES twe.organisations(id),
  issuer TEXT NOT NULL,
  subject TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('owner', 'editor')),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (issuer, subject), UNIQUE (organisation_id, id)
);

CREATE TABLE twe.staff_sessions (
  token_hash TEXT PRIMARY KEY CHECK (token_hash ~ '^[a-f0-9]{64}$'),
  organisation_id UUID NOT NULL,
  user_id UUID NOT NULL,
  csrf_hash TEXT NOT NULL CHECK (csrf_hash ~ '^[a-f0-9]{64}$'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  CHECK (expires_at > created_at),
  FOREIGN KEY (organisation_id, user_id) REFERENCES twe.staff_users(organisation_id, id)
);
CREATE INDEX staff_sessions_expiry_idx ON twe.staff_sessions (expires_at);
CREATE INDEX staff_sessions_user_idx ON twe.staff_sessions (organisation_id, user_id);

CREATE TABLE twe.content_items (
  id UUID PRIMARY KEY,
  organisation_id UUID NOT NULL REFERENCES twe.organisations(id),
  kind TEXT NOT NULL CHECK (kind IN ('page', 'settings', 'package', 'article')),
  slug TEXT NOT NULL CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND length(slug) <= 120),
  version INTEGER NOT NULL DEFAULT 0 CHECK (version >= 0),
  draft_revision_id UUID,
  published_revision_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organisation_id, kind, slug), UNIQUE (organisation_id, id)
);

CREATE TABLE twe.content_revisions (
  id UUID PRIMARY KEY,
  organisation_id UUID NOT NULL,
  content_id UUID NOT NULL,
  version INTEGER NOT NULL CHECK (version > 0),
  body JSONB NOT NULL CHECK (jsonb_typeof(body) = 'object'),
  editor_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organisation_id, content_id, version),
  UNIQUE (organisation_id, content_id, id),
  FOREIGN KEY (organisation_id, content_id) REFERENCES twe.content_items(organisation_id, id),
  FOREIGN KEY (organisation_id, editor_id) REFERENCES twe.staff_users(organisation_id, id)
);
ALTER TABLE twe.content_items ADD CONSTRAINT draft_revision_fk
  FOREIGN KEY (organisation_id, id, draft_revision_id) REFERENCES twe.content_revisions(organisation_id, content_id, id);
ALTER TABLE twe.content_items ADD CONSTRAINT published_revision_fk
  FOREIGN KEY (organisation_id, id, published_revision_id) REFERENCES twe.content_revisions(organisation_id, content_id, id);

CREATE TABLE twe.media (
  id UUID PRIMARY KEY,
  organisation_id UUID NOT NULL REFERENCES twe.organisations(id),
  object_key TEXT NOT NULL UNIQUE,
  mime_type TEXT NOT NULL CHECK (mime_type IN ('image/webp', 'image/jpeg', 'image/png')),
  byte_size INTEGER NOT NULL CHECK (byte_size > 0 AND byte_size <= 10485760),
  width INTEGER NOT NULL CHECK (width > 0 AND width <= 12000),
  height INTEGER NOT NULL CHECK (height > 0 AND height <= 12000),
  alt_text TEXT NOT NULL CHECK (length(alt_text) <= 500),
  rights TEXT NOT NULL CHECK (length(rights) BETWEEN 1 AND 2000),
  derivatives JSONB NOT NULL DEFAULT '[]' CHECK (jsonb_typeof(derivatives) = 'array'),
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  archived_at TIMESTAMPTZ,
  UNIQUE (organisation_id, id),
  FOREIGN KEY (organisation_id, created_by) REFERENCES twe.staff_users(organisation_id, id)
);
CREATE TABLE twe.content_media (
  organisation_id UUID NOT NULL,
  content_id UUID NOT NULL,
  revision_id UUID NOT NULL,
  media_id UUID NOT NULL,
  PRIMARY KEY (organisation_id, revision_id, media_id),
  FOREIGN KEY (organisation_id, content_id, revision_id) REFERENCES twe.content_revisions(organisation_id, content_id, id),
  FOREIGN KEY (organisation_id, media_id) REFERENCES twe.media(organisation_id, id)
);
CREATE INDEX content_media_asset_idx ON twe.content_media (organisation_id, media_id);

CREATE TABLE twe.enquiries (
  id UUID PRIMARY KEY,
  organisation_id UUID NOT NULL REFERENCES twe.organisations(id),
  kind TEXT NOT NULL CHECK (kind IN ('personalised', 'package', 'legacy_estimator')),
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'closed')),
  contact JSONB NOT NULL CHECK (jsonb_typeof(contact) = 'object'),
  details JSONB NOT NULL CHECK (jsonb_typeof(details) = 'object'),
  notice_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organisation_id, id)
);
CREATE INDEX enquiries_inbox_idx ON twe.enquiries (organisation_id, status, created_at DESC);

CREATE TABLE twe.notification_outbox (
  id UUID PRIMARY KEY,
  organisation_id UUID NOT NULL,
  enquiry_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'sent', 'failed')),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  available_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  lease_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organisation_id, enquiry_id),
  FOREIGN KEY (organisation_id, enquiry_id) REFERENCES twe.enquiries(organisation_id, id)
);
CREATE INDEX outbox_pending_idx ON twe.notification_outbox (status, available_at);

CREATE TABLE twe.travel_activity (
  id UUID PRIMARY KEY,
  organisation_id UUID NOT NULL REFERENCES twe.organisations(id),
  country_code TEXT NOT NULL CHECK (country_code ~ '^[A-Z]{2}$'),
  trip_count INTEGER NOT NULL CHECK (trip_count > 0),
  status TEXT NOT NULL CHECK (status IN ('completed', 'confirmed_upcoming', 'cancelled')),
  source_key TEXT NOT NULL CHECK (length(source_key) BETWEEN 1 AND 160),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL CHECK (period_end >= period_start),
  published BOOLEAN NOT NULL DEFAULT FALSE,
  editor_id UUID NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organisation_id, source_key, country_code),
  FOREIGN KEY (organisation_id, editor_id) REFERENCES twe.staff_users(organisation_id, id)
);

CREATE TABLE twe.audit_records (
  id UUID PRIMARY KEY,
  organisation_id UUID NOT NULL REFERENCES twe.organisations(id),
  actor_id UUID,
  action TEXT NOT NULL CHECK (length(action) BETWEEN 1 AND 120),
  record_id UUID,
  request_id TEXT NOT NULL CHECK (length(request_id) BETWEEN 1 AND 120),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  FOREIGN KEY (organisation_id, actor_id) REFERENCES twe.staff_users(organisation_id, id)
);
CREATE INDEX audit_records_timeline_idx ON twe.audit_records (organisation_id, created_at DESC);

CREATE TABLE twe.publication_jobs (
  id UUID PRIMARY KEY,
  organisation_id UUID NOT NULL REFERENCES twe.organisations(id),
  environment TEXT NOT NULL CHECK (environment IN ('development', 'test', 'staging', 'production')),
  manifest JSONB NOT NULL CHECK (jsonb_typeof(manifest) = 'object'),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'building', 'live', 'failed')),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  deployment_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  CHECK (status <> 'live' OR (deployment_id IS NOT NULL AND completed_at IS NOT NULL))
);
CREATE INDEX publication_jobs_pending_idx ON twe.publication_jobs (organisation_id, status, created_at);

CREATE FUNCTION twe.reject_history_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Historical records are append-only';
END;
$$;
CREATE TRIGGER immutable_revisions BEFORE UPDATE OR DELETE ON twe.content_revisions
  FOR EACH ROW EXECUTE FUNCTION twe.reject_history_mutation();
CREATE TRIGGER immutable_audit BEFORE UPDATE OR DELETE ON twe.audit_records
  FOR EACH ROW EXECUTE FUNCTION twe.reject_history_mutation();
