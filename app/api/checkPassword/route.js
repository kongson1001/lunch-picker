import { NextResponse } from 'next/server';
import { getDb } from '../../lib/db.js';

export async function POST(request) {
  const { roomId, password } = await request.json();
  if (!roomId || !password) {
    return NextResponse.json({ error: 'roomId와 password가 필요합니다' }, { status: 400 });
  }
  try {
    const row = getDb().prepare('SELECT password FROM rooms WHERE id = ?').get(roomId);
    if (!row) return NextResponse.json({ success: false, error: '방을 찾을 수 없습니다.' }, { status: 404 });
    if (row.password === password) {
      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json({ success: false, error: '비밀번호가 일치하지 않습니다.' }, { status: 401 });
    }
  } catch (error) {
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
