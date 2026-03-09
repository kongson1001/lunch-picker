import { NextResponse } from 'next/server';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const redirectUri = searchParams.get('redirectUri');

  if (!code || !redirectUri) {
    return NextResponse.json({ error: 'code와 redirectUri가 필요합니다' }, { status: 400 });
  }

  const response = await fetch('https://kauth.kakao.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: process.env.KAKAO_REST_API_KEY,
      redirect_uri: redirectUri,
      code,
    }),
  });

  const data = await response.json();

  if (data.error) {
    return NextResponse.json(data, { status: 400 });
  }

  return NextResponse.json({ access_token: data.access_token });
}
