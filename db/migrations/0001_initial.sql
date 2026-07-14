PRAGMA foreign_keys = ON;

CREATE TABLE domains (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  fqdn TEXT NOT NULL,
  display_name TEXT,
  provider TEXT NOT NULL CHECK (provider IN ('vercel', 'cloudflare_pages', 'cloudflare_workers')),
  provider_target_id TEXT NOT NULL,
  provider_target_name TEXT NOT NULL,
  status TEXT NOT NULL,
  provider_domain_id TEXT,
  metadata TEXT NOT NULL DEFAULT '{}',
  last_checked_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TEXT
);

CREATE UNIQUE INDEX domains_fqdn_active_unique ON domains(fqdn COLLATE NOCASE) WHERE deleted_at IS NULL;
CREATE INDEX domains_status_idx ON domains(status);
CREATE INDEX domains_provider_idx ON domains(provider);

CREATE TABLE operations (
  id TEXT PRIMARY KEY,
  domain_id TEXT REFERENCES domains(id),
  fqdn TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('create', 'refresh', 'retry', 'rollback', 'delete')),
  status TEXT NOT NULL,
  idempotency_key TEXT NOT NULL UNIQUE,
  requested_by TEXT NOT NULL,
  before_snapshot TEXT,
  after_snapshot TEXT,
  error_code TEXT,
  error_message TEXT,
  started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  finished_at TEXT
);

CREATE INDEX operations_domain_started_idx ON operations(domain_id, started_at DESC);

CREATE TABLE operation_steps (
  id TEXT PRIMARY KEY,
  operation_id TEXT NOT NULL REFERENCES operations(id),
  sequence INTEGER NOT NULL,
  name TEXT NOT NULL,
  provider TEXT,
  status TEXT NOT NULL,
  external_resource_type TEXT,
  external_resource_id TEXT,
  safe_request_summary TEXT,
  safe_response_summary TEXT,
  error_code TEXT,
  error_message TEXT,
  started_at TEXT,
  finished_at TEXT,
  UNIQUE(operation_id, sequence)
);

CREATE TABLE managed_resources (
  id TEXT PRIMARY KEY,
  domain_id TEXT NOT NULL REFERENCES domains(id),
  provider TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  external_id TEXT NOT NULL,
  external_name TEXT NOT NULL,
  created_by_operation_id TEXT NOT NULL REFERENCES operations(id),
  ownership_fingerprint TEXT NOT NULL,
  deleted_at TEXT,
  UNIQUE(provider, resource_type, external_id)
);

CREATE INDEX managed_resources_domain_idx ON managed_resources(domain_id);

CREATE TABLE schema_migrations (
  id TEXT PRIMARY KEY,
  applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
