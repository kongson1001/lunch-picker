import { NextResponse } from 'next/server';
import { createSessionCookie } from '../../lib/auth.js';
import { getDb, toKST } from '../../lib/db.js';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const redirectUri = searchParams.get('redirectUri');

  if (!code || !redirectUri) {
    return NextResponse.json({ error: 'code와 redirectUri가 필요합니다' }, { status: 400 });
  }

  // 1. access_token 발급
  const tokenBody = `grant_type=authorization_code&client_id=${process.env.KAKAO_REST_API_KEY}&redirect_uri=${redirectUri}&code=${code}`;
  const tokenRes = await fetch('https://kauth.kakao.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8' },
    body: tokenBody,
  });
  const tokenData = await tokenRes.json();

  if (tokenData.error) {
    console.error('[kakaoAuth] 토큰 발급 실패:', tokenData.error_code);
    return NextResponse.json(tokenData, { status: 400 });
  }

  // 2. 서버에서 유저 정보 조회 (access_token 브라우저에 노출 안 함)
  const userRes = await fetch('https://kapi.kakao.com/v2/user/me', {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });
  const userData = await userRes.json();

  if (!userData.id) {
    return NextResponse.json({ error: '유저 정보 조회 실패' }, { status: 400 });
  }

  const uid = `kakao_${userData.id}`;
  const nickname = userData.kakao_account?.profile?.nickname || `사용자${userData.id}`;

  // 3. 로그인 이력 저장
  const pool = await getDb();
  await pool.query(
    'INSERT INTO login_history (uid, nickname, type, logged_in_at, login_time) VALUES ($1, $2, $3, $4, $5)',
    [uid, nickname, 'kakao', Date.now(), toKST()]
  );

  // 4. JWT 세션 쿠키 발급
  const response = NextResponse.json({ uid, nickname });
  response.headers.set('Set-Cookie', createSessionCookie({ uid, isAdmin: false }));
  return response;
}
