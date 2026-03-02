# Mobile Layout Fix + Profile Edit Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 모바일에서 버튼 오버플로우를 수정하고, 닉네임과 프로필 사진을 앱 내에서 변경 가능하게 한다.

**Architecture:** CSS 미디어쿼리로 모바일 레이아웃을 수정하고, AuthContext에 updateProfile 함수를 추가해 localStorage에 저장. Home.jsx profile-card에 인라인 편집 UI 추가.

**Tech Stack:** React 19, CSS (App.css), localStorage, FileReader API

---

### Task 1: 모바일 버튼 오버플로우 CSS 수정

**Files:**
- Modify: `src/App.css`

**Step 1: 현재 오버플로우 발생 위치 확인**

아래 클래스들이 `flex` row에 `input + button` 구조라 좁은 화면에서 넘침:
- `.join-group` (참가하기)
- `.add-menu` (+ 추가)
- `.search-bar` (검색)
- `.chat-input-row` (전송)
- `.room-code` (링크복사 · 나가기 · 방삭제 버튼들)

**Step 2: App.css 기존 `@media (max-width: 700px)` 블록 확장**

기존:
```css
@media (max-width: 700px) {
  .room-body {
    flex-direction: column;
  }
}
```

아래로 교체:
```css
@media (max-width: 700px) {
  .room-body {
    flex-direction: column;
  }
}

@media (max-width: 480px) {
  /* room-code 헤더 버튼 줄바꿈 */
  .room-code {
    flex-wrap: wrap;
    justify-content: center;
    gap: 6px;
  }

  /* 참가하기 버튼 padding 축소 */
  .secondary-btn {
    padding: 14px 14px;
    font-size: 0.9rem;
  }

  /* 추가 버튼 */
  .add-menu button {
    padding: 12px 12px;
    font-size: 0.85rem;
  }

  /* 검색 버튼 */
  .search-bar button {
    padding: 12px 12px;
    font-size: 0.85rem;
  }

  /* 전송 버튼 */
  .chat-send-btn {
    padding: 12px 14px;
    font-size: 0.85rem;
  }

  /* 검색 결과 추가 버튼 */
  .search-add-btn {
    padding: 8px 10px;
    font-size: 0.8rem;
    margin-left: 6px;
  }
}
```

**Step 3: 브라우저 DevTools에서 확인**

- Chrome DevTools → 375px (iPhone SE) 너비로 설정
- Home 페이지: "참가하기" 버튼이 잘리지 않는지 확인
- Room 페이지: "추가", "검색", "전송" 버튼 확인
- room-code 영역: "링크 복사", "나가기" 버튼 확인

**Step 4: Commit**

```bash
git add src/App.css
git commit -m "fix: fix mobile button overflow with responsive padding"
```

---

### Task 2: AuthContext에 updateProfile 추가

**Files:**
- Modify: `src/contexts/AuthContext.jsx`

**Step 1: updateProfile 함수 추가**

`logout` 함수 아래에 추가:

```js
const updateProfile = (nickname, profileImage) => {
  const updated = { ...user, nickname, profileImage };
  setUser(updated);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
};
```

**Step 2: Context value에 updateProfile 노출**

기존:
```jsx
<AuthContext.Provider value={{ user, login, logout, loading }}>
```

변경:
```jsx
<AuthContext.Provider value={{ user, login, logout, loading, updateProfile }}>
```

**Step 3: Commit**

```bash
git add src/contexts/AuthContext.jsx
git commit -m "feat: add updateProfile to AuthContext"
```

---

### Task 3: Home.jsx에 프로필 편집 UI 추가

**Files:**
- Modify: `src/pages/Home.jsx`

**Step 1: useAuth에서 updateProfile import**

기존:
```js
const { user, login, logout, loading: authLoading } = useAuth();
```

변경:
```js
const { user, login, logout, loading: authLoading, updateProfile } = useAuth();
```

**Step 2: 편집 상태 추가 (기존 useState들 아래)**

```js
const [editing, setEditing] = useState(false);
const [editNickname, setEditNickname] = useState('');
const [editImage, setEditImage] = useState(null); // base64 or null
```

**Step 3: 이미지 선택 핸들러 추가**

```js
const handleImageChange = (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => setEditImage(ev.target.result);
  reader.readAsDataURL(file);
};
```

**Step 4: 편집 시작/저장/취소 핸들러 추가**

```js
const handleEditStart = () => {
  setEditNickname(user.nickname);
  setEditImage(user.profileImage || null);
  setEditing(true);
};

const handleEditSave = () => {
  const trimmed = editNickname.trim();
  if (!trimmed) return;
  updateProfile(trimmed, editImage);
  setEditing(false);
};

const handleEditCancel = () => {
  setEditing(false);
};
```

