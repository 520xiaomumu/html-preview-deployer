import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/db';

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

    // Map fields
    const formattedDeployment = {
      id: deployment.id,
      code: deployment.code,
      title: deployment.title,
      filename: deployment.filename,
      filePath: deployment.file_path,
      fileSize: deployment.file_size,
      qrCodePath: deployment.qr_code_path,
      createdAt: deployment.created_at,
      updatedAt: deployment.updated_at,
      viewCount: deployment.view_count,
      status: deployment.status
    };

    return NextResponse.json(formattedDeployment);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
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
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
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
    const { data: deployment, error: fetchError } = await supabase
      .from('deployments')
      .select('code')
      .eq('id', id)
      .single();

    if (fetchError || !deployment) {
      return NextResponse.json(
        { error: 'Deployment not found' },
        { status: 404 }
      );
    }

    const { code } = deployment;

    // Delete files from Storage
    // Paths are known based on code
    const htmlPath = `html/${code}.html`;
    const qrPath = `qrcodes/${code}.png`;

    const { error: storageError } = await supabase.storage
      .from('deployments')
      .remove([htmlPath, qrPath]);
      
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
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
