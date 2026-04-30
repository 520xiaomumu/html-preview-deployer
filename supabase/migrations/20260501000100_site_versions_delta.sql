CREATE TABLE IF NOT EXISTS agent_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id TEXT NOT NULL DEFAULT 'admin',
  name TEXT NOT NULL,
  key_prefix TEXT NOT NULL,
  key_hash TEXT UNIQUE NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_keys_owner ON agent_keys (owner_id, created_at DESC);

CREATE TABLE IF NOT EXISTS sites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id TEXT NOT NULL DEFAULT 'admin',
  slug TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  visibility TEXT NOT NULL DEFAULT 'public' CHECK (visibility IN ('public', 'unlisted', 'private')),
  current_version_id UUID,
  view_count BIGINT NOT NULL DEFAULT 0,
  created_by UUID REFERENCES agent_keys(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(owner_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_sites_slug ON sites (slug);
CREATE INDEX IF NOT EXISTS idx_sites_owner_updated ON sites (owner_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS site_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  html_content TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  checksum TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  message TEXT NOT NULL DEFAULT '',
  created_by UUID REFERENCES agent_keys(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(site_id, version_number)
);

CREATE INDEX IF NOT EXISTS idx_sv_site_ver ON site_versions (site_id, version_number DESC);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_sites_current_version') THEN
    ALTER TABLE sites
      ADD CONSTRAINT fk_sites_current_version
      FOREIGN KEY (current_version_id) REFERENCES site_versions(id);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION publish_site_version(
  p_owner_id TEXT,
  p_slug TEXT,
  p_title TEXT,
  p_description TEXT,
  p_visibility TEXT,
  p_html TEXT,
  p_file_size INT,
  p_checksum TEXT,
  p_message TEXT,
  p_created_by UUID
) RETURNS JSON
LANGUAGE plpgsql
AS $$
DECLARE
  v_site_id UUID;
  v_cur_check TEXT;
  v_cur_num INT;
  v_next_num INT;
  v_ver_id UUID;
  v_is_new BOOLEAN := false;
BEGIN
  SELECT id INTO v_site_id
  FROM sites
  WHERE owner_id = p_owner_id AND slug = p_slug
  FOR UPDATE;

  IF v_site_id IS NULL THEN
    INSERT INTO sites (owner_id, slug, title, description, visibility, created_by)
    VALUES (
      p_owner_id,
      p_slug,
      COALESCE(NULLIF(p_title, ''), p_slug),
      COALESCE(p_description, ''),
      COALESCE(NULLIF(p_visibility, ''), 'public'),
      p_created_by
    )
    RETURNING id INTO v_site_id;
    v_is_new := true;
  END IF;

  IF NOT v_is_new THEN
    SELECT sv.checksum, sv.version_number INTO v_cur_check, v_cur_num
    FROM site_versions sv
    JOIN sites s ON s.current_version_id = sv.id
    WHERE s.id = v_site_id;

    IF v_cur_check = p_checksum THEN
      RETURN json_build_object(
        'site_id', v_site_id,
        'version_id', (SELECT current_version_id FROM sites WHERE id = v_site_id),
        'version_number', v_cur_num,
        'changed', false,
        'is_new_site', false
      );
    END IF;
  END IF;

  SELECT COALESCE(MAX(version_number), 0) + 1 INTO v_next_num
  FROM site_versions
  WHERE site_id = v_site_id;

  INSERT INTO site_versions (
    site_id, version_number, html_content, file_size, checksum, title, message, created_by
  )
  VALUES (
    v_site_id,
    v_next_num,
    p_html,
    p_file_size,
    p_checksum,
    COALESCE(NULLIF(p_title, ''), p_slug),
    COALESCE(p_message, ''),
    p_created_by
  )
  RETURNING id INTO v_ver_id;

  UPDATE sites SET
    current_version_id = v_ver_id,
    title = COALESCE(NULLIF(p_title, ''), title),
    description = CASE WHEN COALESCE(p_description, '') <> '' THEN p_description ELSE description END,
    visibility = COALESCE(NULLIF(p_visibility, ''), visibility),
    updated_at = now()
  WHERE id = v_site_id;

  RETURN json_build_object(
    'site_id', v_site_id,
    'version_id', v_ver_id,
    'version_number', v_next_num,
    'changed', true,
    'is_new_site', v_is_new
  );
END;
$$;

CREATE OR REPLACE FUNCTION rollback_site_version(
  p_owner_id TEXT,
  p_site_id UUID,
  p_version_number INT
) RETURNS JSON
LANGUAGE plpgsql
AS $$
DECLARE
  v_version_id UUID;
BEGIN
  PERFORM 1 FROM sites WHERE id = p_site_id AND owner_id = p_owner_id FOR UPDATE;

  SELECT id INTO v_version_id
  FROM site_versions
  WHERE site_id = p_site_id AND version_number = p_version_number;

  IF v_version_id IS NULL THEN
    RAISE EXCEPTION 'Site version not found';
  END IF;

  UPDATE sites
  SET current_version_id = v_version_id, updated_at = now()
  WHERE id = p_site_id AND owner_id = p_owner_id;

  RETURN json_build_object(
    'site_id', p_site_id,
    'version_id', v_version_id,
    'version_number', p_version_number
  );
END;
$$;

CREATE OR REPLACE FUNCTION increment_site_view_count(target_id UUID)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  UPDATE sites
  SET view_count = COALESCE(view_count, 0) + 1
  WHERE id = target_id;
$$;

DO $$
DECLARE
  source_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'deployments'
  ) INTO source_exists;

  IF source_exists THEN
    INSERT INTO sites (id, owner_id, slug, title, visibility, view_count, created_at, updated_at)
    SELECT
      id,
      COALESCE(owner_id, 'admin'),
      code,
      COALESCE(title, code),
      COALESCE(visibility, 'public'),
      COALESCE(view_count, 0),
      COALESCE(created_at, now()),
      COALESCE(updated_at, now())
    FROM deployments
    ON CONFLICT (owner_id, slug) DO NOTHING;

    INSERT INTO site_versions (
      site_id, version_number, html_content, file_size, checksum, title, message, created_at
    )
    SELECT
      d.id,
      1,
      COALESCE(d.html_content, ''),
      COALESCE(d.file_size, length(COALESCE(d.html_content, ''))),
      'sha256:migrated-' || d.id::text,
      COALESCE(d.title, d.code),
      'Migrated from deployments',
      COALESCE(d.created_at, now())
    FROM deployments d
    WHERE COALESCE(d.html_content, '') <> ''
    ON CONFLICT (site_id, version_number) DO NOTHING;

    UPDATE sites s
    SET current_version_id = sv.id
    FROM site_versions sv
    WHERE sv.site_id = s.id
      AND sv.version_number = 1
      AND s.current_version_id IS NULL;
  END IF;
END $$;
