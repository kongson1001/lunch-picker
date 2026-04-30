// 실행: node scripts/migrate-sqlite-to-pg.js
// 실행 전 PostgreSQL 컨테이너가 떠 있어야 함
// 실행 전 .env.local에 MIGRATE_PG_URL=postgresql://lunch:lunch_password@localhost:5432/lunchpicker 추가

import Database from 'better-sqlite3';
import pg from 'pg';
import { join } from 'path';
import { readFileSync } from 'fs';

const { Pool } = pg;

// .env.local에서 MIGRATE_PG_URL 읽기
const envContent = readFileSync('.env.local', 'utf8');
const pgUrlMatch = envContent.match(/^MIGRATE_PG_URL=(.+)$/m);
if (!pgUrlMatch) {
  console.error('.env.local에 MIGRATE_PG_URL이 없습니다');
  process.exit(1);
}

const sqlite = new Database(join(process.cwd(), 'data', 'lunch.db'));
const pool = new Pool({ connectionString: pgUrlMatch[1].trim() });

console.log('[migrate] 테이블 생성...');
await pool.query(`
  CREATE TABLE IF NOT EXISTS rooms (
    id TEXT PRIMARY KEY,
    room_name TEXT DEFAULT '',
    status TEXT DEFAULT 'voting',
    created_by TEXT DEFAULT '',
    created_by_uid TEXT DEFAULT '',
    created_at BIGINT,
    password TEXT,
    location JSONB,
    menus JSONB DEFAULT '{}',
    votes JSONB DEFAULT '{}',
    participation JSONB DEFAULT '{}',
    messages JSONB DEFAULT '{}',
    result JSONB
  );
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    data JSONB NOT NULL
  );
  CREATE TABLE IF NOT EXISTS login_history (
    id SERIAL PRIMARY KEY,
    uid TEXT NOT NULL,
    nickname TEXT,
    type TEXT NOT NULL,
    logged_in_at BIGINT NOT NULL,
    login_time TEXT NOT NULL DEFAULT ''
  );
`);
console.log('[migrate] 테이블 생성 완료');

console.log('[migrate] rooms 테이블 마이그레이션...');
const rooms = sqlite.prepare('SELECT * FROM rooms').all();
for (const room of rooms) {
  await pool.query(
    `INSERT INTO rooms
      (id, room_name, status, created_by, created_by_uid, created_at, password, location, menus, votes, participation, messages, result)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
     ON CONFLICT (id) DO NOTHING`,
    [
      room.id, room.room_name, room.status, room.created_by, room.created_by_uid,
      room.created_at, room.password,
      room.location ?? null,
      room.menus ?? '{}',
      room.votes ?? '{}',
      room.participation ?? '{}',
      room.messages ?? '{}',
      room.result ?? null,
    ]
  );
}
console.log(`[migrate] rooms ${rooms.length}개 완료`);

console.log('[migrate] users 테이블 마이그레이션...');
const users = sqlite.prepare('SELECT id, data FROM users').all();
for (const user of users) {
  await pool.query(
    `INSERT INTO users (id, data) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING`,
    [user.id, user.data]
  );
}
console.log(`[migrate] users ${users.length}개 완료`);

console.log('[migrate] login_history 테이블 마이그레이션...');
const history = sqlite.prepare('SELECT * FROM login_history').all();
for (const h of history) {
  await pool.query(
    `INSERT INTO login_history (uid, nickname, type, logged_in_at, login_time)
     VALUES ($1,$2,$3,$4,$5)`,
    [h.uid, h.nickname, h.type, h.logged_in_at, h.login_time ?? '']
  );
}
console.log(`[migrate] login_history ${history.length}개 완료`);

sqlite.close();
await pool.end();
console.log('[migrate] 완료!');
