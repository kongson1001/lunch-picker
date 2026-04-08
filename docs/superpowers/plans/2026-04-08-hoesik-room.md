# 회식 방 기능 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 홈 화면에 점심/회식 탭을 추가하고, 회식 방에 날짜·시간 후보 투표와 반경 제한 없는 음식점 검색 기능을 제공한다.

**Architecture:** 기존 `rooms` 테이블에 `room_type`, `schedules`, `schedule_votes` 컬럼을 추가한다. 기존 점심 로직은 완전 보존하고, 회식 방(`roomType === 'hoesik'`)에서만 날짜·시간 투표 섹션이 표시되도록 분기한다. 날짜·시간 투표는 기존 메뉴 투표와 동일한 JSONB + 제네릭 API 패턴을 재사용한다.

**Tech Stack:** Next.js 15 App Router, PostgreSQL (better-sqlite3 제거됨), `pg` Pool, SSE, Kakao Local API

---

## 파일 맵

| 파일 | 작업 |
|------|------|
| `app/lib/db.js` | `room_type` / `schedules` / `schedule_votes` 컬럼 추가 + 마이그레이션 + 변환 함수 수정 |
| `app/api/db/[...path]/route.js` | `setRoomRow` INSERT 확장 + `maskRoomUids` scheduleVotes 마스킹 + 권한 추가 |
| `app/api/searchRestaurants/route.js` | `noRadius` 쿼리 파라미터 지원 |
| `app/utils/naverSearch.js` | `searchRestaurants`에 `noRadius` 파라미터 추가 |
| `app/components/RestaurantSearch.js` | `noRadius` prop 수신 후 전달 |
| `app/utils/room.js` | `createRoom`에 `roomType` 파라미터 추가 |
| `app/page.js` | 점심/회식 탭 UI + 방 목록 필터링 + 회식 방 생성(위치 선택사항) |
| `app/components/AddSchedule.js` | 신규: 날짜·시간 후보 추가 폼 |
| `app/components/ScheduleVote.js` | 신규: 날짜·시간 후보 목록 + 투표 UI |
| `app/room/[roomId]/page.js` | 회식 방 분기: 날짜 투표 섹션, noRadius, 라벨, handleClose 수정 |
| `app/room/[roomId]/result/page.js` | 회식 결과: 당선 일정 표시 |
| `app/globals.css` | 탭, 일정 투표 스타일 추가 |

---

## Task 1: DB 마이그레이션 + 데이터 변환 함수

**Files:**
- Modify: `app/lib/db.js`

- [ ] **Step 1: `createPool`의 SQL에 마이그레이션 쿼리 추가**

`app/lib/db.js`의 `_initPromise = _pool.query(...)` 블록을 아래로 교체:

```js
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
```

- [ ] **Step 2: `roomDataToColumns` 함수에 새 필드 추가**

`roomDataToColumns` 함수 전체를 아래로 교체:

```js
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
```

- [ ] **Step 3: `columnsToRoomData` 함수에 새 필드 추가**

`columnsToRoomData` 함수 전체를 아래로 교체:

```js
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
```

- [ ] **Step 4: 빌드 확인**

```bash
cd /Users/jung/Documents/lunch-picker && npm run build 2>&1 | tail -20
```

오류 없이 빌드 완료 확인.

- [ ] **Step 5: 커밋**

```bash
git add app/lib/db.js
git commit -m "feat: add room_type, schedules, schedule_votes columns to DB"
```

---

## Task 2: API — setRoomRow 확장 + maskRoomUids + 권한

**Files:**
- Modify: `app/api/db/[...path]/route.js`

- [ ] **Step 1: `setRoomRow` INSERT 구문 확장**

`setRoomRow` 함수 전체를 아래로 교체:

```js
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
```

- [ ] **Step 2: `maskRoomUids`에 scheduleVotes 마스킹 추가**

`maskRoomUids` 함수 내 `result.messages` 블록 다음에 추가:

```js
  if (roomData.scheduleVotes) {
    const masked = {};
    for (const [uid, vote] of Object.entries(roomData.scheduleVotes)) {
      if (uid === myUid) {
        masked[uid] = vote;
      } else {
        const safeKey = vote.nickname || `user${Object.keys(masked).length}`;
        masked[safeKey] = { scheduleIds: vote.scheduleIds, nickname: vote.nickname };
      }
    }
    result.scheduleVotes = masked;
  }
```

