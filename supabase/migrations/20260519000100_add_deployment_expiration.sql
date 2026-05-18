ALTER TABLE deployments
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP WITH TIME ZONE;

CREATE INDEX IF NOT EXISTS deployments_expires_at_idx
ON deployments (expires_at)
WHERE expires_at IS NOT NULL;
