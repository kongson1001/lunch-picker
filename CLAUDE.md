# Lunch Picker (Server-Side Architecture)

보안 극대화를 위해 Firebase Client SDK를 완전히 제거하고, 모든 DB 작업 및 민감한 키 처리를 서버 사이드(Next.js API)로 일원화한 아키텍처입니다. 실시간 데이터 동기화는 Pusher를 통해 처리합니다.

## 🛠 주요 기술 스택
- **Framework**: Next.js 15+ (App Router)
- **Database**: Firebase Realtime Database (via Firebase Admin SDK)
- **Real-time**: Pusher (Server-to-Client Events)
- **Deployment**: Vercel

## 🚀 개발 명령
- **개발 서버 실행**: `npm run dev`
- **프로덕션 빌드**: `npm run build`

## 🔐 필수 환경 변수 (.env)
이 프로젝트는 클라이언트 키 노출을 방지하기 위해 다음 서버 전용 변수가 필수입니다.

### Server-only (Secret)
- `FIREBASE_PROJECT_ID`, `FIREBASE_DATABASE_URL`
- `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` (Firebase Admin용)
- `PUSHER_APP_ID`, `PUSHER_KEY`, `PUSHER_SECRET`, `PUSHER_CLUSTER` (서버 이벤트 전송용)
- `KAKAO_REST_API_KEY`, `KAKAO_JS_KEY`
- `NAVER_MAPS_CLIENT_ID`
- `ADMIN_ID`, `ADMIN_PW`

### Client-only (Pusher Key는 공개 가능)
- `NEXT_PUBLIC_PUSHER_KEY`, `NEXT_PUBLIC_PUSHER_CLUSTER`

## ⚠️ 개발 가이드 및 규칙
1. **보안**: 클라이언트에서 `firebase` 패키지를 사용하지 마십시오. 모든 DB 데이터는 `/api/db/[path]`를 통해 접근합니다.
2. **실시간**: 데이터 변경 시 서버 API에서 Pusher 이벤트를 트리거합니다. 클라이언트는 `Pusher` 객체를 통해 `db-updated` 채널을 구독하십시오.
3. **Naver Maps**: 클라이언트 키를 직접 쓰지 말고, `/api/naverConfig`에서 받아온 키를 사용하여 동적 로드하십시오.
