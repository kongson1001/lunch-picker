# 미완료 작업 목록

## 프로필 이미지 개선 (Cloudinary 연동)

### 문제
- 프로필 이미지 변경 시 `localStorage`에만 저장 → 상대방에게 안 보임
- 채팅 메시지 전송 시 base64 이미지가 Firebase에 저장되어 용량 낭비 중

### 선택한 해결 방법
**Cloudinary Unsigned Upload** 방식

### 구현 전 준비사항
1. [Cloudinary](https://cloudinary.com) 가입
2. 대시보드에서 **Cloud Name** 확인
3. Settings → Upload → Add upload preset → Signing mode: **Unsigned** 설정
4. `.env.local`에 두 값 추가:
   ```
   VITE_CLOUDINARY_CLOUD_NAME=
   VITE_CLOUDINARY_UPLOAD_PRESET=
   ```

### 변경 파일
| 파일 | 변경 내용 |
|------|----------|
| `src/pages/Home.jsx` | 저장 버튼 클릭 시 Cloudinary 업로드 → URL 획득 후 `updateProfile` 호출 |
| `src/contexts/AuthContext.jsx` | 변경 없음 (URL 저장 구조 그대로 사용) |

### 상세 문서
`docs/profile-image-storage.md` 참고

---

## Firebase Storage
- 현재 **미활성화** 상태 (404 확인됨)
- Cloudinary로 대체 예정이므로 활성화 불필요
