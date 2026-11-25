-- Additive form configuration. Existing enquiry rows and continuation tokens
-- are unchanged. Version 1 is the existing code-defined intake.
CREATE TABLE twe.enquiry_form_drafts (
  organisation_id uuid NOT NULL REFERENCES twe.organisations(id),
  form_id text NOT NULL CHECK (form_id = 'twe-initial-enquiry'),
  revision integer NOT NULL DEFAULT 0 CHECK (revision >= 0),
  active_version integer NOT NULL DEFAULT 1 CHECK (active_version >= 1),
  draft jsonb CHECK (draft IS NULL OR jsonb_typeof(draft) = 'object'),
  updated_by uuid NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organisation_id, form_id),
  FOREIGN KEY (organisation_id, updated_by) REFERENCES twe.staff_users(organisation_id, id)
);
CREATE TABLE twe.enquiry_form_versions (
  organisation_id uuid NOT NULL,
  form_id text NOT NULL,
  version integer NOT NULL CHECK (version >= 1),
  definition jsonb NOT NULL CHECK (jsonb_typeof(definition) = 'object'),
  activated_by uuid NOT NULL,
  activated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organisation_id, form_id, version),
  FOREIGN KEY (organisation_id, form_id) REFERENCES twe.enquiry_form_drafts(organisation_id, form_id),
  FOREIGN KEY (organisation_id, activated_by) REFERENCES twe.staff_users(organisation_id, id)
);
