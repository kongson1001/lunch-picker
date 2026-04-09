import { NextResponse } from 'next/server';
import { getDb, roomDataToColumns, columnsToRoomData } from '../../../lib/db.js';
import { notify } from '../../../lib/sse.js';
import { getAuthUser } from '../../../lib/auth.js';

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// ── rooms 전용 CRUD ──────────────────────────────────────────────

async function getRoomRow(id) {
  const pool = await getDb();
  const { rows } = await pool.query('SELECT * FROM rooms WHERE id = $1', [id]);
  return rows[0] ? columnsToRoomData(rows[0]) : null;
}

async function setRoomRow(id, data) {
  const pool = await getDb();
  const c = roomDataToColumns(data);
  await pool.query(`
    INSERT INTO rooms
      (id, room_name, status, created_by, created_by_uid, created_at, password, location, menus, votes, participation, messages, result, room_type, schedules, schedule_votes)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
    ON CONFLICT (id) DO UPDATE SET
      room_name = EXCLUDED.room_name,
      status = EXCLUDED.status,
      created_by = EXCLUDED.created_by,
      created_by_uid = EXCLUDED.created_by_uid,
      created_at = EXCLUDED.created_at,
      password = EXCLUDED.password,
      location = EXCLUDED.location,
      menus = EXCLUDED.menus,
      votes = EXCLUDED.votes,
      participation = EXCLUDED.participation,
      messages = EXCLUDED.messages,
      result = EXCLUDED.result,
      room_type = EXCLUDED.room_type,
      schedules = EXCLUDED.schedules,
      schedule_votes = EXCLUDED.schedule_votes
  `, [id, c.room_name, c.status, c.created_by, c.created_by_uid,
      c.created_at, c.password, c.location, c.menus, c.votes,
      c.participation, c.messages, c.result, c.room_type, c.schedules, c.schedule_votes]);
}

async function deleteRoomRow(id) {
  const pool = await getDb();
  await pool.query('DELETE FROM rooms WHERE id = $1', [id]);
}

// ── 일반 테이블 CRUD ─────────────────────────────────────────────

async function getRow(table, id) {
  if (table === 'rooms') return getRoomRow(id);
  const pool = await getDb();
  const { rows } = await pool.query(`SELECT data FROM ${table} WHERE id = $1`, [id]);
  return rows[0] ? rows[0].data : null;
}

async function setRow(table, id, data) {
  if (table === 'rooms') { await setRoomRow(id, data); return; }
  const pool = await getDb();
  await pool.query(
    `INSERT INTO ${table} (id, data) VALUES ($1, $2)
     ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data`,
    [id, JSON.stringify(data)]
  );
}

async function deleteRow(table, id) {
  if (table === 'rooms') { await deleteRoomRow(id); return; }
  const pool = await getDb();
  await pool.query(`DELETE FROM ${table} WHERE id = $1`, [id]);
}

function getNestedValue(obj, path) {
  return path.reduce((cur, key) => (cur != null ? cur[key] : null), obj);
}

function setNestedValue(obj, path, value) {
  if (path.length === 0) return value;
  const result = { ...(obj || {}) };
  let cur = result;
  for (let i = 0; i < path.length - 1; i++) {
    cur[path[i]] = { ...(cur[path[i]] || {}) };
    cur = cur[path[i]];
  }
  cur[path[path.length - 1]] = value;
  return result;
}

function deleteNestedValue(obj, path) {
  if (path.length === 0) return null;
  const result = { ...(obj || {}) };
  let cur = result;
  for (let i = 0; i < path.length - 1; i++) {
    if (cur[path[i]] == null) return result;
    cur[path[i]] = { ...cur[path[i]] };
    cur = cur[path[i]];
  }
  delete cur[path[path.length - 1]];
  return result;
}

// ── uid 마스킹 (GET 응답 시 다른 사람의 uid 숨김) ────────────────

