import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    naverClientId: process.env.NAVER_MAPS_CLIENT_ID,
  });
}
