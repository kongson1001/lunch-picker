import { NextResponse } from 'next/server';
import { clearSessionCookie, getAuthUser } from '../../lib/auth.js';
import { getDb } from '../../lib/db.js';

async function cleanupGuestData(uid) {
  const pool = await getDb();

  // votes, participation, schedule_votes — JSONB key 제거
  await pool.query(`UPDATE rooms SET votes = votes - $1 WHERE votes ? $1`, [uid]);
  await pool.query(`UPDATE rooms SET participation = participation - $1 WHERE participation ? $1`, [uid]);
  await pool.query(`UPDATE rooms SET schedule_votes = schedule_votes - $1 WHERE schedule_votes ? $1`, [uid]);

  // messages — uid가 일치하는 메시지 항목 제거
  await pool.query(`
    UPDATE rooms
    SET messages = (
      SELECT jsonb_object_agg(key, value)
      FROM jsonb_each(messages)
      WHERE value->>'uid' != $1
    )
    WHERE messages IS NOT NULL
      AND messages != '{}'::jsonb
      AND EXISTS (
        SELECT 1 FROM jsonb_each(messages) WHERE value->>'uid' = $1
      )
  `, [uid]);
}

export async function POST(request) {
  const authUser = getAuthUser(request);

  if (authUser?.isGuest) {
    try {
      await cleanupGuestData(authUser.uid);
    } catch (err) {
      console.error('[logout] guest cleanup 실패:', err);
      // 정리 실패해도 로그아웃은 진행
    }
  }

  const response = NextResponse.json({ success: true });
  response.headers.set('Set-Cookie', clearSessionCookie());
  return response;
}
