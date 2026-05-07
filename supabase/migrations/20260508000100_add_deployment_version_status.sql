ALTER TABLE deployment_versions
ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active'
CHECK (status IN ('active', 'inactive'));

UPDATE deployment_versions
SET status = 'active'
WHERE status IS NULL;

CREATE INDEX IF NOT EXISTS deployment_versions_deployment_id_status_version_number_idx
ON deployment_versions (deployment_id, status, version_number DESC);
