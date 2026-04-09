import { NextResponse } from 'next/server';
import { getDb } from '../../lib/db.js';
import { createSessionCookie } from '../../lib/auth.js';
import crypto from 'crypto';

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  const [salt, hash] = stored.split(':');
  const hashToVerify = crypto.scryptSync(password, salt, 64).toString('hex');
  return hashToVerify === hash;
}

export async function POST(request) {
  const { nickname, password } = await request.json();

  if (!nickname?.trim()) {
    return NextResponse.json({ error: '이름을 입력해주세요' }, { status: 400 });
  }
  if (!password?.trim()) {
    return NextResponse.json({ error: '비밀번호를 입력해주세요' }, { status: 400 });
  }

  const trimmedNickname = nickname.trim();
  const pool = await getDb();

  // 같은 닉네임의 기존 게스트 계정 조회
  const { rows: guestRows } = await pool.query(
    `SELECT id, data FROM users WHERE data->'profile'->>'nickname' = $1 AND data->>'isGuest' = 'true'`,
    [trimmedNickname]
  );

  if (guestRows.length > 0) {
    // 재방문 — 비밀번호 검증
    const guest = guestRows[0];
    const passwordHash = guest.data.passwordHash;
    if (!passwordHash || !verifyPassword(password, passwordHash)) {
      return NextResponse.json({ error: '비밀번호가 틀렸습니다' }, { status: 401 });
    }
    const uid = guest.id;
    const response = NextResponse.json({ uid, nickname: trimmedNickname, isGuest: true });
    response.headers.set('Set-Cookie', createSessionCookie({ uid, isGuest: true }));
    return response;
  }

  // 신규 게스트 — 닉네임 중복 검사 (카카오 유저 포함)
  const { rows: existing } = await pool.query(
    `SELECT id FROM users WHERE data->'profile'->>'nickname' = $1`,
    [trimmedNickname]
  );
  if (existing.length > 0) {
    return NextResponse.json({ error: '사용이 불가능한 이름입니다' }, { status: 409 });
  }

  // 신규 계정 생성
  const uid = `guest_${crypto.randomBytes(4).toString('hex')}`;
  const passwordHash = hashPassword(password);
  const userData = {
    profile: { nickname: trimmedNickname, profileImage: null, updatedAt: Date.now() },
    isGuest: true,
    passwordHash,
  };

  await pool.query(
    `INSERT INTO users (id, data) VALUES ($1, $2)`,
    [uid, JSON.stringify(userData)]
  );

  const response = NextResponse.json({ uid, nickname: trimmedNickname, isGuest: true });
  response.headers.set('Set-Cookie', createSessionCookie({ uid, isGuest: true }));
  return response;
}
