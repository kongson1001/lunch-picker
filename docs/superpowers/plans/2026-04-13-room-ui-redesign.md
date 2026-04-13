# Room UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 방 페이지를 지도 중심 레이아웃으로 전환 — 데스크탑은 왼쪽 패널+오른쪽 지도, 모바일은 전체 지도+하단 드래그 시트, 지도 위 아이콘으로 패널 전환.

**Architecture:** `RoomPanel` 컴포넌트가 아이콘 네비게이션과 패널 콘텐츠 렌더링을 담당. `BottomSheet` 컴포넌트가 모바일 터치 드래그 시트를 구현. `page.js`는 레이아웃 재구성만 하고 기존 핸들러·상태는 그대로 유지.

**Tech Stack:** Next.js 15 App Router, React hooks (touch events 직접 구현, 외부 라이브러리 없음), CSS (globals.css에 새 클래스 추가)

---

## 파일 구조

| 파일 | 역할 |
|------|------|
| `app/components/BottomSheet.js` | 모바일 드래그 시트 (신규) |
| `app/components/RoomPanel.js` | 아이콘 네비 + 패널 콘텐츠 컨테이너 (신규) |
| `app/room/[roomId]/page.js` | 레이아웃 재구성 (수정, 핸들러·상태 유지) |
| `app/globals.css` | 새 레이아웃 CSS 추가 (기존 유지) |

---

## Task 1: CSS — 지도 중심 레이아웃 클래스 추가

**Files:**
- Modify: `app/globals.css`

- [ ] **Step 1: `globals.css` 하단에 새 CSS 블록 추가**

아래 코드를 `globals.css` 파일 맨 끝에 추가한다.

```css
/* ===== Room Map-Centric Layout ===== */
.room-map-layout {
  position: fixed;
  inset: 0;
  display: flex;
  flex-direction: column;
  background: #f5f5f5;
  overflow: hidden;
}

/* 슬림 헤더 */
.room-map-header {
  height: 44px;
  min-height: 44px;
  background: #e85d26;
  color: white;
  display: flex;
  align-items: center;
  padding: 0 12px;
  gap: 8px;
  z-index: 10;
  flex-shrink: 0;
}

.room-map-header h1 {
  font-size: 15px;
  font-weight: 700;
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  color: white;
}

.room-map-header .header-right {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.room-map-header .header-code {
  font-size: 12px;
  opacity: 0.85;
}

.room-map-header .header-btn {
  background: rgba(255,255,255,0.2);
  border: none;
  color: white;
  border-radius: 6px;
  padding: 4px 8px;
  font-size: 12px;
  cursor: pointer;
  font-family: inherit;
  white-space: nowrap;
}

.room-map-header .header-btn:hover {
  background: rgba(255,255,255,0.3);
}

.room-map-header .title-edit-btn {
  background: none;
  border: none;
  color: white;
  font-size: 14px;
  cursor: pointer;
  padding: 2px 4px;
  opacity: 0.8;
  flex-shrink: 0;
}

.room-map-header .room-title-input {
  background: rgba(255,255,255,0.2);
  border: 1px solid rgba(255,255,255,0.5);
  color: white;
  border-radius: 6px;
  padding: 3px 8px;
  font-size: 14px;
  font-family: inherit;
  width: 160px;
}

/* 본문 (헤더 아래 전체) */
.room-map-body {
  flex: 1;
  display: flex;
  overflow: hidden;
  position: relative;
}

/* 데스크탑: 왼쪽 패널 */
.room-sidebar {
  width: 340px;
  min-width: 340px;
  background: white;
  border-right: 1px solid #e0e0e0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  z-index: 5;
}

.room-sidebar-header {
  background: #e85d26;
  color: white;
  padding: 10px 14px;
  font-weight: 600;
  font-size: 14px;
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.room-sidebar-content {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
}

/* 지도 영역 */
.room-map-area {
  flex: 1;
  position: relative;
  overflow: hidden;
}

.room-map-area .map-container {
  position: absolute;
  inset: 0;
  margin: 0;
  border-radius: 0;
  border: none;
}

.room-map-area .map-container > div {
  width: 100% !important;
  height: 100% !important;
}

/* 지도 위 아이콘 바 */
.room-icon-bar {
  position: absolute;
  right: 12px;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  flex-direction: column;
  gap: 8px;
  z-index: 10;
}

.room-icon-btn {
  width: 42px;
  height: 42px;
  border-radius: 50%;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.2);
  transition: transform 0.1s, box-shadow 0.1s;
  background: white;
  color: #333;
  font-family: inherit;
}

.room-icon-btn:hover {
  transform: scale(1.08);
  box-shadow: 0 3px 10px rgba(0,0,0,0.25);
}

.room-icon-btn.active {
  background: #e85d26;
  color: white;
}

.room-icon-btn.disabled {
  opacity: 0.4;
  cursor: not-allowed;
  pointer-events: none;
}

/* 위치 갱신 버튼 (지도 위) */
.room-location-btn {
  position: absolute;
  right: 12px;
  bottom: 16px;
  background: white;
  border: none;
  border-radius: 8px;
  padding: 7px 12px;
  font-size: 12px;
  font-family: inherit;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(0,0,0,0.2);
  z-index: 10;
  display: flex;
  align-items: center;
  gap: 4px;
}

.room-location-btn:hover {
  background: #fff5f0;
}

.room-location-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* 모바일: 하단 드래그 시트 */
@media (max-width: 767px) {
  .room-sidebar {
    display: none;
  }

  .room-map-area {
    position: absolute;
    inset: 0;
  }
}

/* BottomSheet 컴포넌트 */
.bottom-sheet-backdrop {
  display: none;
}

.bottom-sheet {
  display: none;
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background: white;
  border-radius: 16px 16px 0 0;
  box-shadow: 0 -4px 20px rgba(0,0,0,0.15);
  z-index: 20;
  overflow: hidden;
  flex-direction: column;
  touch-action: none;
}

.bottom-sheet-handle-area {
  padding: 10px 0 4px;
  cursor: grab;
  flex-shrink: 0;
  user-select: none;
}

.bottom-sheet-handle-area:active {
  cursor: grabbing;
}

.bottom-sheet-handle {
  width: 36px;
  height: 4px;
  background: #ddd;
  border-radius: 4px;
  margin: 0 auto;
}

.bottom-sheet-header {
  background: #e85d26;
  color: white;
  padding: 10px 14px;
  font-weight: 600;
  font-size: 14px;
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.bottom-sheet-content {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
  -webkit-overflow-scrolling: touch;
}

@media (max-width: 767px) {
  .bottom-sheet {
    display: flex;
  }
}
```

