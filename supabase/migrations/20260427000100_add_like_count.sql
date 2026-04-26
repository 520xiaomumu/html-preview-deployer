ALTER TABLE deployments
ADD COLUMN IF NOT EXISTS like_count INTEGER NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION increment_deployment_like_count(target_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  next_count INTEGER;
BEGIN
  UPDATE deployments
  SET like_count = COALESCE(like_count, 0) + 1
  WHERE id = target_id
  RETURNING like_count INTO next_count;

  RETURN COALESCE(next_count, 0);
END;
$$;
