CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

ALTER TABLE deployments
ADD COLUMN IF NOT EXISTS version_count INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_content_uploaded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now();

UPDATE deployments d
SET
  version_count = counts.version_count,
  last_content_uploaded_at = COALESCE(counts.last_content_uploaded_at, d.created_at)
FROM (
  SELECT
    deployment_id,
    COUNT(*)::INTEGER AS version_count,
    MAX(
      CASE
        WHEN file_path ~ '/v[0-9]+-[0-9]{13}\\.html(?:\\?|$)'
          THEN to_timestamp((substring(file_path FROM '/v[0-9]+-([0-9]{13})\\.html')::NUMERIC) / 1000)
        ELSE created_at
      END
    ) AS last_content_uploaded_at
  FROM deployment_versions
  GROUP BY deployment_id
) counts
WHERE counts.deployment_id = d.id;

CREATE OR REPLACE FUNCTION sync_deployment_version_stats()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE deployments
    SET
      version_count = version_count + 1,
      last_content_uploaded_at = GREATEST(
        last_content_uploaded_at,
        COALESCE(NEW.updated_at, NEW.created_at, now())
      )
    WHERE id = NEW.deployment_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE deployments
    SET version_count = GREATEST(version_count - 1, 0)
    WHERE id = OLD.deployment_id;
  ELSIF NEW.file_path IS DISTINCT FROM OLD.file_path THEN
    UPDATE deployments
    SET last_content_uploaded_at = COALESCE(NEW.updated_at, now())
    WHERE id = NEW.deployment_id;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS deployment_versions_sync_stats ON deployment_versions;
CREATE TRIGGER deployment_versions_sync_stats
AFTER INSERT OR DELETE OR UPDATE OF file_path ON deployment_versions
FOR EACH ROW EXECUTE FUNCTION sync_deployment_version_stats();

CREATE INDEX IF NOT EXISTS deployments_cleanup_candidates_idx
ON deployments (last_content_uploaded_at, id)
WHERE COALESCE(like_count, 0) = 0;

CREATE OR REPLACE FUNCTION get_cleanup_candidates(
  cutoff TIMESTAMP WITH TIME ZONE,
  after_id UUID DEFAULT NULL,
  page_size INTEGER DEFAULT 500
)
RETURNS TABLE (
  id UUID,
  code TEXT,
  file_paths TEXT[]
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    d.id,
    d.code,
    COALESCE(
      ARRAY_AGG(v.file_path ORDER BY v.version_number)
        FILTER (WHERE v.file_path IS NOT NULL),
      ARRAY[]::TEXT[]
    ) AS file_paths
  FROM deployments d
  LEFT JOIN deployment_versions v ON v.deployment_id = d.id
  WHERE COALESCE(d.like_count, 0) = 0
    AND (
      d.version_count <= 1
      OR d.last_content_uploaded_at < cutoff
    )
    AND (after_id IS NULL OR d.id > after_id)
  GROUP BY d.id, d.code
  ORDER BY d.id
  LIMIT LEAST(GREATEST(page_size, 1), 1000);
$$;

REVOKE ALL ON FUNCTION get_cleanup_candidates(TIMESTAMP WITH TIME ZONE, UUID, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_cleanup_candidates(TIMESTAMP WITH TIME ZONE, UUID, INTEGER) TO service_role;

DO $$
DECLARE
  existing_job_id BIGINT;
BEGIN
  SELECT jobid INTO existing_job_id
  FROM cron.job
  WHERE jobname = 'cleanup-expired-deployments-beijing-midnight';

  IF existing_job_id IS NOT NULL THEN
    PERFORM cron.unschedule(existing_job_id);
  END IF;

  PERFORM cron.schedule(
    'cleanup-expired-deployments-beijing-midnight',
    '0 16 * * *',
    $schedule$
      SELECT net.http_post(
        url := 'https://copbkczlbmqesnvamoik.supabase.co/functions/v1/cleanup-expired-deployments',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-cleanup-secret', (
            SELECT decrypted_secret
            FROM vault.decrypted_secrets
            WHERE name = 'cleanup_expired_deployments_secret'
            LIMIT 1
          )
        ),
        body := jsonb_build_object('source', 'supabase-cron'),
        timeout_milliseconds := 300000
      );
    $schedule$
  );
END;
$$;
