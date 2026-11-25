-- Additive history, scoped to the existing template and tenant. Earlier
-- overwritten drafts cannot be reconstructed; preserve the current snapshots.
CREATE TABLE twe.email_template_revisions (
  organisation_id uuid NOT NULL,
  slug text NOT NULL,
  version integer NOT NULL CHECK (version >= 0),
  kind text NOT NULL CHECK (kind IN ('draft', 'activated', 'restored', 'baseline')),
  copy jsonb NOT NULL CHECK (jsonb_typeof(copy) = 'object'),
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organisation_id, slug, version),
  FOREIGN KEY (organisation_id, slug) REFERENCES twe.email_templates(organisation_id, slug),
  FOREIGN KEY (organisation_id, created_by) REFERENCES twe.staff_users(organisation_id, id)
);
INSERT INTO twe.email_template_revisions (organisation_id, slug, version, kind, copy, created_by, created_at)
SELECT organisation_id, slug, active_version, 'baseline', active, updated_by, updated_at
FROM twe.email_templates WHERE active IS NOT NULL AND active_version IS NOT NULL
ON CONFLICT DO NOTHING;
INSERT INTO twe.email_template_revisions (organisation_id, slug, version, kind, copy, created_by, created_at)
SELECT organisation_id, slug, version, 'baseline', draft, updated_by, updated_at
FROM twe.email_templates WHERE draft IS NOT NULL
ON CONFLICT DO NOTHING;
