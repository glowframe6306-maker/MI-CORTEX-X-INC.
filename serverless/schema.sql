CREATE TABLE IF NOT EXISTS site_admins (
  username TEXT PRIMARY KEY CHECK (username ~ '^[A-Za-z0-9._-]{3,64}$'),
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role = 'CEO'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS site_admins_one_ceo_idx ON site_admins ((role));

CREATE TABLE IF NOT EXISTS admins (
  email TEXT PRIMARY KEY CHECK (email ~* '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' AND LENGTH(email) <= 254),
  password_salt TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS admins_single_account_idx ON admins ((1));

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  audience TEXT NOT NULL CHECK (audience IN ('site_admin', 'careers_admin')),
  principal TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS sessions_expiry_idx ON sessions (expires_at);

CREATE TABLE IF NOT EXISTS rate_limits (
  scope TEXT NOT NULL,
  key_hash TEXT NOT NULL,
  count INTEGER NOT NULL CHECK (count > 0),
  window_started_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (scope, key_hash)
);

CREATE TABLE IF NOT EXISTS applications (
  id UUID PRIMARY KEY,
  company_id TEXT NOT NULL,
  company_name TEXT NOT NULL,
  position_title TEXT NOT NULL,
  position_category TEXT NOT NULL,
  encrypted_applicant TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new'
    CHECK (status IN ('new', 'reviewing', 'shortlisted', 'rejected', 'withdrawn')),
  privacy_consent_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS applications_created_idx ON applications (created_at DESC, id);

CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY,
  application_id UUID REFERENCES applications(id) ON DELETE CASCADE,
  upload_batch_id UUID,
  blob_pathname TEXT NOT NULL UNIQUE,
  encrypted_metadata TEXT NOT NULL,
  size_bytes BIGINT NOT NULL CHECK (size_bytes > 0 AND size_bytes <= 10485760),
  upload_complete BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS documents_application_idx ON documents (application_id);
CREATE INDEX IF NOT EXISTS documents_expiry_idx ON documents (expires_at);
