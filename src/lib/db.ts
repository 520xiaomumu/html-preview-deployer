import { createClient } from '@supabase/supabase-js';

// These environment variables will be set in Vercel
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  const missingVars = [
    !supabaseUrl ? 'NEXT_PUBLIC_SUPABASE_URL' : null,
    !supabaseServiceKey ? 'SUPABASE_SERVICE_ROLE_KEY' : null,
  ].filter(Boolean).join(', ');

  throw new Error(
    `Missing Supabase environment variables: ${missingVars}. Pull them from Vercel with \"npm run vercel:env:pull\" or create .env.local from .env.example.`
  );
}

// Create a Supabase client with the Service Role Key for backend operations
// This bypasses RLS, which is what we want for our API routes acting as the "server"
export const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Interface for Frontend (camelCase, matches API response)
export interface Deployment {
  id: string;
  code: string;
  title: string;
  description: string | null;
  filename: string;
  filePath: string;
  fileSize: number | null;
  qrCodePath: string;
  createdAt: string;
  updatedAt: string;
  viewCount: number;
  likeCount: number;
  status: 'active' | 'inactive';
}

// Interface for Database Row (snake_case, matches Supabase)
export interface DeploymentRow {
  id: string;
  code: string;
  title: string;
  description: string | null;
  filename: string;
  file_path: string;
  file_size: number | null;
  qr_code_path: string;
  created_at: string;
  updated_at: string;
  view_count: number;
  like_count: number | null;
  status: 'active' | 'inactive';
}
