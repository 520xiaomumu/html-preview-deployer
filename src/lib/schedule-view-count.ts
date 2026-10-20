import { after } from 'next/server';
import { supabase } from '@/lib/db';

export function scheduleDeploymentViewCount(deploymentId: string) {
  after(async () => {
    try {
      const { error } = await supabase.rpc('increment_deployment_view_count', {
        target_id: deploymentId,
      });
      if (error) {
        console.error('Increment view count error:', error);
      }
    } catch (error) {
      console.error('Increment view count error:', error);
    }
  });
}