- [ ] **Step 2: 빌드 오류 없는지 확인**

```bash
npm run build 2>&1 | tail -5
```

Expected: 오류 없이 완료 (CSS만 추가했으므로 빌드 오류 없음)

- [ ] **Step 3: 커밋**

```bash
git add app/globals.css
git commit -m "style: add map-centric layout CSS classes"
```

---

## Task 2: BottomSheet 컴포넌트 (모바일 드래그 시트)

**Files:**
- Create: `app/components/BottomSheet.js`

- [ ] **Step 1: `BottomSheet.js` 생성**

```js
'use client';
import { useRef, useEffect, useCallback } from 'react';

const SNAP_HALF = 0.5;   // 기본 높이 (화면의 50%)
const SNAP_MAX = 0.85;   // 최대 높이 (화면의 85%)
const SNAP_MIN_PX = 120; // 최소 높이 (px)

export default function BottomSheet({ children, header, sheetHeightRef }) {
  const sheetRef = useRef(null);
  const dragState = useRef(null); // { startY, startH }

  const setHeight = useCallback((h) => {
    if (!sheetRef.current) return;
    sheetRef.current.style.height = `${h}px`;
    if (sheetHeightRef) sheetHeightRef.current = h;
  }, [sheetHeightRef]);

  // 초기 높이 설정
  useEffect(() => {
    const init = () => {
      const vh = window.innerHeight;
      setHeight(Math.round(vh * SNAP_HALF));
    };
    init();
    window.addEventListener('resize', init);
    return () => window.removeEventListener('resize', init);
  }, [setHeight]);

  const onTouchStart = useCallback((e) => {
    const touch = e.touches[0];
    const currentH = sheetRef.current?.offsetHeight || 0;
    dragState.current = { startY: touch.clientY, startH: currentH };
  }, []);

  const onTouchMove = useCallback((e) => {
    if (!dragState.current || !sheetRef.current) return;
    e.preventDefault();
    const touch = e.touches[0];
    const delta = dragState.current.startY - touch.clientY;
    const vh = window.innerHeight;
    const newH = Math.min(
      Math.max(dragState.current.startH + delta, SNAP_MIN_PX),
      Math.round(vh * SNAP_MAX)
    );
    setHeight(newH);
  }, [setHeight]);

  const onTouchEnd = useCallback(() => {
    if (!sheetRef.current) return;
    const vh = window.innerHeight;
    const h = sheetRef.current.offsetHeight;
    // 스냅: 최소/절반/최대 중 가장 가까운 곳으로
    const snaps = [SNAP_MIN_PX, Math.round(vh * SNAP_HALF), Math.round(vh * SNAP_MAX)];
    const closest = snaps.reduce((a, b) => Math.abs(b - h) < Math.abs(a - h) ? b : a);
    setHeight(closest);
    dragState.current = null;
  }, [setHeight]);

  // 아이콘 전환 시 시트를 절반 높이로 리셋
  useEffect(() => {
    if (sheetRef.current) return; // sheetRef 마운트 후에만
  }, []);

  return (
    <div className="bottom-sheet" ref={sheetRef}>
      <div
        className="bottom-sheet-handle-area"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <div className="bottom-sheet-handle" />
      </div>
      {header && <div className="bottom-sheet-header">{header}</div>}
      <div className="bottom-sheet-content">
        {children}
      </div>
    </div>
  );
}

// 아이콘 전환 시 시트를 절반 높이로 리셋하는 유틸
export function resetBottomSheet(sheetEl) {
  if (!sheetEl) return;
  const vh = window.innerHeight;
  sheetEl.style.height = `${Math.round(vh * SNAP_HALF)}px`;
}
```

