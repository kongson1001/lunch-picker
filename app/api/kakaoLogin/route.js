import { NextResponse } from 'next/server';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const redirectUri = searchParams.get('redirectUri');

  if (!redirectUri) {
    return NextResponse.json({ error: 'redirectUri가 필요합니다' }, { status: 400 });
  }

  const restApiKey = process.env.KAKAO_REST_API_KEY;
  const kakaoUrl = `https://kauth.kakao.com/oauth/authorize?client_id=${restApiKey}&redirect_uri=${redirectUri}&response_type=code`;

  return NextResponse.redirect(kakaoUrl);
}
