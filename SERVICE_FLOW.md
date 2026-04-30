# 서비스 흐름 설명

## 전체 구조

```
브라우저 (React)
    ↕ HTTPS
Cloudflare Tunnel
    ↕ HTTP
Docker (Next.js 서버) ← 모든 비즈니스 로직 처리
    ↕
SQLite DB (./data/lunch.db)
```

Next.js App Router는 **서버(API Routes)**와 **클라이언트(React 컴포넌트)**가 한 프로젝트에 공존합니다.
- `app/api/` → 서버에서만 실행 (DB 접근, 외부 API 호출, 키 관리)
- `app/components/` → 브라우저에서 실행 (`'use client'` 선언 필수)

---

## 1. 인증 흐름 (카카오 로그인)

```
1. 사용자가 "카카오 로그인" 클릭
        ↓
2. 브라우저 → GET /api/kakaoLogin?redirectUri=https://lunch-picker.com
        ↓
3. 서버 → 카카오 인가 URL로 리다이렉트
   (https://kauth.kakao.com/oauth/authorize?client_id=...)
        ↓
4. 카카오 로그인 완료 → 브라우저로 code 전달
   (https://lunch-picker.com?code=XXXXX)
        ↓
5. AuthContext가 URL의 code를 감지
        ↓
6. 브라우저 → GET /api/kakaoAuth?code=XXXXX&redirectUri=...
        ↓
7. 서버에서 처리 (브라우저에 노출 안 됨):
   - 카카오에 access_token 발급 요청
   - access_token으로 사용자 정보 조회 (uid, nickname)
   - 로그인 이력 DB 저장
   - JWT 발급 → HttpOnly 쿠키로 저장
        ↓
8. 브라우저에는 uid, nickname만 전달
   → localStorage에 저장 (UI 표시용)
```

**핵심 보안 포인트**
- `KAKAO_REST_API_KEY`는 서버에서만 사용, 브라우저에 절대 노출 안 됨
- `access_token`은 서버에서만 처리, 브라우저로 전달되지 않음
- JWT는 `HttpOnly` 쿠키 → JS로 접근 불가 (XSS 차단)

---

## 2. 세션 검증 흐름

매 앱 시작 시 (`AuthContext.js`):

```
1. localStorage에 저장된 유저 정보로 UI 즉시 표시
        ↓
2. GET /api/me 호출 → 서버가 JWT 쿠키 검증
        ↓
   유효 → 정상 사용
   만료/없음 → 자동 로그아웃 (localStorage 초기화)
```

---

## 3. API 인증 구조

모든 쓰기 요청(`POST`, `PUT`, `PATCH`, `DELETE`)은 서버에서 JWT 쿠키를 검증합니다.

```
브라우저 → PUT /api/db/rooms/ABC123/votes/kakao_123
                ↓
        서버: JWT 쿠키 확인
                ↓
        JWT uid === 경로의 uid? (kakao_123)
          일치 → 처리
          불일치 → 403 Forbidden
```

**경로별 권한 규칙**

| 경로 | 권한 |
|------|------|
| `GET` 전체 | 누구나 가능 |
| `rooms/{id}/votes/{uid}` | 본인 uid만 |
| `rooms/{id}/participation/{uid}` | 본인 uid만 |
| `rooms/{id}/messages/{msgId}/reactions/{emoji}/{uid}` | 본인 uid만 |
| `rooms/{id}/messages/{msgId}` DELETE | 메시지 작성자만 |
| `rooms/{id}` DELETE | 방 생성자만 |
| `users/{uid}` | 본인 uid만 |
| 관리자 | 모든 권한 |

---

## 4. 방 생성 흐름