- [ ] **Step 3: `checkPermission`에 scheduleVotes 권한 추가**

`checkPermission` 함수 내 `if (rest[0] === 'votes' && rest[1]) return rest[1] === uid;` 라인 다음에 추가:

```js
    if (rest[0] === 'scheduleVotes' && rest[1]) return rest[1] === uid;
```

- [ ] **Step 4: 빌드 확인**

```bash
npm run build 2>&1 | tail -20
```

- [ ] **Step 5: 커밋**

```bash
git add app/api/db/\[...path\]/route.js
git commit -m "feat: extend setRoomRow, maskRoomUids, permissions for scheduleVotes"
```

---

## Task 3: 음식점 검색 반경 제한 해제

**Files:**
- Modify: `app/api/searchRestaurants/route.js`
- Modify: `app/utils/naverSearch.js`
- Modify: `app/components/RestaurantSearch.js`

- [ ] **Step 1: API에 `noRadius` 파라미터 추가**

`app/api/searchRestaurants/route.js`에서 `params` 생성 블록을 아래로 교체:

```js
  const noRadius = searchParams.get('noRadius') === '1';
  const params = new URLSearchParams({
    query,
    category_group_code: 'FD6',
    size: '15',
    sort: 'accuracy',
  });
  if (x && y) {
    params.append('x', x);
    params.append('y', y);
    if (!noRadius) params.append('radius', '2000');
  }
```

- [ ] **Step 2: `searchRestaurants` 유틸에 `noRadius` 파라미터 추가**

`app/utils/naverSearch.js`의 `searchRestaurants` 함수 시그니처와 URL 빌드 부분 수정:

```js
export async function searchRestaurants(query, lat, lng, noRadius = false) {
  const params = new URLSearchParams({ query });
  if (lat && lng) {
    params.append('x', lng);
    params.append('y', lat);
  }
  if (noRadius) params.append('noRadius', '1');

  const url = `/api/searchRestaurants?${params}`;
  // ... 이하 기존 코드 유지
```

- [ ] **Step 3: `RestaurantSearch` 컴포넌트에 `noRadius` prop 추가**

`app/components/RestaurantSearch.js` 첫 줄 props와 `handleSearch` 내 호출 수정:

```js
export default function RestaurantSearch({ lat, lng, areaName, onAdd, onResults, addedNames, noRadius = false }) {
```

그리고 `handleSearch` 내:
```js
      const data = await searchRestaurants(trimmed, lat, lng, noRadius);
```

- [ ] **Step 4: 빌드 확인**

```bash
npm run build 2>&1 | tail -20
```

- [ ] **Step 5: 커밋**

```bash
git add app/api/searchRestaurants/route.js app/utils/naverSearch.js app/components/RestaurantSearch.js
git commit -m "feat: add noRadius option to restaurant search"
```

---

## Task 4: 방 생성 roomType 지원

**Files:**
- Modify: `app/utils/room.js`

- [ ] **Step 1: `createRoom`에 `roomType` 파라미터 추가**

`app/utils/room.js`의 `createRoom` 함수 전체를 아래로 교체:

```js
export async function createRoom(nickname, location, roomName, uid, password = '', roomType = 'lunch') {
  const roomId = generateRoomId();
  const roomData = {
    createdAt: Date.now(),
    createdBy: nickname,
    createdByUid: uid || '',
    roomName: roomName || '',
    roomType,
    status: 'voting',
    location: location,
    menus: {},
    votes: {},
    schedules: {},
    scheduleVotes: {},
    result: null,
  };
  if (password) {
    roomData.password = password;
  }

  const res = await fetch(`/api/db/rooms/${roomId}`, {
    method: 'PUT',
    body: JSON.stringify(roomData)
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || '방 생성에 실패했습니다');
  }

  return roomId;
}
```

- [ ] **Step 2: 빌드 확인**

```bash
npm run build 2>&1 | tail -20
```

- [ ] **Step 3: 커밋**

```bash
git add app/utils/room.js
git commit -m "feat: add roomType parameter to createRoom"
```

