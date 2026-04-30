import { NextResponse } from 'next/server';
import { createSessionCookie } from '../../lib/auth.js';
import { getDb, toKST } from '../../lib/db.js';

export async function POST(request) {
  const { adminId, adminPw } = await request.json();

  const EXPECTED_ID = process.env.ADMIN_ID;
  const EXPECTED_PW = process.env.ADMIN_PW;

  if (!EXPECTED_ID || !EXPECTED_PW) {
    console.error('[SECURITY] ADMIN_ID or ADMIN_PW is not configured in environment variables.');
    return NextResponse.json({ success: false, error: '서버 설정 오류가 발생했습니다.' }, { status: 500 });
  }

  if (adminId === EXPECTED_ID && adminPw === EXPECTED_PW) {
    const adminUser = { uid: 'admin', nickname: '관리자', isAdmin: true };

    const pool = await getDb();
    await pool.query(
      'INSERT INTO login_history (uid, nickname, type, logged_in_at, login_time) VALUES ($1, $2, $3, $4, $5)',
      ['admin', '관리자', 'admin', Date.now(), toKST()]
    );

    const response = NextResponse.json({ success: true, adminUser });
    response.headers.set('Set-Cookie', createSessionCookie({ uid: 'admin', isAdmin: true }));
    return response;
  } else {
    return NextResponse.json({ success: false, error: '인증 정보가 일치하지 않습니다.' }, { status: 401 });
  }
}
