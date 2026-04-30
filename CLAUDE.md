# Lunch Picker (Next.js)

점심 메뉴 투표 및 실시간 채팅 서비스. Vite → Next.js App Router로 마이그레이션, Firebase/Pusher → SQLite/SSE로 전환.

## 🛠 주요 기술 스택
- **Framework**: Next.js 15+ (App Router)
- **Database**: SQLite (`better-sqlite3`, `./data/lunch.db`)
- **Authentication**: Kakao OAuth (Server-side) + JWT HttpOnly 쿠키
- **Real-time**: SSE (Server-Sent Events) — `app/api/sse/`, `app/lib/sse.js`
- **Maps**: Naver Maps SDK (Client-side)
- **Deployment**: Docker + Cloudflare Tunnel (`lunch-picker.com`)

## 🚀 개발 명령
- **개발 서버 실행**: `npm run dev`
- **프로덕션 빌드**: `npm run build`
- **빌드 결과물 실행**: `npm run start`
- **도커 배포**: `docker compose down && docker compose up --build -d`

## 📂 프로젝트 구조
- `app/`: Next.js App Router
  - `api/`: 서버 사이드 Route Handlers
    - `db/[...path]/`: 범용 DB CRUD API (JWT 인증 포함)
    - `sse/`: SSE 연결 엔드포인트
    - `kakaoAuth/`, `adminAuth/`, `me/`, `logout/`: 인증 관련
    - `searchRestaurants/`: 카카오 로컬 API 프록시
  - `components/`: React 클라이언트 컴포넌트 (`'use client'`)
  - `contexts/`: AuthContext (JWT 세션 검증)
  - `lib/`: 서버 전용 유틸
    - `db.js`: SQLite 초기화, 스키마, 마이그레이션
    - `auth.js`: JWT 서명/검증, 쿠키 헬퍼
    - `sse.js`: SSE 채널 관리 및 notify
  - `room/[roomId]/`: 투표방 페이지
  - `utils/`: 공통 유틸리티
- `data/`: SQLite DB 파일 (바인드 마운트, git/docker 빌드컨텍스트 제외)
- `public/`: 정적 자원

## 🔐 환경 변수 (.env.local)

**주의: Docker `env_file`은 따옴표를 문자 그대로 전달함 → 값에 따옴표 사용 금지**

### 서버사이드 전용 (브라우저 노출 절대 금지)
- `KAKAO_REST_API_KEY`: 카카오 로그인 토큰 발급 + 장소 검색
- `NAVER_MAPS_CLIENT_ID`: 네이버 지도 SDK
- `JWT_SECRET`: JWT 서명/검증 (256비트 랜덤)
- `ADMIN_ID`, `ADMIN_PW`: 관리자 로그인
- `DB_PATH`: SQLite 파일 경로 (기본값: `./data/lunch.db`)

> `NEXT_PUBLIC_` 접두사 키는 빌드 결과물에 평문 포함됨. 위 키들은 모두 서버 전용이므로 `NEXT_PUBLIC_` 사용 금지.

## 🔒 보안 구조
- JWT는 HttpOnly 쿠키 (`session`) → JS 접근 불가 (XSS 차단)
- 모든 쓰기 요청(POST/PUT/PATCH/DELETE)은 JWT 검증 필수
- `rooms/{id}/votes/{uid}`, `participation/{uid}` 등 경로별 uid 검증
- 방 생성 시 `createdByUid`를 JWT uid로 서버에서 강제 설정 (스푸핑 방지)
- `KAKAO_REST_API_KEY`는 서버에서만 사용, access_token 브라우저 미전달

## ⚠️ 개발 규칙
1. **키 노출 금지**: 새 환경변수 추가 시 "클라이언트 컴포넌트에서 직접 쓰이는가?" 확인 필수
2. **Client/Server 분리**: 브라우저 API 사용 컴포넌트는 `'use client'` 명시
3. **실시간성**: 투표/채팅/참여 변경은 SSE로 실시간 반영 (`notify(channel)` 호출)
4. **스타일**: `app/globals.css` 중앙 집중 관리, 모바일 우선
5. **API 호출**: 클라이언트는 외부 API 직접 호출 금지, `app/api` 프록시 경유
6. **SSE + Cloudflare**: QUIC 프로토콜 충돌 방지 위해 SSE 응답에 `Alt-Svc: clear` 헤더 필수
