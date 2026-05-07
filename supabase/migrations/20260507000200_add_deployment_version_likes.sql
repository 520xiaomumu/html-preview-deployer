DO $$
DECLARE
  version_like_column_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'deployment_versions'
      AND column_name = 'like_count'
  ) INTO version_like_column_exists;

  ALTER TABLE deployment_versions
  ADD COLUMN IF NOT EXISTS like_count INTEGER NOT NULL DEFAULT 0;

  IF NOT version_like_column_exists THEN
    UPDATE deployment_versions v
    SET like_count = GREATEST(COALESCE(d.like_count, 0), COALESCE(v.like_count, 0))
    FROM deployments d
    WHERE d.current_version_id = v.id
      AND COALESCE(d.like_count, 0) > 0;
  END IF;
END $$;

UPDATE deployments d
SET like_count = COALESCE(version_totals.total_like_count, 0)
FROM (
  SELECT deployment_id, SUM(COALESCE(like_count, 0))::INTEGER AS total_like_count
  FROM deployment_versions
  GROUP BY deployment_id
) version_totals
WHERE version_totals.deployment_id = d.id;

CREATE OR REPLACE FUNCTION sync_deployment_like_count(target_deployment_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  total_count INTEGER;
BEGIN
  SELECT COALESCE(SUM(COALESCE(like_count, 0)), 0)::INTEGER
  INTO total_count
  FROM deployment_versions
  WHERE deployment_id = target_deployment_id;

  UPDATE deployments
  SET like_count = total_count
  WHERE id = target_deployment_id;

  RETURN COALESCE(total_count, 0);
END;
$$;

CREATE OR REPLACE FUNCTION increment_deployment_version_like_count(target_version_id UUID)
RETURNS TABLE(deployment_id UUID, version_id UUID, version_like_count INTEGER, deployment_like_count INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  target_deployment_id UUID;
  next_version_count INTEGER;
  next_deployment_count INTEGER;
BEGIN
  UPDATE deployment_versions
  SET like_count = COALESCE(like_count, 0) + 1
  WHERE id = target_version_id
  RETURNING deployment_versions.deployment_id, deployment_versions.like_count
  INTO target_deployment_id, next_version_count;

  next_deployment_count := sync_deployment_like_count(target_deployment_id);

  RETURN QUERY SELECT target_deployment_id, target_version_id, COALESCE(next_version_count, 0), COALESCE(next_deployment_count, 0);
END;
$$;

CREATE OR REPLACE FUNCTION decrement_deployment_version_like_count(target_version_id UUID)
RETURNS TABLE(deployment_id UUID, version_id UUID, version_like_count INTEGER, deployment_like_count INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  target_deployment_id UUID;
  next_version_count INTEGER;
  next_deployment_count INTEGER;
BEGIN
  UPDATE deployment_versions
  SET like_count = GREATEST(COALESCE(like_count, 0) - 1, 0)
  WHERE id = target_version_id
  RETURNING deployment_versions.deployment_id, deployment_versions.like_count
  INTO target_deployment_id, next_version_count;

  next_deployment_count := sync_deployment_like_count(target_deployment_id);

  RETURN QUERY SELECT target_deployment_id, target_version_id, COALESCE(next_version_count, 0), COALESCE(next_deployment_count, 0);
END;
$$;
