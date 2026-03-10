# Lunch Picker (Next.js Migration)

점심 메뉴 투표 및 실시간 채팅 서비스입니다. 보안 강화 및 SSR 적용을 위해 Vite에서 Next.js App Router로 마이그레이션되었습니다.

## 🛠 주요 기술 스택
- **Framework**: Next.js 15+ (App Router)
- **Database**: Firebase Realtime Database
- **Authentication**: Kakao OAuth (Server-side implementation)
- **Maps**: Naver Maps SDK (Client-side)
- **Deployment**: Vercel

## 🚀 개발 명령
- **개발 서버 실행**: `npm run dev`
- **프로덕션 빌드**: `npm run build`
- **빌드 결과물 실행**: `npm run start`
- **린트 체크**: `npm run lint`

## 📂 프로젝트 구조
- `app/`: Next.js App Router (페이지 및 API)
  - `api/`: 서버 사이드 Route Handlers (비밀키 처리)
  - `components/`: React 컴포넌트 (`'use client'` 지시어 사용)
  - `contexts/`: React Context (Auth 등 상태 관리)
  - `room/[roomId]/`: 동적 라우팅 (투표방 페이지)
  - `utils/`: 공통 유틸리티 함수
- `public/`: 정적 자원

## 🔐 환경 변수 (.env)

### 현재 사용 중인 서버사이드 변수 (브라우저에 절대 노출 금지)
- `FIREBASE_DATABASE_URL`: Firebase Admin SDK용
- `FIREBASE_PROJECT_ID`: Firebase Admin SDK용
- `FIREBASE_CLIENT_EMAIL`: Firebase 서비스 계정
- `FIREBASE_PRIVATE_KEY`: Firebase 서비스 계정
- `KAKAO_REST_API_KEY`: 카카오 로그인 토큰 발급용
- `ADMIN_ID`, `ADMIN_PW`: 관리자 페이지 인증용
- `NAVER_MAPS_CLIENT_ID`: 네이버 지도 (서버에서 클라이언트에 전달)
- `PUSHER_APP_ID`, `PUSHER_KEY`, `PUSHER_SECRET`, `PUSHER_CLUSTER`: Pusher 서버

### Client-side (NEXT_PUBLIC_ 사용 가능한 경우)
- `NEXT_PUBLIC_PUSHER_KEY`, `NEXT_PUBLIC_PUSHER_CLUSTER`: Pusher 클라이언트 SDK (Chat.js에서 직접 사용)
- **그 외 Firebase·Kakao 키는 모두 서버사이드 전용 — `NEXT_PUBLIC_` 사용 금지**

## 🚧 다음 개선 과제: 하이브리드 아키텍처로 성능 개선

**현재 문제**: 모든 데이터 읽기가 Vercel 서버리스 함수를 거침 → 콜드스타트 1~3초 → 예전 Vite 대비 느림

**목표 구조 (하이브리드)**:
- **읽기 / 실시간**: Firebase 클라이언트 SDK (`onValue`) 브라우저에서 직접 → 즉시 반영
- **쓰기 / 민감 작업**: 서버 API 유지 (카카오 로그인, 관리자 기능 등)

**Firebase API 키 노출에 대하여**: Firebase 웹 API 키(`NEXT_PUBLIC_FIREBASE_*`)는 구글 공식 문서 기준으로 **공개되어도 안전한 키**임. Firebase 보안은 키가 아니라 Database Rules로 제어함. 따라서 클라이언트 SDK용 키는 `NEXT_PUBLIC_`으로 노출 허용.

**반드시 서버에만 있어야 할 키 (변경 없음)**:
- `KAKAO_REST_API_KEY`
- `FIREBASE_PRIVATE_KEY` (서비스 계정)
- `ADMIN_ID`, `ADMIN_PW`

**작업 범위**:
1. `app/lib/firebase.js` 생성 — Firebase 클라이언트 SDK 초기화
2. `app/utils/room.js`의 읽기 함수들 (`onRoomList` 등) → `onValue` 방식으로 교체
3. `app/room/[roomId]/page.js` → 폴링 제거, `onValue` 실시간 구독으로 교체
4. `.env.local` 및 Vercel에 `NEXT_PUBLIC_FIREBASE_*` 변수 추가
5. 쓰기(`PUT`, `POST`, `DELETE`)는 기존 서버 API 그대로 유지

---

## ⚠️ 개발 가이드 및 규칙
1. **키 노출 금지**: `NEXT_PUBLIC_`은 빌드 결과물에 평문으로 포함되어 브라우저에 노출됨. 새 환경변수를 추가할 때 반드시 "이 값이 클라이언트 컴포넌트에서 직접 쓰이는가?" 확인 후 결정. 이 프로젝트의 Firebase·Kakao는 전부 서버(Admin SDK, REST API)로만 처리하므로 해당 키에 `NEXT_PUBLIC_` 사용 불가.
2. **보안**: API 키나 비밀번호 등 민감한 정보는 반드시 `app/api` 내부의 서버 사이드 로직에서 처리하고, 클라이언트에 노출하지 않습니다.
3. **Client/Server 분리**: 브라우저 API(window, localStorage 등)를 사용하는 컴포넌트는 파일 최상단에 `'use client'`를 명시합니다.
4. **실시간성**: 메뉴 투표 및 채팅은 Pusher를 통해 실시간으로 동기화됩니다.
5. **스타일**: CSS는 `app/globals.css`에서 중앙 집중식으로 관리하며, 모바일 우선 반응형 디자인을 유지합니다.
6. **API 호출**: 클라이언트에서 직접 외부 API를 호출하는 대신, `app/api`에 작성된 로컬 API 엔드포인트를 호출하여 CORS 및 보안 문제를 해결합니다.
