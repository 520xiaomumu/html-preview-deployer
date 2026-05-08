ALTER TABLE deployments
ADD COLUMN IF NOT EXISTS primary_version_strategy TEXT NOT NULL DEFAULT 'likes'
CHECK (primary_version_strategy IN ('likes', 'latest'));

UPDATE deployments
SET primary_version_strategy = 'likes'
WHERE primary_version_strategy IS NULL;
