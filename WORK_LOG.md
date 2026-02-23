# 점심 메뉴 투표 앱 - 작업 로그

## 프로젝트 개요
- **앱 이름**: 오늘 뭐 먹지? - 점심 메뉴 투표
- **기술 스택**: React 19 + Vite 7 + Firebase Realtime DB + Naver Maps API
- **경로**: `C:\Users\jung\lunch-picker`

---

## 개발 서버 실행/중지

### 실행
```bash
cd C:\Users\jung\lunch-picker
npx vite --host
```
- 로컬: http://localhost:5173/
- 네트워크(모바일 테스트): http://<내부IP>:5173/

### 중지
- 터미널에서 `Ctrl + C`

### 빌드 (배포용)
```bash
npx vite build
```
- 결과물: `dist/` 폴더

---

## 작업 내역: 음식점 검색 방식 변경

### 변경 배경
- **기존**: 방 입장 시 자동으로 주변 음식점 검색 (Nominatim + 네이버 검색 → 깨진 상태)
- **변경**: 사용자가 직접 검색어 입력 → 검색 결과에서 골라서 추가하는 방식

### 변경 파일 (5개)

#### 1. `src/utils/naverSearch.js` - 전면 재작성
- Nominatim (OpenStreetMap) 제거
- `reverseGeocodeNaver(lat, lng)` — 네이버 Maps SDK로 좌표 → "유성구 봉명동" 변환
- `searchRestaurants(query, areaName)` — 사용자 검색어 + 동네이름 조합하여 검색, 최대 5개 반환

#### 2. `src/components/RestaurantSearch.jsx` - 신규 생성
- 검색바 (input + 검색 버튼, Enter 키 지원)
- 검색 결과 최대 5개 표시 (이름, 카테고리, 주소)
- 각 결과에 "추가" 버튼 → 투표 리스트에 등록
- 이미 추가된 항목은 "추가됨" 비활성화 표시

#### 3. `src/pages/Room.jsx` - 수정
- **제거**: `searchNearbyRestaurants` import, `searchLoading`, `searchDone`, `loadNearbyRestaurants`, 자동 검색 useEffect
- **추가**: `areaName` state, `handleMapReady` (지도 로드 시 역지오코딩), `handleAddRestaurant` (검색 결과 → Firebase 저장), `addedNames` Set (중복 방지)
- `RestaurantSearch` 컴포넌트를 지도와 메뉴 리스트 사이에 배치

#### 4. `src/components/MenuList.jsx` - 소수정
- `source: 'search'` 뱃지 추가 (`🔍 검색 추가`)

#### 5. `src/App.css` - CSS 추가
- `.restaurant-search`, `.search-bar`, `.search-results`, `.search-result-item`, `.search-add-btn` 등 스타일

### UI 흐름
```
[지도] — 로드 시 역지오코딩으로 동네 이름 자동 감지
[검색바: "파스타" 입력 → 검색]
[검색 결과 5개 — 각각 "추가" 버튼]
  └ 클릭 → Firebase 저장 → 모든 참가자에게 실시간 반영
[투표 메뉴 목록]
[직접 메뉴 추가 입력]
[투표 마감 버튼 (방장)]
```

### 검색 동작 흐름
1. 지도 SDK 로드 완료 → `onReady` → `reverseGeocodeNaver()` → "유성구 봉명동" 저장
2. 사용자가 "파스타" 입력 → 실제 쿼리: `"유성구 봉명동 파스타"`
3. `/api/searchRestaurants` → 네이버 지역검색 API → 최대 5개 결과 반환
4. "추가" 클릭 → Firebase `rooms/{roomId}/menus`에 저장 → 실시간 반영

---

## 환경 변수 (.env)
```
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_DATABASE_URL=...
VITE_FIREBASE_PROJECT_ID=...
VITE_NAVER_MAPS_CLIENT_ID=...
VITE_FIREBASE_FUNCTIONS_URL=...
```

## 프로젝트 구조
```
lunch-picker/
├── index.html
├── package.json
├── vite.config.js
├── .env
└── src/
    ├── main.jsx
    ├── App.jsx
    ├── App.css
    ├── index.css
    ├── firebase.js
    ├── pages/
    │   ├── Home.jsx
    │   ├── Room.jsx          ← 수정됨
    │   └── Result.jsx
    ├── components/
    │   ├── MenuList.jsx       ← 소수정
    │   ├── AddMenu.jsx
    │   ├── NaverMap.jsx
    │   ├── RestaurantSearch.jsx  ← 신규
    │   └── Roulette.jsx
    └── utils/
        ├── naverSearch.js     ← 전면 재작성
        └── room.js
```
