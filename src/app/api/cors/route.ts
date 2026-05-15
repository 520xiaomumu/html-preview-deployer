import { NextRequest, NextResponse } from 'next/server';
import { isCorsEnabled, setCorsEnabled } from '@/lib/cors-state';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({ enabled: await isCorsEnabled() });
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: '请求格式错误' },
      { status: 400 },
    );
  }

  const { password, enabled } = (body ?? {}) as {
    password?: unknown;
    enabled?: unknown;
  };

  const togglePassword = process.env.CORS_TOGGLE_PASSWORD;

  if (!togglePassword) {
    return NextResponse.json(
      { error: 'CORS 密码未配置' },
      { status: 500 },
    );
  }

  if (typeof password !== 'string' || password !== togglePassword) {
    return NextResponse.json({ error: '密码错误' }, { status: 401 });
  }

  if (typeof enabled !== 'boolean') {
    return NextResponse.json(
      { error: 'enabled 字段必须是布尔值' },
      { status: 400 },
    );
  }

  try {
    return NextResponse.json({ enabled: await setCorsEnabled(enabled) });
  } catch (error) {
    console.error('Update CORS setting failed:', error);
    return NextResponse.json({ error: 'CORS 状态更新失败' }, { status: 500 });
  }
}
