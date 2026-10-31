-- Tenant-scoped copy only. Delivery recipients, links and safety footer stay code-owned.
CREATE TABLE twe.email_templates (
  organisation_id uuid NOT NULL REFERENCES twe.organisations(id),
  slug text NOT NULL CHECK (slug = 'enquiry-acknowledgement'),
  version integer NOT NULL DEFAULT 0 CHECK (version >= 0),
  draft jsonb,
  active jsonb,
  active_version integer,
  updated_by uuid NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organisation_id, slug),
  FOREIGN KEY (organisation_id, updated_by) REFERENCES twe.staff_users(organisation_id, id),
  CHECK (draft IS NULL OR jsonb_typeof(draft) = 'object'),
  CHECK (active IS NULL OR jsonb_typeof(active) = 'object')
);