- [ ] **Step 2: 빌드 확인**

```bash
npm run build 2>&1 | tail -5
```

Expected: 오류 없음

- [ ] **Step 3: 커밋**

```bash
git add app/components/BottomSheet.js
git commit -m "feat: add BottomSheet component with touch drag"
```

---

## Task 3: RoomPanel 컴포넌트 (아이콘 네비 + 패널 렌더러)

**Files:**
- Create: `app/components/RoomPanel.js`

RoomPanel은 아이콘 버튼 목록과 현재 활성 패널의 제목·내용을 props로 받아서 렌더링한다.
데스크탑에서는 `.room-sidebar` 안에, 모바일에서는 `BottomSheet` 안에 삽입된다.

- [ ] **Step 1: `RoomPanel.js` 생성**

```js
'use client';

// panels: [{ id, icon, label, panel: ReactNode, mobileOnly?: bool }]
// activePanel: string (현재 패널 id)
// onSelect: (id) => void
export function PanelIconBar({ panels, activePanel, onSelect }) {
  return (
    <div className="room-icon-bar">
      {panels.map(({ id, icon, disabled }) => (
        <button
          key={id}
          className={`room-icon-btn${activePanel === id ? ' active' : ''}${disabled ? ' disabled' : ''}`}
          onClick={() => !disabled && onSelect(id)}
          title={id}
          aria-label={id}
        >
          {icon}
        </button>
      ))}
    </div>
  );
}

// 현재 패널의 제목 반환
export function getPanelTitle(panels, activePanel) {
  return panels.find(p => p.id === activePanel) ?? panels[0];
}
```

- [ ] **Step 2: 빌드 확인**

```bash
npm run build 2>&1 | tail -5
```

Expected: 오류 없음

- [ ] **Step 3: 커밋**

```bash
git add app/components/RoomPanel.js
git commit -m "feat: add RoomPanel icon nav component"
```

---

## Task 4: 방 페이지 레이아웃 재구성

**Files:**
- Modify: `app/room/[roomId]/page.js`

기존 핸들러·상태는 **전혀 변경하지 않는다**. `return` 블록의 JSX만 교체한다.

- [ ] **Step 1: import 추가 및 `activePanel` 상태 추가**

파일 상단 import에 아래 두 줄 추가:

```js
import BottomSheet, { resetBottomSheet } from '../../components/BottomSheet';
import { PanelIconBar, getPanelTitle } from '../../components/RoomPanel';
```

`useState` 훅 선언 블록(기존 `const [nameConflictLoading` 바로 아래)에 추가:

```js
const [activePanel, setActivePanel] = useState('search');
const bottomSheetRef = useRef(null);
```

파일 상단 `import { useState, useEffect, useCallback }` 을 아래로 교체:

```js
import { useState, useEffect, useCallback, useRef } from 'react';
```

- [ ] **Step 2: panels 배열 정의**

`computedIsHost` 선언 바로 아래에 추가:

```js
const isHoesik = room?.roomType === 'hoesik';

const panels = [
  { id: 'search',   icon: '🔍', label: '음식점 검색' },
  { id: 'vote',     icon: '🗳️', label: '투표' },
  { id: 'chat',     icon: '💬', label: '채팅' },
  { id: 'attend',   icon: '🙋', label: '참여 여부' },
  { id: 'schedule', icon: '🗓️', label: '날짜·시간 투표', disabled: !isHoesik },
];

const handlePanelSelect = (id) => {
  setActivePanel(id);
  resetBottomSheet(bottomSheetRef.current);
};

const activeInfo = getPanelTitle(panels, activePanel);
```

- [ ] **Step 3: 패널별 콘텐츠 렌더 함수 작성**

`handleClose` 함수 아래에 추가:

```js
const renderPanelContent = () => {
  switch (activePanel) {
    case 'search':
      return (
        <>
          {room.status === 'voting' && (
            <RestaurantSearch
              lat={currentLocation?.lat || room.location?.lat}
              lng={currentLocation?.lng || room.location?.lng}
              areaName={areaName}
              onAdd={handleAddRestaurant}
              onResults={setSearchMarkers}
              addedNames={new Set(Object.values(room?.menus || {}).map(m => m.name))}
              noRadius={room.roomType === 'hoesik'}
            />
          )}
          {room.status !== 'voting' && (
            <p style={{ color: '#999', fontSize: '13px', textAlign: 'center', padding: '20px 0' }}>투표가 마감되었습니다.</p>
          )}
        </>
      );
    case 'vote':
      return (
        <>
          <MenuList
            menus={room.menus}
            votes={room.votes}
            myVotes={myVotes}
            onVote={handleVote}
            onDelete={id => fetch(`/api/db/rooms/${roomId}/menus/${id}`, { method: 'DELETE' }).then(fetchRoomData)}
            status={room.status}
          />
          {room.status === 'voting' && (
            <>
              <AddMenu onAdd={handleAddMenu} />
              {computedIsHost && (
                <button className="close-btn" onClick={handleClose} style={{ marginTop: '12px' }}>
                  투표 마감하기
                </button>
              )}
            </>
          )}
        </>
      );
    case 'chat':
      return <Chat roomId={roomId} user={user} />;
    case 'attend':
      return (
        <>
          <div className="participation-selector" style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
            <button
              className={`participation-btn ${participation === 'participate' ? 'active' : ''}`}
              onClick={() => handleParticipationChange('participate')}
            >
              🙋‍♂️ 참여
            </button>
            <button
              className={`participation-btn decline ${participation === 'decline' ? 'active' : ''}`}
              onClick={() => handleParticipationChange('decline', participationReason)}
            >
              🙅‍♀️ 미참여
            </button>
          </div>
          {participation === 'decline' && (
            <div className="decline-reason-input" style={{ marginBottom: '16px' }}>
              <input
                type="text"
                placeholder="미참여 사유 입력"
                value={participationReason}
                onChange={(e) => setParticipationReason(e.target.value)}
              />
              <button
                className="reason-save-btn"
                onClick={() => handleParticipationChange('decline', participationReason, true)}
              >
                저장
              </button>
            </div>
          )}
          <div className="participant-status-list">
            <h3>참여자 현황</h3>
            <div className="status-grid">
              <div className="status-column">
                <h4>참여 ({Object.values(room?.participation || {}).filter(p => p.status === 'participate').length})</h4>
                <ul>
                  {Object.values(room?.participation || {})
                    .filter(p => p.status === 'participate')
                    .map((p, idx) => (
                      <li key={idx}>{p.isGuest && <span className="guest-badge">👤</span>}{p.nickname}</li>
                    ))}
                </ul>
              </div>
              <div className="status-column decline">
                <h4>미참여 ({Object.values(room?.participation || {}).filter(p => p.status === 'decline').length})</h4>
                <ul>
                  {Object.values(room?.participation || {})
                    .filter(p => p.status === 'decline')
                    .map((p, idx) => (
                      <li key={idx}>
                        <strong>{p.isGuest && <span className="guest-badge">👤</span>}{p.nickname}</strong>
                        {p.reason && <span className="reason"> - {p.reason}</span>}
                      </li>
                    ))}
                </ul>
              </div>
            </div>
          </div>
        </>
      );
    case 'schedule':
      return (
        <>
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
        </>
      );
    default:
      return null;
  }
};
```