**Step 5: profile-card JSX 교체**

기존 profile-card 전체:
```jsx
<div className="profile-card">
  {user.profileImage && (
    <img src={user.profileImage} alt="" className="profile-image" />
  )}
  <span className="profile-name">{user.nickname}</span>
  <button className="logout-btn" onClick={logout}>로그아웃</button>
</div>
```

아래로 교체:
```jsx
<div className="profile-card">
  {editing ? (
    <>
      <label className="profile-image-label">
        {editImage
          ? <img src={editImage} alt="" className="profile-image" />
          : <div className="profile-image-placeholder">{editNickname[0] || '?'}</div>
        }
        <input
          type="file"
          accept="image/*"
          className="profile-image-input"
          onChange={handleImageChange}
        />
      </label>
      <input
        type="text"
        className="profile-edit-input"
        value={editNickname}
        onChange={(e) => setEditNickname(e.target.value)}
        maxLength={20}
        autoFocus
      />
      <button className="profile-save-btn" onClick={handleEditSave}>저장</button>
      <button className="logout-btn" onClick={handleEditCancel}>취소</button>
    </>
  ) : (
    <>
      {user.profileImage
        ? <img src={user.profileImage} alt="" className="profile-image" />
        : <div className="profile-image-placeholder">{user.nickname[0]}</div>
      }
      <span className="profile-name">{user.nickname}</span>
      <button className="profile-edit-btn" onClick={handleEditStart}>편집</button>
      <button className="logout-btn" onClick={logout}>로그아웃</button>
    </>
  )}
</div>
```

**Step 6: Commit**

```bash
git add src/pages/Home.jsx
git commit -m "feat: add inline profile editing UI"
```

---

### Task 4: 프로필 편집 CSS 추가

**Files:**
- Modify: `src/App.css`

**Step 1: App.css 하단에 추가**

```css
/* ===== Profile Edit ===== */
.profile-image-label {
  position: relative;
  cursor: pointer;
  flex-shrink: 0;
}

.profile-image-label:hover::after {
  content: '변경';
  position: absolute;
  inset: 0;
  background: rgba(0,0,0,0.45);
  color: white;
  font-size: 0.65rem;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
}

.profile-image-input {
  display: none;
}

.profile-image-placeholder {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: #f0e0d6;
  color: #e85d26;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.85rem;
  font-weight: 700;
  flex-shrink: 0;
}

.profile-edit-input {
  flex: 1;
  min-width: 0;
  padding: 6px 10px;
  border: 1.5px solid #e85d26;
  border-radius: 8px;
  font-size: 0.9rem;
  font-family: inherit;
  outline: none;
}

.profile-edit-btn {
  padding: 4px 12px;
  background: white;
  color: #e85d26;
  border: 1px solid #e85d26;
  border-radius: 6px;
  font-size: 0.8rem;
  font-family: inherit;
  cursor: pointer;
  transition: background 0.2s;
}

.profile-edit-btn:hover {
  background: #fff5f0;
}

.profile-save-btn {
  padding: 4px 12px;
  background: #e85d26;
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 0.8rem;
  font-family: inherit;
  cursor: pointer;
  transition: opacity 0.2s;
}

.profile-save-btn:hover {
  opacity: 0.85;
}
```

**Step 2: 브라우저에서 확인**

- 홈 화면에서 "편집" 버튼 클릭 → 편집 모드 진입 확인
- 닉네임 변경 후 저장 → 프로필카드에 반영, 새로고침 후에도 유지 확인
- 사진 파일 선택 → 미리보기 표시 확인
- 저장 후 채팅 등 다른 페이지에서 변경된 닉네임/사진 반영 확인
- "취소" 클릭 → 변경사항 되돌아옴 확인

**Step 3: Commit**

```bash
git add src/App.css
git commit -m "feat: add profile edit styles"
```

---

### Task 5: 최종 검증

**Step 1: 모바일 레이아웃 최종 확인**

DevTools에서 375px, 390px (iPhone 14), 412px (Android) 너비로:
- Home: 참가하기 버튼 오버플로우 없음
- Room: 추가/검색/전송 버튼 오버플로우 없음
- Room 헤더: 링크복사/나가기 줄바꿈 자연스러움

**Step 2: 프로필 편집 최종 확인**

- 편집 → 이름 변경 → 저장 → room 페이지 입장 시 새 닉네임으로 표시
- 편집 → 사진 선택 (JPG/PNG) → 저장 → 채팅 아바타에 반영

**Step 3: Final commit**

```bash
git add -A
git commit -m "feat: mobile layout fix and profile editing complete"
```