---

## Task 5: 홈 화면 점심/회식 탭

**Files:**
- Modify: `app/page.js`
- Modify: `app/globals.css`

- [ ] **Step 1: `activeTab` 상태 추가 + `handleCreate` 수정**

`app/page.js`의 상태 선언부에 추가 (기존 `const [loading, setLoading]` 다음):
```js
  const [activeTab, setActiveTab] = useState('lunch');
```

기존 `handleCreate` 함수 전체를 아래로 교체:

```js
  const handleCreate = async () => {
    if (usePassword && !password.trim()) {
      setError('비밀번호를 입력해주세요');
      return;
    }
    setLoading(true);
    setError('');
    try {
      let location = null;
      if (activeTab === 'lunch') {
        const position = await new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 10000,
          });
        });
        location = { lat: position.coords.latitude, lng: position.coords.longitude };
      } else {
        try {
          const position = await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              enableHighAccuracy: true,
              timeout: 5000,
            });
          });
          location = { lat: position.coords.latitude, lng: position.coords.longitude };
        } catch {}
      }
      const roomId = await createRoom(user.nickname, location, roomName.trim(), user.uid, usePassword ? password.trim() : '', activeTab);
      router.push(`/room/${roomId}`);
    } catch (err) {
      if (err?.code === 1) {
        setError('위치 권한을 허용해주세요.');
      } else {
        setError(err?.message || '방 생성에 실패했습니다. 다시 로그인해주세요.');
      }
    } finally {
      setLoading(false);
    }
  };
```

- [ ] **Step 2: JSX에 탭 UI + 방 목록 필터링 추가**

로그인 후 `<div className="input-group">` 바로 위에 탭 추가:

```jsx
            <div className="room-type-tabs">
              <button
                className={`room-type-tab ${activeTab === 'lunch' ? 'active' : ''}`}
                onClick={() => setActiveTab('lunch')}
              >
                🍱 점심
              </button>
              <button
                className={`room-type-tab ${activeTab === 'hoesik' ? 'active' : ''}`}
                onClick={() => setActiveTab('hoesik')}
              >
                🍻 회식
              </button>
            </div>
```

방 목록 렌더링 부분에서 `rooms.map` 전에 필터 추가:

```jsx
            {rooms.length > 0 && (
              <div className="room-list">
                <h2>{activeTab === 'lunch' ? '점심 방 목록' : '회식 방 목록'}</h2>
                {rooms
                  .filter(room => (room.roomType ?? 'lunch') === activeTab)
                  .map((room) => {
```

닫는 괄호도 맞춰서 수정: `rooms.map(...)` → `rooms.filter(...).map(...)`

방 카드 `room-card-code` span 안에 회식 배지 추가:

```jsx
                          {room.roomType === 'hoesik' && <span className="hoesik-badge">🍻</span>}
```

- [ ] **Step 3: CSS에 탭 스타일 추가**

`app/globals.css` 파일 맨 끝에 추가:

```css
/* ── 방 타입 탭 ─────────────────────────────── */
.room-type-tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
}

.room-type-tab {
  flex: 1;
  padding: 10px 0;
  border: 2px solid #e0e0e0;
  border-radius: 10px;
  background: #fff;
  font-size: 15px;
  font-weight: 600;
  color: #888;
  cursor: pointer;
  transition: all 0.15s;
}

.room-type-tab.active {
  border-color: #ff6b35;
  color: #ff6b35;
  background: #fff5f2;
}

.hoesik-badge {
  margin-right: 4px;
}
```

- [ ] **Step 4: 빌드 확인**

```bash
npm run build 2>&1 | tail -20
```

- [ ] **Step 5: 커밋**

```bash
git add app/page.js app/globals.css
git commit -m "feat: add lunch/hoesik tabs to home page"
```

---

## Task 6: AddSchedule 컴포넌트

**Files:**
- Create: `app/components/AddSchedule.js`
- Modify: `app/globals.css`

- [ ] **Step 1: `AddSchedule.js` 생성**

