CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

INSERT INTO app_settings (key, value)
VALUES ('cors_enabled', '{"enabled": false}'::jsonb)
ON CONFLICT (key) DO NOTHING;
