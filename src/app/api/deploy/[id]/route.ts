import { NextRequest, NextResponse } from 'next/server';
import { DeploymentRow, supabase } from '@/lib/db';
import { mapDeploymentRow } from '@/lib/deployment-mapper';
import { listHtmlPathsByCode } from '@/lib/storage';
import { getErrorMessage, isMissingLikeCountError } from '@/lib/error';

async function fetchDeploymentLockState(id: string) {
  const { data, error } = await supabase
    .from('deployments')
    .select('like_count')
    .eq('id', id)
    .maybeSingle();

  if (isMissingLikeCountError(error)) {
    const { data: fallbackData, error: fallbackError } = await supabase
      .from('deployments')
      .select('id')
      .eq('id', id)
      .maybeSingle();

    return {
      found: Boolean(fallbackData),
      locked: false,
      error: fallbackError?.message,
    };
  }

  return {
    found: Boolean(data),
    locked: Number(data?.like_count ?? 0) > 0,
    error: error?.message,
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { data: deployment, error } = await supabase
      .from('deployments')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !deployment) {
      return NextResponse.json(
        { error: 'Deployment not found' },
        { status: 404 }
      );
    }

    const formattedDeployment = mapDeploymentRow(deployment as DeploymentRow);

    return NextResponse.json(formattedDeployment);
  } catch (error: unknown) {
    return NextResponse.json(
      { error: getErrorMessage(error) },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { status } = body;

    if (!['active', 'inactive'].includes(status)) {
      return NextResponse.json(
        { error: 'Invalid status' },
        { status: 400 }
      );
    }

    const lockState = await fetchDeploymentLockState(id);

    if (lockState.error || !lockState.found) {
      return NextResponse.json(
        { error: 'Deployment not found' },
        { status: 404 }
      );
    }

    if (lockState.locked) {
      return NextResponse.json(
        { error: 'This deployment has likes and is locked.' },
        { status: 423 }
      );
    }

    const { error } = await supabase
      .from('deployments')
      .update({ status })
      .eq('id', id);

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: getErrorMessage(error) },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    // Get deployment info first to find files
    let { data: deployment, error: fetchError } = await supabase
      .from('deployments')
      .select('code, like_count')
      .eq('id', id)
      .maybeSingle();

    if (isMissingLikeCountError(fetchError)) {
      const fallback = await supabase
        .from('deployments')
        .select('code')
        .eq('id', id)
        .maybeSingle();

      deployment = fallback.data ? { ...fallback.data, like_count: 0 } : null;
      fetchError = fallback.error;
    }

    if (fetchError || !deployment) {
      return NextResponse.json(
        { error: 'Deployment not found' },
        { status: 404 }
      );
    }

    const { code } = deployment;

    if (Number(deployment.like_count ?? 0) > 0) {
      return NextResponse.json(
        { error: 'This deployment has likes and is locked.' },
        { status: 423 }
      );
    }

    const bucket = supabase.storage.from('deployments');
    let htmlPaths: string[] = [];
    try {
      htmlPaths = await listHtmlPathsByCode(bucket, code);
    } catch (listError) {
      console.error('Error listing html files from storage:', listError);
    }

    if (htmlPaths.length === 0) {
      htmlPaths.push(`html/${code}.html`);
    }

    const qrPath = `qrcodes/${code}.png`;

    const { error: storageError } = await bucket.remove([...htmlPaths, qrPath]);
      
    if (storageError) {
      console.error('Error deleting files from storage:', storageError);
      // We continue to delete from DB even if storage fails, or we could stop.
      // Usually better to clean up DB.
    }

    // Hard delete: Remove from DB
    const { error: deleteError } = await supabase
      .from('deployments')
      .delete()
      .eq('id', id);

    if (deleteError) {
      return NextResponse.json(
        { error: deleteError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: getErrorMessage(error) },
      { status: 500 }
    );
  }
}
