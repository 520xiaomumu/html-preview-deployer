import { supabase } from '@/lib/db';

export function fetchDeploymentByCode(code: string) {
  return supabase.from('deployments').select('*').eq('code', code).maybeSingle();
}
export async function getNextVersionNumber(deploymentId: string) {
  const { data, error } = await supabase.from('deployment_versions').select('version_number').eq('deployment_id', deploymentId).order('version_number', { ascending: false }).limit(1).maybeSingle();
  if (error) throw new Error(error.message);
  return Number(data?.version_number ?? 0) + 1;
}
