import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/db';
import QRCode from 'qrcode';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { content, filename, title } = body;

    if (!content || !filename) {
      return NextResponse.json(
        { success: false, error: 'Content and filename are required' },
        { status: 400 }
      );
    }

    // Generate IDs
    const code = Math.random().toString(36).substring(2, 8);
  const fileSize = Buffer.byteLength(content, 'utf8');
    
    // Determine protocol and host for the deployment URL
    const host = request.headers.get('host') || 'localhost:3000';
    const forwardedProto = request.headers.get('x-forwarded-proto');
    let protocol = forwardedProto ? forwardedProto.split(',')[0] : 'http';
    
    if (!forwardedProto) {
      if (host.includes('localhost') || host.includes('127.0.0.1')) {
        protocol = 'http';
      } else {
        protocol = 'https';
      }
    }

    const deployUrl = `${protocol}://${host}/s/${code}`;

    // 1. Upload HTML to Supabase Storage
    const htmlPath = `html/${code}.html`;
    const { error: uploadHtmlError } = await supabase.storage
      .from('deployments')
      .upload(htmlPath, content, {
        contentType: 'text/html',
        upsert: true
      });

    if (uploadHtmlError) throw new Error(`HTML Upload failed: ${uploadHtmlError.message}`);

    // 2. Generate and Upload QR Code
    const qrBuffer = await QRCode.toBuffer(deployUrl);
    const qrPath = `qrcodes/${code}.png`;
    const { error: uploadQrError } = await supabase.storage
      .from('deployments')
      .upload(qrPath, qrBuffer, {
        contentType: 'image/png',
        upsert: true
      });

    if (uploadQrError) throw new Error(`QR Upload failed: ${uploadQrError.message}`);

    // Get Public URLs
    const { data: { publicUrl: htmlPublicUrl } } = supabase.storage.from('deployments').getPublicUrl(htmlPath);
    const { data: { publicUrl: qrPublicUrl } } = supabase.storage.from('deployments').getPublicUrl(qrPath);

    // 3. Save to Supabase DB
    const { data, error: dbError } = await supabase
      .from('deployments')
      .insert({
        code,
        title: title || filename,
        filename,
        file_path: htmlPublicUrl, // Storing the public URL for easy access
        file_size: fileSize,
        qr_code_path: qrPublicUrl,
        status: 'active'
      })
      .select()
      .single();

    if (dbError) throw new Error(`DB Insert failed: ${dbError.message}`);

    return NextResponse.json({
      success: true,
      id: data.id,
      code: data.code,
      url: deployUrl,
      qrCode: qrPublicUrl
    });

  } catch (error: any) {
    console.error('Deployment error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
