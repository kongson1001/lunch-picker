import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    clientId: process.env.NAVER_MAPS_CLIENT_ID,
  });
}
