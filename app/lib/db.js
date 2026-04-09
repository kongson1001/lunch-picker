import pg from 'pg';
const { Pool } = pg;

let _pool = null;
let _initPromise = null;

function createPool() {
  if (_pool) return _pool;
  _pool = new Pool({ connectionString: process.env.DATABASE_URL });
  _initPromise = _pool.query(`
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
    ALTER TABLE rooms ADD COLUMN IF NOT EXISTS room_type TEXT DEFAULT 'lunch';
    ALTER TABLE rooms ADD COLUMN IF NOT EXISTS schedules JSONB DEFAULT '{}';
    ALTER TABLE rooms ADD COLUMN IF NOT EXISTS schedule_votes JSONB DEFAULT '{}';
  `);
  return _pool;
}

export async function getDb() {
  const pool = createPool();
  await _initPromise;
  return pool;
}

export function toKST() {
  return new Date().toLocaleString('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  });
}

export function roomDataToColumns(data) {
  return {
    room_name: data.roomName ?? '',
    status: data.status ?? 'voting',
    created_by: data.createdBy ?? '',
    created_by_uid: data.createdByUid ?? '',
    created_at: data.createdAt ?? Date.now(),
    password: data.password || null,
    location: data.location != null ? JSON.stringify(data.location) : null,
    menus: JSON.stringify(data.menus ?? {}),
    votes: JSON.stringify(data.votes ?? {}),
    participation: JSON.stringify(data.participation ?? {}),
    messages: JSON.stringify(data.messages ?? {}),
    result: data.result != null ? JSON.stringify(data.result) : null,
    room_type: data.roomType ?? 'lunch',
    schedules: JSON.stringify(data.schedules ?? {}),
    schedule_votes: JSON.stringify(data.scheduleVotes ?? {}),
  };
}

export function columnsToRoomData(row) {
  const data = {
    roomName: row.room_name,
    status: row.status,
    createdBy: row.created_by,
    createdByUid: row.created_by_uid,
    createdAt: Number(row.created_at),
    location: row.location,
    menus: row.menus ?? {},
    votes: row.votes ?? {},
    participation: row.participation ?? {},
    messages: row.messages ?? {},
    result: row.result ?? null,
    roomType: row.room_type ?? 'lunch',
    schedules: row.schedules ?? {},
    scheduleVotes: row.schedule_votes ?? {},
  };
  if (row.password) data.password = row.password;
  return data;
}