```js
'use client';
import { useState } from 'react';

export default function AddSchedule({ onAdd }) {
  const [date, setDate] = useState('');
  const [hasTime, setHasTime] = useState(false);
  const [hour, setHour] = useState(18);
  const [minute, setMinute] = useState(0);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!date) return;
    const schedule = { date, hasTime };
    if (hasTime) {
      schedule.hour = Number(hour);
      schedule.minute = Number(minute);
    }
    onAdd(schedule);
    setDate('');
    setHasTime(false);
    setHour(18);
    setMinute(0);
  };

  const formatPreview = () => {
    if (!date) return '';
    const d = new Date(date + 'T00:00:00');
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    const dateStr = `${d.getMonth() + 1}월 ${d.getDate()}일 (${days[d.getDay()]})`;
    if (!hasTime) return dateStr;
    const h = String(hour).padStart(2, '0');
    const m = String(minute).padStart(2, '0');
    return `${dateStr} ${h}:${m}`;
  };

  const today = new Date().toISOString().split('T')[0];

  return (
    <form className="add-schedule" onSubmit={handleSubmit}>
      <div className="add-schedule-row">
        <input
          type="date"
          value={date}
          min={today}
          onChange={(e) => setDate(e.target.value)}
        />
      </div>
      <div className="add-schedule-row add-schedule-radio">
        <label>
          <input
            type="radio"
            name="hasTime"
            checked={!hasTime}
            onChange={() => setHasTime(false)}
          />
          날짜만
        </label>
        <label>
          <input
            type="radio"
            name="hasTime"
            checked={hasTime}
            onChange={() => setHasTime(true)}
          />
          시간 포함
        </label>
      </div>
      {hasTime && (
        <div className="add-schedule-row add-schedule-time">
          <select value={hour} onChange={(e) => setHour(e.target.value)}>
            {Array.from({ length: 24 }, (_, i) => (
              <option key={i} value={i}>{String(i).padStart(2, '0')}시</option>
            ))}
          </select>
          <select value={minute} onChange={(e) => setMinute(e.target.value)}>
            {[0, 10, 20, 30, 40, 50].map(m => (
              <option key={m} value={m}>{String(m).padStart(2, '0')}분</option>
            ))}
          </select>
        </div>
      )}
      {date && <p className="schedule-preview">{formatPreview()}</p>}
      <button type="submit" className="schedule-add-btn" disabled={!date}>
        + 일정 추가
      </button>
    </form>
  );
}
```

- [ ] **Step 2: CSS 추가**

`app/globals.css` 맨 끝에 추가:

```css
/* ── AddSchedule ────────────────────────────── */
.add-schedule {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 12px;
  padding: 14px;
  background: #f9f9f9;
  border-radius: 10px;
}

.add-schedule-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.add-schedule input[type="date"] {
  flex: 1;
  padding: 8px 10px;
  border: 1px solid #ddd;
  border-radius: 8px;
  font-size: 14px;
}

.add-schedule-radio label {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 14px;
  cursor: pointer;
}

.add-schedule-time select {
  padding: 6px 10px;
  border: 1px solid #ddd;
  border-radius: 8px;
  font-size: 14px;
}

.schedule-preview {
  font-size: 14px;
  color: #ff6b35;
  font-weight: 600;
  margin: 0;
}

.schedule-add-btn {
  padding: 10px;
  background: #ff6b35;
  color: #fff;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}

.schedule-add-btn:disabled {
  background: #ccc;
  cursor: not-allowed;
}
```

- [ ] **Step 3: 빌드 확인**

```bash
npm run build 2>&1 | tail -20
```

- [ ] **Step 4: 커밋**

```bash
git add app/components/AddSchedule.js app/globals.css
git commit -m "feat: add AddSchedule component"
```

---

## Task 7: ScheduleVote 컴포넌트

**Files:**
- Create: `app/components/ScheduleVote.js`
- Modify: `app/globals.css`

- [ ] **Step 1: `ScheduleVote.js` 생성**

