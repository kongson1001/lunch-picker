# 오늘 뭐 먹지? - 점심 메뉴 투표 앱

## 프로젝트 개요
팀 점심 메뉴를 실시간 투표로 정하는 웹앱. 방을 만들고 코드를 공유하면 팀원들이 메뉴를 추가하고 투표할 수 있다.

## 기술 스택
- **프론트엔드**: React 19 + Vite 7
- **라우팅**: React Router DOM 7
- **데이터베이스**: Firebase Realtime Database
- **인증**: 카카오 OAuth 2.0 (JS SDK 2.7.4)
- **지도/검색**: Naver Maps SDK + Kakao Local Search API
- **배포**: Vercel (프론트 + Serverless Functions) / Firebase Hosting

## 디렉토리 구조
```
src/
├── main.jsx                  # React 엔트리
├── App.jsx                   # AuthProvider + BrowserRouter + Routes
├── App.css                   # 전체 스타일
├── index.css                 # 기본 스타일 (body, font 등)
├── firebase.js               # Firebase 초기화 및 export
├── contexts/
│   └── AuthContext.jsx        # 카카오 로그인 상태 관리
├── pages/
│   ├── Home.jsx               # 로그인, 방 만들기/참가
│   ├── Room.jsx               # 투표 + 검색 (2컬럼)
│   └── Result.jsx             # 결과 + 동률 룰렛
├── components/
│   ├── MenuList.jsx           # 메뉴 목록 + 투표 버튼
│   ├── AddMenu.jsx            # 메뉴 추가 폼
│   ├── RestaurantSearch.jsx   # 카카오 음식점 검색
│   ├── NaverMap.jsx           # 네이버 지도
│   └── Roulette.jsx           # 동률 룰렛 애니메이션
└── utils/
    ├── room.js                # Firebase 방 CRUD
    └── naverSearch.js         # 역지오코딩 + 검색 API 호출
api/
└── searchRestaurants.js       # Vercel Serverless - 카카오 검색 프록시
```

## 라우트
| 경로 | 페이지 | 설명 |
|------|--------|------|
| `/` | Home | 로그인, 방 생성/참가, 방 목록 |
| `/room/:roomId` | Room | 메뉴 투표 + 음식점 검색 |
| `/room/:roomId/result` | Result | 투표 결과 + 동률 룰렛 |

## 환경변수

### 프론트엔드 (.env)
```
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_DATABASE_URL=
VITE_FIREBASE_PROJECT_ID=
VITE_NAVER_MAPS_CLIENT_ID=
VITE_KAKAO_JS_KEY=             # 카카오 JavaScript 키 (로그인용)
```

### 백엔드 (Vercel 환경변수)
```
KAKAO_REST_API_KEY=            # 카카오 REST API 키 (검색용)
```

## Firebase 데이터 구조
```
rooms/{roomId}
├── createdAt: number          # 생성 시각 (Date.now())
├── createdBy: string          # 방장 닉네임 (표시용)
├── createdByUid: string       # 방장 카카오 UID (권한 판별용)
├── roomName: string           # 방 이름
├── status: "voting" | "closed"
├── location: { lat, lng }     # 방 생성 시 위치
├── menus/
│   └── {pushId}: { name, address?, source, addedBy }
├── votes/
│   └── {kakao_uid}: { nickname, menuIds: [] }
└── result: { winnerId, winnerName, topMenus, counts, isTie }
```

## 인증 흐름 (카카오 로그인)
1. `index.html`에서 카카오 SDK CDN 로드
2. `AuthContext`에서 `Kakao.init(VITE_KAKAO_JS_KEY)` 호출
3. 로그인: `Kakao.Auth.login()` → `/v2/user/me` → `{ uid: "kakao_{id}", nickname, profileImage }`
4. `localStorage('kakao_user')`에 캐시 → 새로고침 시 복원
5. 투표 키: `votes/{uid}` (중복 투표 차단)
6. 방장 판별: `room.createdByUid === user.uid` (영구 유지)

## 주요 패턴

### 실시간 구독
```javascript
// Firebase onValue → useEffect cleanup
useEffect(() => {
  const unsubscribe = onValue(ref(db, `rooms/${roomId}`), (snapshot) => { ... });
  return () => unsubscribe();
}, [roomId]);
```

### 방 ID 생성
- 6자리 영숫자: `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` (혼동 문자 I,O,1,0 제외)

### API 프록시
- 클라이언트 → `/api/searchRestaurants` (Vercel) → Kakao Local Search API
- KAKAO_REST_API_KEY는 서버에서만 사용 (클라이언트 노출 방지)

## 스타일 컨벤션
- **주 색상**: `#e85d26` (오렌지), `#ff7b54` (밝은 오렌지)
- **배경**: `#fffaf7`, `#fff5f0`
- **카카오 버튼**: `#FEE500`
- **반응형 브레이크포인트**: 700px (2컬럼 → 1컬럼)
- **CSS 클래스 네이밍**: kebab-case (`.room-header`, `.menu-item`)
- **컴포넌트 네이밍**: PascalCase (`MenuList`, `AddMenu`)

## 빌드 & 배포
```bash
npm run dev      # 로컬 개발 서버 (Vite HMR)
npm run build    # 프로덕션 빌드 → dist/
npm run preview  # 빌드 결과 로컬 확인
```

## 코딩 규칙
- 한국어 UI 텍스트, 주석도 한국어 사용
- Firebase Auth 미사용 (카카오 SDK + localStorage 방식)
- 컴포넌트는 `export default function` 스타일
- 상태 관리: React Context (전역) + useState (로컬) + Firebase (서버)
- import 순서: React/라이브러리 → 로컬 모듈 → CSS