- [ ] **Step 4: return JSX 전체 교체**

`if (loading) return ...` 위쪽까지의 기존 코드는 그대로 두고, `return (` 부터 `);` 까지를 아래로 교체한다.
(비밀번호 게이트 `if (!passwordChecked)` 블록은 그대로 둔다 — 그 아래 최종 return만 교체)

```jsx
return (
  <div className="room-map-layout">
    {/* 슬림 헤더 */}
    <header className="room-map-header">
      {editingTitle ? (
        <input
          className="room-title-input"
          value={titleInput}
          onChange={(e) => setTitleInput(e.target.value)}
          onBlur={handleTitleSave}
          onKeyDown={(e) => { if (e.key === 'Enter') handleTitleSave(); if (e.key === 'Escape') setEditingTitle(false); }}
          autoFocus
        />
      ) : (
        <>
          <h1>{room.roomName || '오늘 뭐 먹지?'}</h1>
          {computedIsHost && (
            <button className="title-edit-btn" onClick={() => { setTitleInput(room.roomName || ''); setEditingTitle(true); }}>✏️</button>
          )}
        </>
      )}
      <div className="header-right">
        <span className="header-code">{roomId}</span>
        <button className="header-btn" onClick={() => { navigator.clipboard.writeText(window.location.href); alert('복사됨'); }}>링크 복사</button>
        <button className="header-btn" onClick={() => router.push('/')}>나가기</button>
      </div>
    </header>

    {/* 본문 */}
    <div className="room-map-body">
      {/* 데스크탑 왼쪽 패널 */}
      <aside className="room-sidebar">
        <div className="room-sidebar-header">
          <span>{activeInfo.icon}</span>
          <span>{activeInfo.label}</span>
        </div>
        <div className="room-sidebar-content">
          {renderPanelContent()}
        </div>
      </aside>

      {/* 지도 */}
      <div className="room-map-area">
        {currentLocation && (
          <NaverMap
            lat={currentLocation.lat}
            lng={currentLocation.lng}
            markers={searchMarkers}
            menuMarkers={Object.values(room?.menus || {}).filter(m => m.lat && m.lng).map(m => ({ name: m.name, lat: m.lat, lng: m.lng }))}
            onReady={handleMapReady}
          />
        )}

        {/* 아이콘 바 */}
        <PanelIconBar
          panels={panels}
          activePanel={activePanel}
          onSelect={handlePanelSelect}
        />

        {/* 현재 위치 갱신 버튼 */}
        <button
          className="room-location-btn"
          onClick={handleUpdateLocation}
          disabled={locating}
        >
          📍 {locating ? '가져오는 중...' : '현재위치'}
        </button>

        {/* 모바일: 하단 드래그 시트 */}
        <BottomSheet
          ref={bottomSheetRef}
          header={<><span>{activeInfo.icon}</span><span>{activeInfo.label}</span></>}
        >
          {renderPanelContent()}
        </BottomSheet>
      </div>
    </div>

    {/* 이름 충돌 모달 (기존 유지) */}
    {nameConflictModal && (
      <div className="modal-overlay">
        <div className="modal-content">
          <h3>이름 변경 필요</h3>
          <p style={{ fontSize: '14px', color: '#666', marginBottom: '12px' }}>
            이미 <strong>{nickname}</strong>이 이 방에 있습니다.<br />이름을 변경하고 입장하세요.
          </p>
          <input
            type="text"
            placeholder="새 이름 입력"
            value={nameConflictInput}
            onChange={(e) => { setNameConflictInput(e.target.value); setNameConflictError(''); }}
            onKeyDown={(e) => e.key === 'Enter' && handleNameConflictSubmit()}
            maxLength={20}
            autoFocus
          />
          {nameConflictError && <p className="error">{nameConflictError}</p>}
          <div className="modal-buttons">
            <button className="primary-btn" onClick={handleNameConflictSubmit} disabled={nameConflictLoading}>
              {nameConflictLoading ? '확인 중...' : '변경 후 입장'}
            </button>
          </div>
        </div>
      </div>
    )}
  </div>
);
```

