-- Add project-level version history for deployments.
CREATE TABLE IF NOT EXISTS deployment_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    deployment_id UUID NOT NULL REFERENCES deployments(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL CHECK (version_number > 0),
    title TEXT,
    description TEXT,
    filename TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_size INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE (deployment_id, version_number)
);

ALTER TABLE deployments
ADD COLUMN IF NOT EXISTS current_version_id UUID;

CREATE INDEX IF NOT EXISTS deployment_versions_deployment_id_version_number_idx
ON deployment_versions (deployment_id, version_number DESC);

-- Backfill existing deployments as v1 so old links immediately gain history.
INSERT INTO deployment_versions (
    deployment_id,
    version_number,
    title,
    description,
    filename,
    file_path,
    file_size,
    created_at
)
SELECT
    d.id,
    1,
    d.title,
    d.description,
    d.filename,
    d.file_path,
    d.file_size,
    d.created_at
FROM deployments d
WHERE NOT EXISTS (
    SELECT 1
    FROM deployment_versions v
    WHERE v.deployment_id = d.id
);

UPDATE deployments d
SET current_version_id = v.id
FROM deployment_versions v
WHERE v.deployment_id = d.id
  AND v.version_number = 1
  AND d.current_version_id IS NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'deployments_current_version_id_fkey'
    ) THEN
        ALTER TABLE deployments
        ADD CONSTRAINT deployments_current_version_id_fkey
        FOREIGN KEY (current_version_id)
        REFERENCES deployment_versions(id)
        ON DELETE SET NULL;
    END IF;
END $$;

ALTER TABLE deployment_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public deployment versions are viewable by everyone"
ON deployment_versions FOR SELECT
TO anon, authenticated
USING (true);

CREATE POLICY "Anyone can create deployment versions"
ON deployment_versions FOR INSERT
TO anon, authenticated
WITH CHECK (true);

CREATE POLICY "Anyone can update deployment versions"
ON deployment_versions FOR UPDATE
TO anon, authenticated
USING (true);

CREATE POLICY "Anyone can delete deployment versions"
ON deployment_versions FOR DELETE
TO anon, authenticated
USING (true);
