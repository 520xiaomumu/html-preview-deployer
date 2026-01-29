-- Create deployments table
CREATE TABLE IF NOT EXISTS deployments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT UNIQUE NOT NULL,
    title TEXT,
    filename TEXT NOT NULL,
    file_path TEXT NOT NULL,
    qr_code_path TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    view_count INTEGER DEFAULT 0,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive'))
);

-- Enable RLS
ALTER TABLE deployments ENABLE ROW LEVEL SECURITY;

-- Allow public read access to deployments
CREATE POLICY "Public deployments are viewable by everyone" 
ON deployments FOR SELECT 
TO anon, authenticated 
USING (true);

-- Allow public insert access (since we don't have auth yet, anyone can deploy)
CREATE POLICY "Anyone can create a deployment" 
ON deployments FOR INSERT 
TO anon, authenticated 
WITH CHECK (true);

-- Allow public update access (simplified for this demo)
CREATE POLICY "Anyone can update a deployment" 
ON deployments FOR UPDATE 
TO anon, authenticated 
USING (true);

-- Allow public delete access (simplified for this demo)
CREATE POLICY "Anyone can delete a deployment" 
ON deployments FOR DELETE 
TO anon, authenticated 
USING (true);

-- Create storage bucket for deployments if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('deployments', 'deployments', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
-- Allow public read access to files
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'deployments');

-- Allow public upload access
CREATE POLICY "Public Upload"
ON storage.objects FOR INSERT
TO public
WITH CHECK (bucket_id = 'deployments');

-- Allow public update access
CREATE POLICY "Public Update"
ON storage.objects FOR UPDATE
TO public
USING (bucket_id = 'deployments');

-- Allow public delete access
CREATE POLICY "Public Delete"
ON storage.objects FOR DELETE
TO public
USING (bucket_id = 'deployments');
