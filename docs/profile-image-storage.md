# 프로필 이미지 저장 구조 분석 및 개선 계획

## 현재 구조 (문제점)

### 저장 위치
- 이미지 변경 시 `FileReader.readAsDataURL()`로 **base64 문자열**로 변환
- `AuthContext.updateProfile()` → `localStorage('kakao_user')`에 base64 통째로 저장
- Firebase에는 저장되지 않음

### 다른 사람에게 보이는지 여부

| 위치 | 보임? | 이유 |
|------|-------|------|
| 홈 프로필 카드 | ❌ 안 보임 | localStorage에만 있어서 본인만 봄 |
| 채팅 아바타 | ⚠️ 새 메시지만 보임 | 변경 후 보낸 메시지에만 새 이미지 표시 |

### 추가 문제
- `room.js > sendMessage()`에서 `user.profileImage`를 Firebase에 저장
- 변경된 이미지가 base64라면 **수백KB짜리 문자열이 메시지마다 저장**됨
- Firebase Realtime Database 용량 낭비 심각

---

## Firebase Storage 활성화 확인

- 프로젝트 ID: `lunch-picker-9663a`
- 버킷 URL 두 가지 테스트:
  - `lunch-picker-9663a.appspot.com` → **404 Not Found**
  - `lunch-picker-9663a.firebasestorage.app` → **404 Not Found**
- **결론: Firebase Storage 미활성화 상태**

Firebase Console에서 활성화하려면:
1. Firebase Console → 프로젝트 선택
2. 왼쪽 메뉴 → Storage → 시작하기
3. 버킷 위치: `asia-northeast3 (서울)` 권장

---

## 대안 비교

| | Vercel Blob | Firebase Storage | Cloudinary |
|--|--|--|--|
| **무료 한도** | 500MB | 5GB | 25GB |
| **기존 설정 활용** | ✅ Vercel 이미 사용 중 | ❌ 활성화 필요 | ❌ 신규 가입 필요 |
| **구현 난이도** | 쉬움 | 쉬움 | 쉬움 |
| **이미지 최적화** | ❌ | ❌ | ✅ 자동 리사이즈 등 |
| **추가 환경변수** | 1개 | 1개 | 2개 |

---

## 개선 방향 (Cloudinary — 미구현, 추후 진행 예정)

### 업로드 방식
- **Unsigned Upload** 방식으로 서버 없이 프론트에서 직접 업로드 가능
- 별도 API 라우트 불필요

### 업로드 흐름
```
저장 버튼 클릭
  → Cloudinary에 직접 POST (unsigned preset 사용)
  → secure_url 반환
  → updateProfile(nickname, secure_url)
  → localStorage + Firebase 메시지에 URL로 저장
```

### 변경 파일 (예정)

| 파일 | 변경 내용 |
|------|----------|
| `Home.jsx` | 저장 시 Cloudinary 업로드 → URL 획득 후 updateProfile 호출 |
| `.env.local` | `VITE_CLOUDINARY_CLOUD_NAME`, `VITE_CLOUDINARY_UPLOAD_PRESET` 추가 |
| `AuthContext.jsx` | 변경 없음 (URL 저장 구조 그대로 사용) |

### Cloudinary 사전 설정 (1회)
1. [Cloudinary](https://cloudinary.com) 가입
2. 대시보드에서 **Cloud Name** 복사
3. Settings → Upload → **Add upload preset** → Signing mode: **Unsigned** 설정
4. Preset name 복사
5. `.env.local`에 두 값 추가

### 이미지 저장 경로
- `profileImages/{uid}` (유저당 1개 파일로 덮어쓰기, 누적 없음)
