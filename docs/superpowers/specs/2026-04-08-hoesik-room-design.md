# 회식 방 기능 설계

**날짜:** 2026-04-08  
**상태:** 승인됨

---

## 개요

기존 점심 메뉴 투표 기능에 더해 **회식장소 투표** 기능을 추가한다.  
홈 화면에 점심/회식 탭을 추가하고, 회식 방에는 날짜·시간 투표와 반경 제한 없는 음식점 검색 기능을 제공한다.

---

## 1. 데이터 모델

기존 `rooms` PostgreSQL 테이블에 컬럼 3개 추가:

```sql
roomType        TEXT DEFAULT 'lunch'   -- 'lunch' | 'hoesik'
schedules       JSONB DEFAULT '{}'     -- 날짜·시간 후보 목록
scheduleVotes   JSONB DEFAULT '{}'     -- 날짜·시간 투표 결과
```

### schedules 구조

```json
{
  "s_abc123": {
    "id": "s_abc123",
    "date": "2025-05-15",
    "hasTime": true,
    "hour": 19,
    "minute": 0,
    "addedBy": "정경민",
    "addedAt": 1715000000000
  }
}
```

- `hasTime: false`인 경우 `hour`, `minute` 필드 없음
- `id`는 클라이언트에서 `s_` + 랜덤 6자리로 생성

### scheduleVotes 구조

기존 `votes`와 동일한 패턴:

```json
{
  "uid_xxx": {
    "nickname": "정경민",
    "scheduleIds": ["s_abc123", "s_def456"]
  }
}
```

---

## 2. 홈 화면

### 탭 구조

- 상단에 `점심 | 회식` 탭 추가
- 탭 전환 시 해당 `roomType`의 방 목록만 표시
- 방 만들기 버튼은 현재 탭 기준으로 `roomType` 자동 설정

### 방 생성

| 구분 | 점심 | 회식 |
|------|------|------|
| 위치 권한 | 필수 | 선택사항 |
| roomType | `'lunch'` | `'hoesik'` |

### 방 카드

- 회식 방에는 `🍻 회식` 배지 표시
- 점심 방은 기존과 동일

---

## 3. 회식 방 페이지

### 추가 섹션: 날짜·시간 투표

- 위치: 메뉴 투표 섹션 **위**에 배치
- 기존 MenuList/AddMenu 패턴 그대로 차용

**후보 추가 UI:**
1. 달력(date input)으로 날짜 선택
2. "시간 포함" 라디오 버튼 (예/아니오)
3. 시간 포함 선택 시: 시 드롭다운(0~23) + 분 드롭다운(0, 10, 20, 30, 40, 50)

**투표 동작:**
- 기존 메뉴 투표와 동일 (토글 방식, 다중 선택 가능)
- 투표 마감 시 최다 득표 날짜·시간이 result에 포함

### 변경 사항

| 항목 | 점심 방 | 회식 방 |
|------|---------|---------|
| 음식점 검색 반경 | 1km 제한 | 제한 없음 |
| 참여 여부 라벨 | "점심 참여 여부" | "회식 참여 여부" |
| 결과 페이지 | 당선 메뉴 | 당선 메뉴 + 당선 날짜·시간 |

### 유지되는 기능

메뉴(음식점) 투표, 채팅, 지도, 방 코드 공유, 참여자 현황 — 모두 동일하게 유지.

---

## 4. 영향 범위

### 수정 파일

- `app/lib/db.js` — 컬럼 3개 추가 (마이그레이션 포함)
- `app/api/db/[...path]/route.js` — `schedules`, `scheduleVotes` 경로 핸들링
- `app/utils/room.js` — `createRoom`에 `roomType` 파라미터 추가
- `app/page.js` — 탭 UI, 방 생성 시 roomType 전달
- `app/room/[roomId]/page.js` — 회식 방 분기 처리
- `app/components/RestaurantSearch.js` — 반경 파라미터 추가

### 신규 파일

- `app/components/ScheduleVote.js` — 날짜·시간 후보 목록 + 투표 UI
- `app/components/AddSchedule.js` — 날짜·시간 후보 추가 폼
