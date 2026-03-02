# 카카오 계정 연동 구조

## 사용 방식

카카오 OAuth 2.0 Authorization Code Flow를 사용합니다.
Firebase Auth는 사용하지 않으며, 카카오 SDK + localStorage 기반으로 세션을 관리합니다.

---

## 로그인 흐름

```
1. 사용자 → "카카오로 시작하기" 클릭
   └─ login() 실행
      └─ https://kauth.kakao.com/oauth/authorize?client_id=...&redirect_uri=...&response_type=code
         로 리다이렉트

2. 카카오 인증 완료 후
   └─ ?code=xxx 쿼리파라미터와 함께 앱으로 리다이렉트

3. AuthContext useEffect에서 URL의 code 감지
   └─ /api/kakaoAuth (Vercel Serverless Function) 호출
      └─ 서버에서 KAKAO_REST_API_KEY로 액세스 토큰 발급
         POST https://kauth.kakao.com/oauth/token

4. 발급된 액세스 토큰으로 사용자 정보 조회
   └─ GET https://kapi.kakao.com/v2/user/me
      └─ 추출 정보:
         - uid: "kakao_{카카오ID}"
         - nickname: kakao_account.profile.nickname
         - profileImage: kakao_account.profile.profile_image_url

5. 유저 정보 저장
   └─ React state (setUser)
   └─ localStorage("kakao_user")
```

---

## 세션 유지

- 페이지 새로고침 / 재방문 시 `localStorage("kakao_user")`에서 유저 정보 복원
- 카카오 서버 재요청 없음 (액세스 토큰은 저장하지 않음)
- 시크릿 모드 / 다른 기기에서는 자동 로그인 불가

---

## 로그아웃

- React state 초기화 + `localStorage("kakao_user")` 삭제
- 카카오 서버 측 토큰 무효화는 수행하지 않음 (카카오 세션 유지됨)

---

## 관련 파일

| 파일 | 역할 |
|------|------|
| `src/contexts/AuthContext.jsx` | SDK 초기화, 로그인/로그아웃, localStorage 관리 |
| `api/kakaoAuth.js` | Vercel Serverless — 인가 코드 → 액세스 토큰 교환 |

---

## 환경변수

| 변수명 | 위치 | 용도 |
|--------|------|------|
| `KAKAO_REST_API_KEY` | Vercel 환경변수 (서버 전용) | 액세스 토큰 발급, 음식점 검색 API |
| `VITE_KAKAO_JS_KEY` | `.env` (프론트) | 카카오 SDK init (현재 미사용 상태) |
| `VITE_KAKAO_REST_API_KEY` | `.env` (프론트) | 로그인 인가 요청 시 client_id |

---

## Firebase 연계

카카오 UID를 Firebase 데이터 키로 사용합니다.

```
rooms/{roomId}
├── createdByUid: "kakao_{id}"   # 방장 판별
└── votes/
    └── kakao_{id}/              # 중복 투표 방지 (1인 1투표)
        ├── nickname
        └── menuIds: []
```

---

## 보안 구조

- `KAKAO_REST_API_KEY`는 서버(Vercel)에서만 사용 — 클라이언트에 노출되지 않음
- 액세스 토큰은 서버에서 발급 후 프론트로 전달하지 않음
- 브라우저에는 uid / nickname / profileImage만 저장

---

## 주의사항

- localStorage 기반이므로 브라우저 캐시 초기화 시 세션 소멸
- 로그아웃 시 카카오 측 토큰은 만료되지 않음 (카카오 계정 연결 해제 미구현)
- 닉네임/프로필 이미지는 로그인 시점의 스냅샷 — 카카오 프로필 변경이 자동 반영되지 않음
