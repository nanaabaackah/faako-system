-- User-owned preferences, never authorisation state. Existing staff are preserved.
CREATE TABLE twe.tutorial_progress (
  organisation_id uuid NOT NULL,
  user_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new','active','paused','completed')),
  enabled boolean NOT NULL DEFAULT true,
  position text,
  completed jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(completed) = 'array'),
  last_completed_version integer NOT NULL DEFAULT 0,
  revision integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organisation_id,user_id),
  FOREIGN KEY (organisation_id,user_id) REFERENCES twe.staff_users(organisation_id,id)
);