```
1. 사용자가 방 만들기 클릭
        ↓
2. 브라우저가 위치 정보 요청 (GPS)
        ↓
3. 브라우저 → PUT /api/db/rooms/{랜덤6자리코드}
   body: { roomName, location, status, createdBy, ... }
        ↓
4. 서버: JWT 검증 + createdByUid를 JWT uid로 강제 설정 (스푸핑 방지)
        ↓
5. DB 저장 → SSE로 방 목록 변경 알림
        ↓
6. 브라우저 → /room/{roomId} 이동
```

---

## 5. 실시간 업데이트 (SSE)

Pusher/Firebase 대신 자체 SSE(Server-Sent Events)를 사용합니다.

```
컴포넌트 마운트 시:
  브라우저 → GET /api/sse?channel=rooms/{roomId} (연결 유지)
        ↓
  서버가 데이터 변경 시 → 연결된 브라우저에 이벤트 전송
        ↓
  브라우저가 이벤트 수신 → fetchRoomData() 재호출
```

**SSE가 필요한 이유**: 투표, 채팅, 참여 현황이 여러 사용자에게 실시간으로 반영되어야 함

---

## 6. 음식점 검색 흐름

```
사용자가 검색어 입력
        ↓
브라우저 → GET /api/searchRestaurants?query=파스타&x=126.9&y=37.4
        ↓
서버 → 카카오 로컬 API 호출 (dapi.kakao.com)
   Authorization: KakaoAK {KAKAO_REST_API_KEY}
        ↓
결과 반환 → 지도 마커 표시
```

---

## 7. DB 구조

**SQLite 파일**: `./data/lunch.db`

### rooms 테이블
| 컬럼 | 설명 |
|------|------|
| id | 방 코드 (예: ABC123) |
| room_name | 방 이름 |
| status | `voting` / `closed` |
| created_by | 생성자 닉네임 |
| created_by_uid | 생성자 UID |
| created_at | 생성 시각 (Unix ms) |
| password | 비밀번호 (없으면 NULL) |
| location | JSON `{lat, lng}` |
| menus | JSON (메뉴 목록) |
| votes | JSON (투표 현황) |
| participation | JSON (참여 현황) |
| messages | JSON (채팅 메시지) |
| result | JSON (투표 결과) |

### users 테이블
| 컬럼 | 설명 |
|------|------|
| id | 카카오 UID (예: kakao_123456) |
| data | JSON `{nickname, profileImage, updatedAt}` |

### login_history 테이블
| 컬럼 | 설명 |
|------|------|
| id | 자동 증가 PK |
| uid | 로그인한 UID |
| nickname | 닉네임 |
| type | `kakao` / `admin` |
| logged_in_at | Unix ms |
| login_time | KST 시각 문자열 |

---

## 8. 환경변수 & 키 관리

| 변수 | 위치 | 용도 |
|------|------|------|
| `KAKAO_REST_API_KEY` | 서버 전용 | 카카오 로그인, 장소 검색 |
| `NAVER_MAPS_CLIENT_ID` | 서버 전용 | 네이버 지도 SDK 로드 |
| `JWT_SECRET` | 서버 전용 | JWT 서명/검증 |
| `ADMIN_ID` / `ADMIN_PW` | 서버 전용 | 관리자 로그인 |

> `NEXT_PUBLIC_` 접두사가 붙은 변수는 빌드 결과물에 포함되어 브라우저에 노출됩니다.
> 위 키들은 모두 서버에서만 사용하므로 `NEXT_PUBLIC_` 사용 금지.

---

## 9. 배포 구조

```
Mac 로컬 머신
├── Docker
│   ├── app (Next.js) → localhost:3000
│   └── cloudflared → Cloudflare 터널
└── ./data/lunch.db ← 바인드 마운트로 Docker와 공유

Cloudflare
└── lunch-picker.com → 터널 → Mac:3000
```

**배포 명령**
```bash
docker compose down && docker compose up --build -d
```
- `./data/lunch.db`는 바인드 마운트로 관리되어 재빌드해도 데이터 유지
- `.env.local`의 환경변수가 컨테이너에 주입됨
