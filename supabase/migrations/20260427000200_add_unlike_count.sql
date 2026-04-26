CREATE OR REPLACE FUNCTION decrement_deployment_like_count(target_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  next_count INTEGER;
BEGIN
  UPDATE deployments
  SET like_count = GREATEST(COALESCE(like_count, 0) - 1, 0)
  WHERE id = target_id
  RETURNING like_count INTO next_count;

  RETURN COALESCE(next_count, 0);
END;
$$;