- [ ] **Step 5: BottomSheet에 forwardRef 적용**

`bottomSheetRef`를 `BottomSheet`에 넘기려면 `forwardRef`가 필요하다.
`app/components/BottomSheet.js`의 export 부분을 수정한다:

```js
'use client';
import { useRef, useEffect, useCallback, forwardRef } from 'react';

const SNAP_HALF = 0.5;
const SNAP_MAX = 0.85;
const SNAP_MIN_PX = 120;

const BottomSheet = forwardRef(function BottomSheet({ children, header }, ref) {
  const sheetRef = useRef(null);
  const dragState = useRef(null);

  // ref를 외부에서 접근 가능하게 (resetBottomSheet에서 사용)
  useEffect(() => {
    if (ref && sheetRef.current) {
      if (typeof ref === 'function') ref(sheetRef.current);
      else ref.current = sheetRef.current;
    }
  }, [ref]);

  const setHeight = useCallback((h) => {
    if (!sheetRef.current) return;
    sheetRef.current.style.height = `${h}px`;
  }, []);

  useEffect(() => {
    const init = () => {
      const vh = window.innerHeight;
      setHeight(Math.round(vh * SNAP_HALF));
    };
    init();
    window.addEventListener('resize', init);
    return () => window.removeEventListener('resize', init);
  }, [setHeight]);

  const onTouchStart = useCallback((e) => {
    const touch = e.touches[0];
    dragState.current = { startY: touch.clientY, startH: sheetRef.current?.offsetHeight || 0 };
  }, []);

  const onTouchMove = useCallback((e) => {
    if (!dragState.current || !sheetRef.current) return;
    e.preventDefault();
    const touch = e.touches[0];
    const delta = dragState.current.startY - touch.clientY;
    const vh = window.innerHeight;
    const newH = Math.min(
      Math.max(dragState.current.startH + delta, SNAP_MIN_PX),
      Math.round(vh * SNAP_MAX)
    );
    setHeight(newH);
  }, [setHeight]);

  const onTouchEnd = useCallback(() => {
    if (!sheetRef.current) return;
    const vh = window.innerHeight;
    const h = sheetRef.current.offsetHeight;
    const snaps = [SNAP_MIN_PX, Math.round(vh * SNAP_HALF), Math.round(vh * SNAP_MAX)];
    const closest = snaps.reduce((a, b) => Math.abs(b - h) < Math.abs(a - h) ? b : a);
    setHeight(closest);
    dragState.current = null;
  }, [setHeight]);

  return (
    <div className="bottom-sheet" ref={sheetRef}>
      <div
        className="bottom-sheet-handle-area"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <div className="bottom-sheet-handle" />
      </div>
      {header && <div className="bottom-sheet-header">{header}</div>}
      <div className="bottom-sheet-content">
        {children}
      </div>
    </div>
  );
});

export default BottomSheet;

export function resetBottomSheet(sheetEl) {
  if (!sheetEl) return;
  const vh = window.innerHeight;
  sheetEl.style.height = `${Math.round(vh * SNAP_HALF)}px`;
}
```

- [ ] **Step 6: `globals.css`에서 `body`의 `min-height:100vh` 확인 및 `room-map-layout` 오버플로 조정**

`body`에 이미 `min-height: 100vh`가 있다. `room-map-layout`이 `position: fixed; inset: 0`으로 뷰포트 전체를 차지하므로 body 스크롤을 방지하기 위해 아래를 `globals.css`의 `/* ===== Room Map-Centric Layout =====` 블록 상단에 추가:

