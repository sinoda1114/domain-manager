ALTER TABLE domains ADD COLUMN delete_at TEXT;

CREATE INDEX domains_delete_at_idx
  ON domains(delete_at)
  WHERE deleted_at IS NULL AND delete_at IS NOT NULL;