function maskRoomUids(roomData, myUid) {
  const result = { ...roomData };

  result.isMyRoom = roomData.createdByUid === myUid;
  delete result.createdByUid;

  if (roomData.votes) {
    const masked = {};
    for (const [uid, vote] of Object.entries(roomData.votes)) {
      if (uid === myUid) {
        masked[uid] = vote;
      } else {
        const safeKey = vote.nickname || `user${Object.keys(masked).length}`;
        masked[safeKey] = { menuIds: vote.menuIds, nickname: vote.nickname, isGuest: vote.isGuest || false };
      }
    }
    result.votes = masked;
  }

  if (roomData.participation) {
    const masked = {};
    for (const [uid, p] of Object.entries(roomData.participation)) {
      if (uid === myUid) {
        masked[uid] = p;
      } else {
        const safeKey = p.nickname || `user${Object.keys(masked).length}`;
        masked[safeKey] = { nickname: p.nickname, status: p.status, reason: p.reason, updatedAt: p.updatedAt, isGuest: p.isGuest || false };
      }
    }
    result.participation = masked;
  }

  if (roomData.messages) {
    const masked = {};
    for (const [msgId, msg] of Object.entries(roomData.messages)) {
      if (msg.uid === myUid) {
        masked[msgId] = msg;
      } else {
        const { uid, ...rest } = msg;
        masked[msgId] = rest;
      }
    }
    result.messages = masked;
  }

  if (roomData.scheduleVotes) {
    const masked = {};
    for (const [uid, vote] of Object.entries(roomData.scheduleVotes)) {
      if (uid === myUid) {
        masked[uid] = vote;
      } else {
        const safeKey = vote.nickname || `user${Object.keys(masked).length}`;
        masked[safeKey] = { scheduleIds: vote.scheduleIds, nickname: vote.nickname, isGuest: vote.isGuest || false };
      }
    }
    result.scheduleVotes = masked;
  }

  return result;
}

function triggerNotify(table, rowId) {
  notify(`${table}/${rowId}`);
  if (table === 'rooms') notify('rooms');
}

// ── 권한 검사 ────────────────────────────────────────────────────

function checkPermission(method, segments, authUser) {
  const [table] = segments;

  if (method === 'GET') {
    if (table === 'rooms' || table === 'users') return !!authUser;
    return true;
  }

  if (!authUser) return false;

  const { uid, isAdmin } = authUser;
  if (isAdmin) return true;

  const [, rowId, ...rest] = segments;

  if (table === 'users') return rowId === uid;

  if (table === 'rooms') {
    if (rest[0] === 'votes' && rest[1]) return rest[1] === uid;
    if (rest[0] === 'scheduleVotes' && rest[1]) return rest[1] === uid;
    if (rest[0] === 'participation' && rest[1]) return rest[1] === uid;
    if (rest[0] === 'messages' && rest[2] === 'reactions' && rest[4]) return rest[4] === uid;
    if (rest[0] === 'messages' && rest[1] && method === 'DELETE') return 'check_message_owner';
    if (!rest.length && (method === 'DELETE' || method === 'PATCH')) return 'check_room_owner';
    return true;
  }

  return true;
}

const FORBIDDEN = NextResponse.json({ error: '권한이 없습니다' }, { status: 403 });
const UNAUTHORIZED = NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 });

// ── Route Handlers ───────────────────────────────────────────────