```js
'use client';

export function formatSchedule(schedule) {
  if (!schedule?.date) return '날짜 없음';
  const d = new Date(schedule.date + 'T00:00:00');
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  const dateStr = `${d.getMonth() + 1}월 ${d.getDate()}일 (${days[d.getDay()]})`;
  if (!schedule.hasTime) return dateStr;
  const h = String(schedule.hour).padStart(2, '0');
  const m = String(schedule.minute).padStart(2, '0');
  return `${dateStr} ${h}:${m}`;
}

export default function ScheduleVote({ schedules, scheduleVotes, myScheduleVotes, onVote, onDelete, status }) {
  const getVoteCount = (scheduleId) => {
    if (!scheduleVotes) return 0;
    return Object.values(scheduleVotes).filter(
      v => v.scheduleIds && v.scheduleIds.includes(scheduleId)
    ).length;
  };

  const getVoters = (scheduleId) => {
    if (!scheduleVotes) return [];
    return Object.values(scheduleVotes)
      .filter(v => v.scheduleIds && v.scheduleIds.includes(scheduleId))
      .map(v => v.nickname);
  };

  const sorted = Object.entries(schedules || {})
    .map(([id, s]) => ({ id, s, voteCount: getVoteCount(id) }))
    .sort((a, b) => b.voteCount - a.voteCount);

  const topCount = sorted.length > 0 ? sorted[0].voteCount : 0;

  if (sorted.length === 0) {
    return <p className="empty-schedules">아직 일정 후보가 없습니다. 추가해보세요!</p>;
  }

  return (
    <div className="schedule-list">
      {sorted.map(({ id, s, voteCount }) => {
        const voters = getVoters(id);
        const isVoted = myScheduleVotes.includes(id);
        const isFirst = voteCount > 0 && voteCount === topCount;
        return (
          <div key={id} className={`schedule-item ${isVoted ? 'voted' : ''} ${isFirst ? 'first-place' : ''}`}>
            <div className="schedule-info">
              <h3>
                {isFirst && <span className="crown">👑</span>}
                {formatSchedule(s)}
              </h3>
              <span className="schedule-added-by">제안: {s.addedBy}</span>
              {voters.length > 0 && <p className="voter-list">{voters.join(', ')}</p>}
            </div>
            <div className="schedule-vote-actions">
              <span className="vote-count">{voteCount}표</span>
              {status === 'voting' && (
                <>
                  <button
                    className={`vote-btn ${isVoted ? 'voted' : ''}`}
                    onClick={() => onVote(id)}
                  >
                    {isVoted ? '취소' : '투표'}
                  </button>
                  <button className="delete-btn" onClick={() => onDelete(id)}>
                    삭제
                  </button>
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: CSS 추가**

`app/globals.css` 맨 끝에 추가:

```css
/* ── ScheduleVote ───────────────────────────── */
.empty-schedules {
  color: #aaa;
  font-size: 14px;
  text-align: center;
  padding: 16px 0;
}

.schedule-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.schedule-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 14px;
  border: 1px solid #e0e0e0;
  border-radius: 10px;
  background: #fff;
  transition: border-color 0.15s;
}

.schedule-item.voted {
  border-color: #ff6b35;
  background: #fff5f2;
}

.schedule-item.first-place {
  border-color: #ffd700;
}

.schedule-info h3 {
  margin: 0 0 4px;
  font-size: 15px;
}

.schedule-added-by {
  font-size: 12px;
  color: #888;
}

.schedule-vote-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}
```

- [ ] **Step 3: 빌드 확인**

```bash
npm run build 2>&1 | tail -20
```

- [ ] **Step 4: 커밋**

```bash
git add app/components/ScheduleVote.js app/globals.css
git commit -m "feat: add ScheduleVote component"
```

---

## Task 8: 방 페이지 회식 통합

**Files:**
- Modify: `app/room/[roomId]/page.js`

- [ ] **Step 1: import 추가**

파일 상단 import 목록에 추가:

```js
import ScheduleVote from '../../components/ScheduleVote';
import AddSchedule from '../../components/AddSchedule';
```

- [ ] **Step 2: `myScheduleVotes` 상태 추가**

기존 `const [myVotes, setMyVotes] = useState([]);` 다음에:

```js
  const [myScheduleVotes, setMyScheduleVotes] = useState([]);
```

- [ ] **Step 3: `myScheduleVotes` 동기화 useEffect 추가**

기존 `myVotes` useEffect 다음에 추가:

```js
  useEffect(() => {
    if (room?.scheduleVotes?.[uid]) {
      setMyScheduleVotes(room.scheduleVotes[uid].scheduleIds || []);
    }
  }, [room, uid]);
