import { NextResponse } from 'next/server';

export async function POST(request) {
  const { adminId, adminPw } = await request.json();

  const EXPECTED_ID = process.env.ADMIN_ID;
  const EXPECTED_PW = process.env.ADMIN_PW;

  if (!EXPECTED_ID || !EXPECTED_PW) {
    console.error('[SECURITY] ADMIN_ID or ADMIN_PW is not configured in environment variables.');
    return NextResponse.json({ success: false, error: '서버 설정 오류가 발생했습니다.' }, { status: 500 });
  }

  if (adminId === EXPECTED_ID && adminPw === EXPECTED_PW) {
    return NextResponse.json({ 
      success: true, 
      adminUser: {
        uid: 'admin_test_id',
        nickname: '관리자(보안인증)',
        isAdmin: true
      }
    });
  } else {
    return NextResponse.json({ success: false, error: '인증 정보가 일치하지 않습니다.' }, { status: 401 });
  }
}
