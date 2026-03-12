ALTER TABLE deployments
ADD COLUMN IF NOT EXISTS file_size BIGINT;

CREATE OR REPLACE FUNCTION increment_deployment_view_count(target_id UUID)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  UPDATE deployments
  SET view_count = COALESCE(view_count, 0) + 1
  WHERE id = target_id;
$$;
