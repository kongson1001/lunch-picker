import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    naverClientId: process.env.NAVER_MAPS_CLIENT_ID,
    kakaoJsKey: process.env.KAKAO_JS_KEY, // 서버 환경변수에서 가져옴
  });
}
