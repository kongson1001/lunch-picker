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
보안을 위해 다음 변수 설정이 필수입니다.

### Client-side (NEXT_PUBLIC_ prefix 필수)
- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_DATABASE_URL`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_KAKAO_JS_KEY`
- `NEXT_PUBLIC_NAVER_MAPS_CLIENT_ID`

### Server-side (Secret)
- `KAKAO_REST_API_KEY`: 카카오 로그인 토큰 발급용
- `ADMIN_ID`, `ADMIN_PW`: 관리자 페이지 인증용

## ⚠️ 개발 가이드 및 규칙
1. **보안**: API 키나 비밀번호 등 민감한 정보는 반드시 `app/api` 내부의 서버 사이드 로직에서 처리하고, 클라이언트에 노출하지 않습니다.
2. **Client/Server 분리**: 브라우저 API(window, localStorage 등)를 사용하는 컴포넌트는 파일 최상단에 `'use client'`를 명시합니다.
3. **실시간성**: 메뉴 투표 및 채팅은 Firebase Realtime Database의 `onValue`를 통해 실시간으로 동기화됩니다.
4. **스타일**: CSS는 `app/globals.css`에서 중앙 집중식으로 관리하며, 모바일 우선 반응형 디자인을 유지합니다.
5. **API 호출**: 클라이언트에서 직접 외부 API를 호출하는 대신, `app/api`에 작성된 로컬 API 엔드포인트를 호출하여 CORS 및 보안 문제를 해결합니다.