```

- [ ] **Step 4: 일정 관련 핸들러 추가**

기존 `handleTitleSave` 함수 다음에 추가:

```js
  const handleAddSchedule = async (schedule) => {
    await fetch(`/api/db/rooms/${roomId}/schedules`, {
      method: 'POST',
      body: JSON.stringify({ ...schedule, addedBy: nickname }),
    });
    fetchRoomData();
  };

  const handleScheduleVote = async (scheduleId) => {
    const voteSet = new Set(myScheduleVotes);
    if (voteSet.has(scheduleId)) voteSet.delete(scheduleId);
    else voteSet.add(scheduleId);
    const updatedScheduleVotes = Array.from(voteSet);
    await fetch(`/api/db/rooms/${roomId}/scheduleVotes/${uid}`, {
      method: 'PUT',
      body: JSON.stringify({ nickname, scheduleIds: updatedScheduleVotes }),
    });
    setMyScheduleVotes(updatedScheduleVotes);
    fetchRoomData();
  };

  const handleDeleteSchedule = async (scheduleId) => {
    await fetch(`/api/db/rooms/${roomId}/schedules/${scheduleId}`, { method: 'DELETE' });
    fetchRoomData();
  };
```

- [ ] **Step 5: `handleClose` 함수에 회식 일정 결과 추가**

기존 `handleClose` 함수 전체를 아래로 교체:

```js
  const handleClose = async () => {
    const menus = room.menus || {};
    const votes = room.votes || {};
    const counts = {};
    Object.keys(menus).forEach(id => counts[id] = 0);
    Object.values(votes).forEach(v => (v.menuIds || []).forEach(id => { if (counts[id] !== undefined) counts[id]++; }));

    const maxCount = Math.max(0, ...Object.values(counts));
    const topMenus = Object.keys(counts).filter(id => counts[id] === maxCount && maxCount > 0);
    const winnerId = topMenus.length > 0 ? topMenus[Math.floor(Math.random() * topMenus.length)] : null;

    const result = {
      winnerId,
      winnerName: winnerId ? menus[winnerId]?.name : null,
      topMenus,
      counts,
      isTie: topMenus.length > 1,
    };

    if (room.roomType === 'hoesik') {
      const schedules = room.schedules || {};
      const scheduleVotes = room.scheduleVotes || {};
      const scheduleCounts = {};
      Object.keys(schedules).forEach(id => scheduleCounts[id] = 0);
      Object.values(scheduleVotes).forEach(v => (v.scheduleIds || []).forEach(id => {
        if (scheduleCounts[id] !== undefined) scheduleCounts[id]++;
      }));
      const maxSCount = Math.max(0, ...Object.values(scheduleCounts));
      const topScheduleIds = Object.keys(scheduleCounts).filter(id => scheduleCounts[id] === maxSCount && maxSCount > 0);
      if (topScheduleIds.length > 0) {
        const winnerScheduleId = topScheduleIds[Math.floor(Math.random() * topScheduleIds.length)];
        result.winnerScheduleId = winnerScheduleId;
        result.winnerSchedule = schedules[winnerScheduleId];
        result.scheduleCounts = scheduleCounts;
      }
    }

    await fetch(`/api/db/rooms/${roomId}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'closed', result }),
    });
    fetchRoomData();
  };
```

- [ ] **Step 6: JSX에 날짜·시간 투표 섹션 추가 + 라벨 변경**

`<div className="room-body">` 안에서 `<section className="room-section">` (투표 섹션) 바로 위에 회식 일정 투표 섹션 추가:

```jsx
          {room.roomType === 'hoesik' && (
            <section className="room-section">
              <h2 className="section-title">날짜·시간 투표</h2>
              <ScheduleVote
                schedules={room.schedules}
                scheduleVotes={room.scheduleVotes}
                myScheduleVotes={myScheduleVotes}
                onVote={handleScheduleVote}
                onDelete={handleDeleteSchedule}
                status={room.status}
              />
              {room.status === 'voting' && (
                <AddSchedule onAdd={handleAddSchedule} />
              )}
            </section>
          )}
```

참여 섹션의 `<h2>` 변경:

```jsx
            <h2 className="section-title">{room.roomType === 'hoesik' ? '회식 참여 여부' : '점심 참여 여부'}</h2>
```

`RestaurantSearch` 컴포넌트에 `noRadius` prop 추가:

```jsx
              <RestaurantSearch
                lat={currentLocation?.lat || room.location?.lat}
                lng={currentLocation?.lng || room.location?.lng}
                areaName={areaName}
                onAdd={handleAddRestaurant}
                onResults={setSearchMarkers}
                addedNames={new Set(Object.values(room?.menus || {}).map(m => m.name))}
                noRadius={room.roomType === 'hoesik'}
              />
```

- [ ] **Step 7: 빌드 확인**

```bash
npm run build 2>&1 | tail -20
```

- [ ] **Step 8: 커밋**

```bash
git add app/room/\[roomId\]/page.js
git commit -m "feat: integrate hoesik schedule voting into room page"
```

---

## Task 9: 결과 페이지 회식 지원

**Files:**
- Modify: `app/room/[roomId]/result/page.js`

- [ ] **Step 1: `formatSchedule` 함수 추가 + 결과 표시 수정**

`app/room/[roomId]/result/page.js` 파일 맨 위 `'use client';` 다음에 `formatSchedule` 추가:

```js
function formatSchedule(schedule) {
  if (!schedule?.date) return '';
  const d = new Date(schedule.date + 'T00:00:00');
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  const dateStr = `${d.getMonth() + 1}월 ${d.getDate()}일 (${days[d.getDay()]})`;
  if (!schedule.hasTime) return dateStr;
  const h = String(schedule.hour).padStart(2, '0');
  const m = String(schedule.minute).padStart(2, '0');
  return `${dateStr} ${h}:${m}`;
}
```

`winner-section`의 `<h2>` 변경:

```jsx
            <h2>{room.roomType === 'hoesik' ? '오늘의 회식' : '오늘의 점심'}</h2>
```

`winner-section` 닫는 `</div>` 바로 위에 일정 결과 추가:

```jsx
            {room.roomType === 'hoesik' && result.winnerSchedule && (
              <div className="winner-schedule">
                <span className="winner-schedule-label">확정 일정</span>
                <div className="winner-schedule-date">{formatSchedule(result.winnerSchedule)}</div>
              </div>
            )}
```

- [ ] **Step 2: CSS 추가**

`app/globals.css` 맨 끝에 추가:

```css
/* ── 결과 페이지 회식 일정 ──────────────────── */
.winner-schedule {
  margin-top: 16px;
  padding: 14px 18px;
  background: #fff5f2;
  border: 2px solid #ff6b35;
  border-radius: 12px;
  text-align: center;
}

.winner-schedule-label {
  display: block;
  font-size: 13px;
  color: #ff6b35;
  font-weight: 600;
  margin-bottom: 6px;
}

.winner-schedule-date {
  font-size: 18px;
  font-weight: 700;
  color: #333;
}
```

- [ ] **Step 3: 빌드 확인**

```bash
npm run build 2>&1 | tail -20
```

- [ ] **Step 4: 커밋**

```bash
git add app/room/\[roomId\]/result/page.js app/globals.css
git commit -m "feat: show winning schedule in hoesik result page"
```

---

## 완료 확인

모든 Task 완료 후:

```bash
# 도커 배포
docker compose down && docker compose up --build -d

# 로그 확인 (DB 마이그레이션 오류 없는지)
docker compose logs app | head -30
```

동작 확인 체크리스트:
- [ ] 홈 화면에 점심/회식 탭이 표시됨
- [ ] 회식 탭에서 방 만들기 → 위치 권한 없어도 생성 가능
- [ ] 회식 방 입장 시 날짜·시간 투표 섹션이 상단에 표시됨
- [ ] 날짜 선택 → "날짜만"/"시간 포함" 라디오 → 시간 포함 시 시·분 드롭다운 표시
- [ ] 일정 후보 추가 → 투표 → 취소 정상 동작
- [ ] 회식 방 음식점 검색 시 거리 제한 없이 결과 표시
- [ ] 투표 마감 시 결과 페이지에 당선 메뉴 + 확정 일정 표시
- [ ] 점심 방은 기존과 동일하게 동작
