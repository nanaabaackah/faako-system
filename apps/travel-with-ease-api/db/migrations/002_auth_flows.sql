CREATE TABLE twe.auth_flows (
  token_hash TEXT PRIMARY KEY CHECK (token_hash ~ '^[a-f0-9]{64}$'),
  state TEXT NOT NULL,
  nonce TEXT NOT NULL,
  verifier TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX auth_flows_expiry_idx ON twe.auth_flows (expires_at);
