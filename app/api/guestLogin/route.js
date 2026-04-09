import { NextResponse } from 'next/server';
import { getDb } from '../../lib/db.js';
import { createSessionCookie } from '../../lib/auth.js';
import crypto from 'crypto';

export async function POST(request) {
  const { nickname } = await request.json();

  if (!nickname?.trim()) {
    return NextResponse.json({ error: '이름을 입력해주세요' }, { status: 400 });
  }

  const trimmed = nickname.trim();

  // 서버 사이드 이름 중복 재검증
  const pool = await getDb();
  const { rows } = await pool.query(
    `SELECT id FROM users WHERE data->>'nickname' = $1`,
    [trimmed]
  );

  if (rows.length > 0) {
    return NextResponse.json({ error: '사용이 불가능한 이름입니다' }, { status: 409 });
  }

  const uid = `guest_${crypto.randomBytes(4).toString('hex')}`;

  const response = NextResponse.json({ uid, nickname: trimmed, isGuest: true });
  response.headers.set('Set-Cookie', createSessionCookie({ uid, isGuest: true }));
  return response;
}