export async function GET(request, { params }) {
  const { path: segments } = await params;
  const authUser = getAuthUser(request);
  const permission = checkPermission('GET', segments, authUser);
  if (permission === false) return authUser ? FORBIDDEN : UNAUTHORIZED;

  try {
    const [table, rowId, ...rest] = segments;
    const pool = await getDb();
    const myUid = authUser?.uid;
    const noCache = { headers: { 'Cache-Control': 'no-store' } };

    if (!rowId) {
      if (table === 'rooms') {
        const { rows } = await pool.query('SELECT * FROM rooms');
        if (!rows.length) return NextResponse.json(null, noCache);
        const result = {};
        for (const row of rows) result[row.id] = maskRoomUids(columnsToRoomData(row), myUid);
        return NextResponse.json(result, noCache);
      }
      const { rows } = await pool.query(`SELECT id, data FROM ${table}`);
      if (!rows.length) return NextResponse.json(null);
      const result = {};
      for (const row of rows) result[row.id] = row.data;
      return NextResponse.json(result);
    }

    const data = await getRow(table, rowId);
    if (!data) return NextResponse.json(null);
    if (rest.length === 0) {
      return NextResponse.json(table === 'rooms' ? maskRoomUids(data, myUid) : data);
    }
    return NextResponse.json(getNestedValue(data, rest) ?? null);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request, { params }) {
  const { path: segments } = await params;
  const authUser = getAuthUser(request);
  const permission = checkPermission('POST', segments, authUser);
  if (permission === false) return authUser ? FORBIDDEN : UNAUTHORIZED;

  try {
    const [table, rowId, ...rest] = segments;
    const body = await request.json();
    const newId = generateId();
    const data = await getRow(table, rowId) || {};
    await setRow(table, rowId, setNestedValue(data, [...rest, newId], { ...body, createdAt: Date.now() }));
    triggerNotify(table, rowId);
    return NextResponse.json({ id: newId });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request, { params }) {
  const { path: segments } = await params;
  const authUser = getAuthUser(request);
  const permission = checkPermission('PUT', segments, authUser);
  if (permission === false) return authUser ? FORBIDDEN : UNAUTHORIZED;

  try {
    const [table, rowId, ...rest] = segments;
    const body = await request.json();
    if (rest.length === 0) {
      const verified = table === 'rooms' && authUser
        ? { ...body, createdByUid: authUser.uid }
        : body;
      await setRow(table, rowId, verified);
    } else {
      const data = await getRow(table, rowId) || {};
      await setRow(table, rowId, setNestedValue(data, rest, body));
    }
    triggerNotify(table, rowId);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(request, { params }) {
  const { path: segments } = await params;
  const authUser = getAuthUser(request);
  const permission = checkPermission('PATCH', segments, authUser);
  if (permission === false) return authUser ? FORBIDDEN : UNAUTHORIZED;

  try {
    const [table, rowId, ...rest] = segments;

    if (permission === 'check_room_owner') {
      const roomData = await getRow(table, rowId);
      if (!roomData) return NextResponse.json({ error: '방을 찾을 수 없습니다' }, { status: 404 });
      if (roomData.createdByUid !== authUser.uid) return FORBIDDEN;
    }

    const body = await request.json();
    const data = await getRow(table, rowId) || {};
    let newData;
    if (rest.length === 0) {
      newData = { ...data, ...body };
    } else {
      newData = setNestedValue(data, rest, { ...(getNestedValue(data, rest) || {}), ...body });
    }
    await setRow(table, rowId, newData);
    triggerNotify(table, rowId);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  const { path: segments } = await params;
  const authUser = getAuthUser(request);
  const permission = checkPermission('DELETE', segments, authUser);
  if (permission === false) return authUser ? FORBIDDEN : UNAUTHORIZED;

  try {
    const [table, rowId, ...rest] = segments;

    if (permission === 'check_message_owner') {
      const roomData = await getRow(table, rowId);
      const message = roomData?.messages?.[rest[1]];
      if (!message) return NextResponse.json({ error: '메시지를 찾을 수 없습니다' }, { status: 404 });
      if (message.uid !== authUser.uid) return FORBIDDEN;
    }

    if (permission === 'check_room_owner') {
      const roomData = await getRow(table, rowId);
      if (!roomData) return NextResponse.json({ error: '방을 찾을 수 없습니다' }, { status: 404 });
      if (roomData.createdByUid !== authUser.uid) return FORBIDDEN;
    }

    if (rest.length === 0) {
      await deleteRow(table, rowId);
    } else {
      const data = await getRow(table, rowId);
      if (data) await setRow(table, rowId, deleteNestedValue(data, rest));
    }
    triggerNotify(table, rowId);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
