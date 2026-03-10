import { NextResponse } from 'next/server';

export async function POST(request) {
  const { roomId, password } = await request.json();

  if (!roomId || !password) {
    return NextResponse.json({ error: 'roomId와 password가 필요합니다' }, { status: 400 });
  }

  const DATABASE_URL = process.env.FIREBASE_DATABASE_URL;
  if (!DATABASE_URL) {
    return NextResponse.json({ error: 'DATABASE_URL not configured' }, { status: 500 });
  }

  try {
    const response = await fetch(`${DATABASE_URL}/rooms/${roomId}/password.json`);
    const expectedPassword = await response.json();

    if (expectedPassword === password) {
      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json({ success: false, error: '비밀번호가 일치하지 않습니다.' }, { status: 401 });
    }
  } catch (error) {
    console.error('Password check failed:', error);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
