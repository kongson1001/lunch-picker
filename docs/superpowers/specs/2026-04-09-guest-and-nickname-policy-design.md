# 비로그인 사용자 & 이름 중복 정책 설계

**날짜:** 2026-04-09  
**상태:** 승인됨

---

## 개요

세 가지 정책을 하나의 "사용자 신원" 시스템으로 통합 구현한다.

1. **카카오 로그인 중복 이름 처리** — 신규 카카오 유저 이름이 기존 유저와 겹치면 입력창으로 유도
2. **비로그인 시스템** — "비로그인으로 시작" 버튼으로 이름만 등록해 풀 참여 가능
3. **방 안 회원/비로그인 구분** — 비로그인 사용자 이름 앞 👤 배지, 이미지 업로드 비활성화
4. **방 진입 시 이름 중복 처리** — 방 안에 같은 이름 있으면 이름 변경 유도 후 입장

---

## 1. 이름 중복 검사 API

### `GET /api/checkNickname?nickname=xxx&excludeUid=yyy`

- `nickname`: 검사할 이름
- `excludeUid` (선택): 본인 uid — 자기 자신은 중복 제외
- DB `users` 테이블에서 `data->>'nickname' = $1 AND id != $2` 쿼리
- 응답: `{ available: boolean }`

**중복 시 공통 안내 문구:** `"사용이 불가능한 이름입니다"`

---

## 2. 비로그인 시스템

### 흐름

1. 홈 화면 로그인 버튼 아래 "비로그인으로 시작" 버튼 추가
2. 클릭 → 이름 입력 모달 표시
3. 이름 입력 → `/api/checkNickname` 검사
   - 중복: "사용이 불가능한 이름입니다" 표시, 재입력 유도
   - 통과: `POST /api/guestLogin` 호출
4. 서버에서 `guest_` + 랜덤 8자리 uid 생성
5. JWT 쿠키 발급 (`{ uid, isGuest: true }`, 만료 1일)
6. 응답: `{ uid, nickname, isGuest: true }`
7. localStorage에 저장, 홈 화면 진입

### `POST /api/guestLogin`

- Body: `{ nickname }`
- 서버에서 닉네임 중복 재검증 (클라이언트 검사는 참고용)
- `guest_` + `crypto.randomBytes(4).toString('hex')` → uid 생성
- `createSessionCookie({ uid, isGuest: true })` 발급
- DB `users` 테이블에 저장하지 않음 (JWT만으로 인증)

### 비로그인 제한사항

- 프로필 이미지 업로드 불가 (UI에서 이미지 선택 버튼 숨김)
- 이름 변경은 가능 (중복 검사 포함)
- 투표, 채팅, 참여 여부 등 모든 방 기능 사용 가능 (회원과 동일)

---

## 3. 카카오 신규 로그인 중복 이름 처리

### 흐름

1. 카카오 로그인 완료 → `handleAuthCode`에서 `{ uid, nickname }` 수신
2. DB에 해당 uid 프로필이 없는 경우(신규 유저)에만 중복 검사
3. `/api/checkNickname?nickname=xxx&excludeUid=uid` 호출
4. 중복 없음: 기존처럼 프로필 저장 후 로그인 완료
5. 중복 있음: 이름 입력 모달 표시
   > "이미 **{nickname}**이라는 사용자가 있습니다. 사용할 이름을 입력해주세요."
6. 새 이름 입력 → 중복 검사 반복 → 통과 시 해당 이름으로 프로필 저장 + 로그인 완료

기존 유저(재로그인)는 중복 검사 없이 저장된 이름 사용.

---

## 4. 방 진입 시 이름 중복 처리

### 대상

- 회원 / 비로그인 모두 동일하게 적용

### 흐름

1. 방 진입 시 해당 방의 `participation`과 `votes` 객체를 합산해 현재 참여자 닉네임 Set 구성 (`new Set([...Object.values(participation).map(p=>p.nickname), ...Object.values(votes).map(v=>v.nickname)])`)
2. 내 이름과 비교
3. 같은 이름 있으면 입장 차단 + 모달:
   > "이미 **{nickname}**이 이 방에 있습니다. 이름을 변경하고 입장하세요."
