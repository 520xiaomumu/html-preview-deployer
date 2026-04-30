import { NextResponse } from 'next/server';

export function GET() {
  return NextResponse.json({
    success: true,
    service: 'htmlteam',
    mode: 'agent-native',
    version: '0.1.0',
  });
}
