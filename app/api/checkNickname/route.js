import { NextResponse } from 'next/server';
import { getDb } from '../../lib/db.js';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const nickname = searchParams.get('nickname');
  const excludeUid = searchParams.get('excludeUid') || '';

  if (!nickname?.trim()) {
    return NextResponse.json({ available: false });
  }

  const pool = await getDb();
  const { rows } = await pool.query(
    `SELECT id FROM users WHERE data->>'nickname' = $1 AND id != $2`,
    [nickname.trim(), excludeUid]
  );

  return NextResponse.json({ available: rows.length === 0 });
}
