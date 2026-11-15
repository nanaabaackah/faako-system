-- Short-lived, pseudonymised counters shared by every API replica. The
-- application HMACs client addresses before persistence; raw addresses and
-- request content never enter this table.
CREATE TABLE twe.rate_limit_buckets (
  scope TEXT NOT NULL CHECK (scope ~ '^[a-z][a-z0-9_-]{1,79}$'),
  key_hash TEXT NOT NULL CHECK (key_hash ~ '^[a-f0-9]{64}$'),
  request_count INTEGER NOT NULL CHECK (request_count > 0),
  expires_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (scope, key_hash)
);
CREATE INDEX rate_limit_buckets_expiry ON twe.rate_limit_buckets(expires_at);
