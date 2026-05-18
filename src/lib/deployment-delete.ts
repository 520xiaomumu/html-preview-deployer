import { supabase } from '@/lib/db';
import { getStoragePathFromFilePath, listHtmlPathsByCode } from '@/lib/storage';

export async function deleteDeploymentFilesAndRecord(deployment: { id: string; code: string }) {
  const bucket = supabase.storage.from('deployments');
  const { data: versions, error: versionsError } = await supabase
    .from('deployment_versions')
    .select('file_path')
    .eq('deployment_id', deployment.id);

  if (versionsError) {
    throw new Error(versionsError.message);
  }

  let htmlPaths = (versions || [])
    .map((version) => getStoragePathFromFilePath(version.file_path, deployment.code))
    .filter((path, index, paths) => path && paths.indexOf(path) === index);

  try {
    const discoveredPaths = await listHtmlPathsByCode(bucket, deployment.code);
    htmlPaths = Array.from(new Set([...htmlPaths, ...discoveredPaths]));
  } catch (error) {
    console.error('Error listing html files from storage:', error);
  }

  if (htmlPaths.length === 0) {
    htmlPaths.push(`html/${deployment.code}.html`);
  }

  const paths = [...htmlPaths, `qrcodes/${deployment.code}.png`];
  const { error: storageError } = await bucket.remove(paths);
  if (storageError) {
    console.error('Error deleting files from storage:', storageError);
  }

  const { error: deleteError } = await supabase
    .from('deployments')
    .delete()
    .eq('id', deployment.id);

  if (deleteError) {
    throw new Error(deleteError.message);
  }

  return {
    deletedPaths: paths,
    storageError: storageError?.message ?? null,
  };
}