```css
body:has(.room-map-layout) {
  overflow: hidden;
}
```

- [ ] **Step 7: 빌드 확인**

```bash
npm run build 2>&1 | tail -20
```

Expected: 오류 없음. 경고는 무시해도 됨.

- [ ] **Step 8: 커밋**

```bash
git add app/room/[roomId]/page.js app/components/BottomSheet.js app/globals.css
git commit -m "feat: redesign room page to map-centric layout with panel switching"
```

---

## Task 5: NaverMap 전체 높이 대응

**Files:**
- Modify: `app/components/NaverMap.js`

현재 NaverMap은 `height: 300px` 고정이다. `room-map-area` 안에서는 `position: absolute; inset: 0`으로 부모가 높이를 정하므로, NaverMap이 `100%`를 채워야 한다.

- [ ] **Step 1: NaverMap의 div 높이 수정**

`app/components/NaverMap.js` 117~122행:

```jsx
// 변경 전
return (
  <div className="map-container">
    <div ref={mapRef} style={{ width: '100%', height: '300px' }} />
  </div>
);

// 변경 후
return (
  <div className="map-container" style={{ height: '100%' }}>
    <div ref={mapRef} style={{ width: '100%', height: '100%' }} />
  </div>
);
```

- [ ] **Step 2: 빌드 확인**

```bash
npm run build 2>&1 | tail -5
```

Expected: 오류 없음

- [ ] **Step 3: 커밋**

```bash
git add app/components/NaverMap.js
git commit -m "fix: NaverMap fills parent height for map-centric layout"
```

---

## Task 6: 수동 검증

테스트 프레임워크가 없으므로 개발 서버를 켜고 직접 확인한다.

- [ ] **Step 1: 개발 서버 실행**

```bash
npm run dev
```

- [ ] **Step 2: 데스크탑(≥768px) 확인 체크리스트**

브라우저에서 방 페이지 접속:
- [ ] 슬림 헤더(주황, 44px)에 방이름·방코드·링크복사·나가기 표시
- [ ] 왼쪽 패널(340px)이 보이고 기본값 🔍 검색 패널 표시
- [ ] 오른쪽 지도가 나머지 전체 높이 차지
- [ ] 지도 오른쪽에 아이콘 5개(검색·투표·채팅·참여·날짜) 수직 배열
- [ ] 🔍 아이콘 주황색(active), 나머지 흰색
- [ ] 각 아이콘 클릭 시 왼쪽 패널 내용 전환
- [ ] 🗓️ 날짜투표: 점심방에서 비활성(흐리게), 회식방에서 활성
- [ ] 📍 현재위치 버튼 지도 우하단에 표시
- [ ] 지도에 검색 핀(주황) · 메뉴 핀(파랑) 정상 표시

- [ ] **Step 3: 모바일(<768px) 확인 체크리스트**

브라우저 개발자도구 → 모바일 뷰(375px):
- [ ] 지도 전체화면
- [ ] 하단 시트 50% 높이로 시작, 검색 패널 표시
- [ ] 핸들 드래그로 높이 조절 (min 120px, max 85vh)
- [ ] 아이콘 클릭 시 시트 내용 전환 + 50%로 리셋
- [ ] 아이콘 바 지도 오른쪽에 표시

- [ ] **Step 4: 최종 커밋**

이슈가 없으면 아무것도 추가로 커밋하지 않는다. 이슈가 있으면 수정 후 커밋.

---

## 자체 검토 (Spec Coverage)

| 스펙 요구사항 | 담당 Task |
|---|---|
| 데스크탑 2-컬럼 (왼쪽 340px + 오른쪽 지도) | Task 1, 4 |
| 모바일 전체 지도 + 드래그 시트 | Task 1, 2, 4 |
| 아이콘 5개 (검색/투표/채팅/참여/날짜) | Task 3, 4 |
| 기본 패널: 검색 | Task 4 (useState 초기값 'search') |
| 날짜투표: 회식방만 활성 | Task 4 (disabled: !isHoesik) |
| 드래그 스냅: 50%/85%/120px | Task 2 |
| NaverMap 전체 높이 | Task 5 |
| 슬림 헤더 44px | Task 1, 4 |