4. 이름 입력 → `/api/checkNickname` 전역 중복 검사
   - 중복: "사용이 불가능한 이름입니다"
   - 통과: 이름 영구 변경 후 방 진입
5. 이름 변경은 `updateProfile` 함수 재사용 (회원 / 비로그인 공통)

---

## 5. 방 안 회원/비로그인 구분

### 데이터 저장

비로그인 사용자가 방에서 행동할 때 클라이언트가 `user.isGuest` 값을 읽어 요청 body에 포함 (`isGuest: user?.isGuest || false`). 서버는 받은 값을 그대로 저장:

- `votes`: `{ uid: { nickname, menuIds, isGuest: true } }`
- `participation`: `{ uid: { nickname, status, reason, isGuest: true } }`
- `messages`: `{ msgId: { uid, nickname, text, isGuest: true, ... } }`
- `scheduleVotes`: `{ uid: { nickname, scheduleIds, isGuest: true } }`

### maskRoomUids 수정

마스킹 시 `isGuest` 필드 보존:
- votes: `{ menuIds, nickname, isGuest }`
- participation: `{ nickname, status, reason, updatedAt, isGuest }`
- scheduleVotes: `{ scheduleIds, nickname, isGuest }`
- messages: uid만 제거, 나머지(`isGuest` 포함) 유지

### UI 표시

| 위치 | 표시 방식 |
|------|-----------|
| 참여자 현황 (참여/미참여 목록) | `👤 홍길동` |
| 투표 목록 투표자 이름 | `👤 홍길동` |
| 채팅 메시지 | 이름 앞 `👤` |
| 날짜·시간 투표 투표자 | `👤 홍길동` |

### 프로필 UI

비로그인 사용자의 홈 화면 프로필 카드:
- 이미지 업로드 버튼 숨김 (이미지 클릭 시 파일 선택 비활성화)
- 이름 변경 버튼은 유지

---

## 6. AuthContext 확장

```js
// 기존
{ user, login, loginAsAdmin, logout, loading, updateProfile }

// 추가
{ guestLogin }  // 비로그인 로그인 함수
```

`guestLogin(nickname)`:
1. `/api/checkNickname` 검사
2. `POST /api/guestLogin` 호출
3. localStorage + state 업데이트

`updateProfile`의 닉네임 변경 시 중복 검사 추가:
- 변경 전 `/api/checkNickname?nickname=xxx&excludeUid=uid` 호출
- 중복이면 `throw new Error('사용이 불가능한 이름입니다')`

---

## 7. 영향 범위

### 신규 파일

- `app/api/checkNickname/route.js` — 닉네임 중복 검사 API
- `app/api/guestLogin/route.js` — 비로그인 JWT 발급

### 수정 파일

| 파일 | 변경 내용 |
|------|-----------|
| `app/contexts/AuthContext.js` | `guestLogin` 추가, `updateProfile` 중복 검사 추가, 카카오 신규 로그인 중복 처리 |
| `app/page.js` | "비로그인으로 시작" 버튼 + 이름 입력 모달 |
| `app/room/[roomId]/page.js` | 방 진입 시 이름 중복 체크 + 변경 모달 |
| `app/api/db/[...path]/route.js` | `maskRoomUids`에서 `isGuest` 보존 |
| `app/globals.css` | 👤 배지 스타일 |

### 수정 컴포넌트

| 컴포넌트 | 변경 내용 |
|----------|-----------|
| `MenuList.js` | 투표자 이름에 `👤` 배지 |
| `Chat.js` | 메시지 이름에 `👤` 배지 |
| `ScheduleVote.js` | 투표자 이름에 `👤` 배지 |
| `app/page.js` (프로필 카드) | 비로그인 시 이미지 업로드 숨김 |
