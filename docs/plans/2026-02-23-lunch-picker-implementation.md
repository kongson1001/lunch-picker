# "오늘 뭐 먹지?" 점심 메뉴 투표 사이트 구현 계획

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 팀/부서에서 점심 메뉴를 투표로 정하는 실시간 웹 사이트를 만든다. 주변 음식점 자동 로드, 메뉴 추가, 다중 투표, 동률 시 무작위 추첨 기능을 포함한다.

**Architecture:** React + Vite 프론트엔드, Firebase Realtime Database로 실시간 동기화, 네이버 지역검색 API는 CORS 제한으로 Firebase Cloud Functions를 프록시로 사용. 네이버 클라우드 Maps JavaScript SDK로 지도 표시.

**Tech Stack:** React 18, Vite, Firebase (Realtime DB + Cloud Functions), Naver Cloud Maps JS SDK, Naver Open API (지역검색)

---

### Task 1: 프로젝트 초기 설정 (Vite + React)

**Files:**
- Create: `package.json`, `vite.config.js`, `index.html`, `src/main.jsx`, `src/App.jsx`, `src/App.css`, `src/index.css`
- Create: `.env.example`, `.gitignore`

**Step 1: Vite + React 프로젝트 생성**

```bash
cd C:/Users/jung/lunch-picker
npm create vite@latest . -- --template react
```

주의: 이미 docs 폴더가 있으므로 기존 파일 유지하면서 설치

**Step 2: 의존성 설치**

```bash
npm install
npm install firebase react-router-dom
```

**Step 3: 환경 변수 파일 생성**

`.env.example` 파일 생성:
```
VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_DATABASE_URL=https://your_project-default-rtdb.firebaseio.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_NAVER_MAPS_CLIENT_ID=your_naver_maps_client_id
```

`.gitignore`에 `.env` 추가 확인

**Step 4: 개발 서버 실행 확인**

```bash
npm run dev
```

Expected: `http://localhost:5173`에서 Vite + React 기본 페이지 표시

**Step 5: 커밋**

```bash
git add -A
git commit -m "chore: initialize Vite + React project with Firebase dependency"
```

---

### Task 2: Firebase 설정 및 유틸리티

**Files:**
- Create: `src/firebase.js`

**Step 1: Firebase 초기화 모듈 작성**

```jsx
// src/firebase.js
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, set, push, get, onValue, update, remove } from 'firebase/database';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

export { db, ref, set, push, get, onValue, update, remove };
```

**Step 2: 동작 확인**

개발 서버에서 콘솔 에러 없이 로드되는지 확인

**Step 3: 커밋**

```bash
git add src/firebase.js
git commit -m "feat: add Firebase initialization module"
```

---

### Task 3: 라우팅 및 페이지 구조

**Files:**
- Modify: `src/App.jsx`
- Create: `src/pages/Home.jsx`
- Create: `src/pages/Room.jsx`
- Create: `src/pages/Result.jsx`

**Step 1: 라우터 설정**

```jsx
// src/App.jsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import Room from './pages/Room';
import Result from './pages/Result';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/room/:roomId" element={<Room />} />
        <Route path="/room/:roomId/result" element={<Result />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
```

**Step 2: 빈 페이지 컴포넌트 생성**

```jsx
// src/pages/Home.jsx
export default function Home() {
  return <div>Home</div>;
}

// src/pages/Room.jsx
export default function Room() {
  return <div>Room</div>;
}

// src/pages/Result.jsx
export default function Result() {
  return <div>Result</div>;
}
```

**Step 3: 라우팅 동작 확인**

브라우저에서 `/`, `/room/test`, `/room/test/result` 경로로 접근하여 각 페이지가 표시되는지 확인

**Step 4: 커밋**

```bash
git add src/App.jsx src/pages/
git commit -m "feat: add routing structure with Home, Room, Result pages"
```

---

### Task 4: Home 페이지 - 방 생성 & 참가

**Files:**
- Modify: `src/pages/Home.jsx`
- Create: `src/utils/room.js`

**Step 1: 방 생성/참가 유틸리티 작성**

```jsx
// src/utils/room.js
import { db, ref, set, push, get } from '../firebase';

export function generateRoomId() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export async function createRoom(nickname, location) {
  const roomId = generateRoomId();
  const roomRef = ref(db, `rooms/${roomId}`);
  await set(roomRef, {
    createdAt: Date.now(),
    createdBy: nickname,
    status: 'voting',
    location: location,
    menus: {},
    votes: {},
    result: null,
  });
  return roomId;
}

export async function roomExists(roomId) {
  const roomRef = ref(db, `rooms/${roomId}`);
  const snapshot = await get(roomRef);
  return snapshot.exists();
}
```

**Step 2: Home 페이지 UI 구현**

```jsx
// src/pages/Home.jsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createRoom, roomExists } from '../utils/room';

export default function Home() {
  const [nickname, setNickname] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleCreate = async () => {
    if (!nickname.trim()) {
      setError('닉네임을 입력해주세요');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
        });
      });
      const location = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
      };
      const roomId = await createRoom(nickname, location);
      sessionStorage.setItem('nickname', nickname);
      sessionStorage.setItem('isHost', 'true');
      navigate(`/room/${roomId}`);
    } catch (err) {
      setError('위치 정보를 가져올 수 없습니다. 위치 권한을 허용해주세요.');
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async () => {
    if (!nickname.trim()) {
      setError('닉네임을 입력해주세요');
      return;
    }
    if (!joinCode.trim()) {
      setError('방 코드를 입력해주세요');
      return;
    }
    const code = joinCode.trim().toUpperCase();
    const exists = await roomExists(code);
    if (!exists) {
      setError('존재하지 않는 방입니다');
      return;
    }
    sessionStorage.setItem('nickname', nickname);
    sessionStorage.setItem('isHost', 'false');
    navigate(`/room/${code}`);
  };

  return (
    <div className="home-container">
      <h1>🍽️ 오늘 뭐 먹지?</h1>
      <p>팀 점심 메뉴를 투표로 정해보세요</p>

      <div className="input-group">
        <input
          type="text"
          placeholder="닉네임 입력"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          maxLength={10}
        />
      </div>

      {error && <p className="error">{error}</p>}

      <div className="action-group">
        <button onClick={handleCreate} disabled={loading}>
          {loading ? '방 만드는 중...' : '🆕 새 방 만들기'}
        </button>
      </div>

      <div className="divider">또는</div>

      <div className="join-group">
        <input
          type="text"
          placeholder="방 코드 입력 (예: ABC123)"
          value={joinCode}
          onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
          maxLength={6}
        />
        <button onClick={handleJoin}>참가하기</button>
      </div>
    </div>
  );
}
```

**Step 3: 동작 확인**

닉네임 입력 + "새 방 만들기" 클릭 → 위치 권한 팝업 → 방 생성 후 `/room/{roomId}`로 이동

**Step 4: 커밋**

```bash
git add src/pages/Home.jsx src/utils/room.js
git commit -m "feat: implement Home page with room creation and join"
```

---

### Task 5: 네이버 지역검색 프록시 (Firebase Cloud Functions)

**Files:**
- Create: `functions/package.json`
- Create: `functions/index.js`
- Create: `firebase.json`

네이버 지역검색 API는 서버 사이드 전용(CORS 차단)이므로 Firebase Cloud Functions를 프록시로 사용한다.

**Step 1: Firebase Functions 프로젝트 초기화**

```bash
cd C:/Users/jung/lunch-picker
npm install -g firebase-tools
firebase init functions
```

functions 디렉토리가 생성됨. Node.js 18 선택.

**Step 2: 프록시 함수 작성**

```javascript
// functions/index.js
const { onRequest } = require('firebase-functions/v2/https');
const { defineString } = require('firebase-functions/params');

const naverClientId = defineString('NAVER_CLIENT_ID');
const naverClientSecret = defineString('NAVER_CLIENT_SECRET');

exports.searchRestaurants = onRequest({ cors: true }, async (req, res) => {
  const { query } = req.query;

  if (!query) {
    res.status(400).json({ error: 'query parameter is required' });
    return;
  }

  const url = `https://openapi.naver.com/v1/search/local.json?query=${encodeURIComponent(query)}&display=5&start=1&sort=comment`;

  const response = await fetch(url, {
    headers: {
      'X-Naver-Client-Id': naverClientId.value(),
      'X-Naver-Client-Secret': naverClientSecret.value(),
    },
  });

  const data = await response.json();
  res.json(data);
});
```

**Step 3: 네이버 API 키를 Firebase 환경에 설정**

```bash
firebase functions:secrets:set NAVER_CLIENT_ID
firebase functions:secrets:set NAVER_CLIENT_SECRET
```

**Step 4: 로컬 테스트**

```bash
cd functions && npm install && cd ..
firebase emulators:start --only functions
```

`http://localhost:5001/{project}/us-central1/searchRestaurants?query=강남+맛집` 호출하여 JSON 응답 확인

**Step 5: 배포**

```bash
firebase deploy --only functions
```

**Step 6: 커밋**

```bash
git add functions/ firebase.json .firebaserc
git commit -m "feat: add Firebase Cloud Function proxy for Naver local search API"
```

---

### Task 6: Room 페이지 - 주변 음식점 로드 및 메뉴 리스트

**Files:**
- Modify: `src/pages/Room.jsx`
- Create: `src/utils/naverSearch.js`
- Create: `src/components/MenuList.jsx`
- Create: `src/components/AddMenu.jsx`

**Step 1: 네이버 검색 유틸리티 작성**

```jsx
// src/utils/naverSearch.js
const FUNCTIONS_BASE_URL = import.meta.env.VITE_FIREBASE_FUNCTIONS_URL || '';

export async function searchNearbyRestaurants(lat, lng) {
  // Reverse geocode로 동네 이름을 얻거나, 좌표 주변 검색어 사용
  // 네이버 지역검색은 텍스트 기반이므로 "주변 맛집" 같은 키워드로 검색
  // display=5 제한이 있으므로 여러 카테고리로 검색하여 합산
  const categories = ['맛집', '음식점', '식당', '점심'];
  const allResults = [];
  const seen = new Set();

  for (const category of categories) {
    try {
      const response = await fetch(
        `${FUNCTIONS_BASE_URL}/searchRestaurants?query=${encodeURIComponent(category)}`
      );
      const data = await response.json();
      if (data.items) {
        for (const item of data.items) {
          // 중복 제거 (이름 기준)
          const cleanName = item.title.replace(/<[^>]*>/g, '');
          if (!seen.has(cleanName)) {
            seen.add(cleanName);
            allResults.push({
              name: cleanName,
              category: item.category,
              address: item.roadAddress || item.address,
              mapx: item.mapx,
              mapy: item.mapy,
              source: 'naver',
            });
          }
        }
      }
    } catch (err) {
      console.error(`검색 실패: ${category}`, err);
    }
  }

  return allResults;
}
```

**Step 2: MenuList 컴포넌트 작성**

```jsx
// src/components/MenuList.jsx
export default function MenuList({ menus, votes, myVotes, onVote, status }) {
  const getVoteCount = (menuId) => {
    let count = 0;
    if (votes) {
      Object.values(votes).forEach((vote) => {
        if (vote.menuIds && vote.menuIds.includes(menuId)) {
          count++;
        }
      });
    }
    return count;
  };

  return (
    <div className="menu-list">
      {Object.entries(menus || {}).map(([menuId, menu]) => {
        const voteCount = getVoteCount(menuId);
        const isVoted = myVotes.includes(menuId);

        return (
          <div key={menuId} className={`menu-item ${isVoted ? 'voted' : ''}`}>
            <div className="menu-info">
              <h3>{menu.name}</h3>
              {menu.address && <p className="address">{menu.address}</p>}
              <span className="source-badge">
                {menu.source === 'naver' ? '📍 주변 음식점' : '✏️ 직접 추가'}
              </span>
            </div>
            <div className="menu-vote">
              <span className="vote-count">{voteCount}표</span>
              {status === 'voting' && (
                <button
                  className={`vote-btn ${isVoted ? 'voted' : ''}`}
                  onClick={() => onVote(menuId)}
                >
                  {isVoted ? '취소' : '투표'}
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
```

**Step 3: AddMenu 컴포넌트 작성**

```jsx
// src/components/AddMenu.jsx
import { useState } from 'react';

export default function AddMenu({ onAdd }) {
  const [menuName, setMenuName] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!menuName.trim()) return;
    onAdd(menuName.trim());
    setMenuName('');
  };

  return (
    <form className="add-menu" onSubmit={handleSubmit}>
      <input
        type="text"
        placeholder="먹고 싶은 메뉴를 추가하세요"
        value={menuName}
        onChange={(e) => setMenuName(e.target.value)}
        maxLength={30}
      />
      <button type="submit">+ 추가</button>
    </form>
  );
}
```

**Step 4: Room 페이지 통합**

```jsx
// src/pages/Room.jsx
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db, ref, onValue, push, set, update } from '../firebase';
import { searchNearbyRestaurants } from '../utils/naverSearch';
import MenuList from '../components/MenuList';
import AddMenu from '../components/AddMenu';

export default function Room() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const nickname = sessionStorage.getItem('nickname') || '익명';
  const isHost = sessionStorage.getItem('isHost') === 'true';

  const [room, setRoom] = useState(null);
  const [myVotes, setMyVotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchLoading, setSearchLoading] = useState(false);

  // 실시간 방 데이터 구독
  useEffect(() => {
    const roomRef = ref(db, `rooms/${roomId}`);
    const unsubscribe = onValue(roomRef, (snapshot) => {
      const data = snapshot.val();
      if (!data) {
        navigate('/');
        return;
      }
      setRoom(data);
      setLoading(false);

      // 투표 마감되면 결과 페이지로 이동
      if (data.status === 'closed' && data.result) {
        navigate(`/room/${roomId}/result`);
      }
    });
    return () => unsubscribe();
  }, [roomId, navigate]);

  // 내 투표 상태 로드
  useEffect(() => {
    if (room?.votes?.[nickname]) {
      setMyVotes(room.votes[nickname].menuIds || []);
    }
  }, [room, nickname]);

  // 방장이면 주변 음식점 자동 검색
  useEffect(() => {
    if (!isHost || !room?.location || room.menus) return;
    loadNearbyRestaurants();
  }, [isHost, room?.location]);

  const loadNearbyRestaurants = async () => {
    setSearchLoading(true);
    try {
      const restaurants = await searchNearbyRestaurants(
        room.location.lat,
        room.location.lng
      );
      const menusRef = ref(db, `rooms/${roomId}/menus`);
      for (const restaurant of restaurants) {
        const newMenuRef = push(menusRef);
        await set(newMenuRef, {
          name: restaurant.name,
          address: restaurant.address,
          source: 'naver',
          addedBy: 'system',
        });
      }
    } catch (err) {
      console.error('주변 음식점 검색 실패:', err);
    } finally {
      setSearchLoading(false);
    }
  };

  const handleAddMenu = async (menuName) => {
    const menusRef = ref(db, `rooms/${roomId}/menus`);
    const newMenuRef = push(menusRef);
    await set(newMenuRef, {
      name: menuName,
      source: 'custom',
      addedBy: nickname,
    });
  };

  const handleVote = async (menuId) => {
    const newVotes = myVotes.includes(menuId)
      ? myVotes.filter((id) => id !== menuId)
      : [...myVotes, menuId];
    setMyVotes(newVotes);

    const voteRef = ref(db, `rooms/${roomId}/votes/${nickname}`);
    await set(voteRef, { nickname, menuIds: newVotes });
  };

  const handleClose = async () => {
    // 투표 집계
    const menus = room.menus || {};
    const votes = room.votes || {};
    const counts = {};

    Object.keys(menus).forEach((menuId) => {
      counts[menuId] = 0;
    });

    Object.values(votes).forEach((vote) => {
      (vote.menuIds || []).forEach((menuId) => {
        if (counts[menuId] !== undefined) counts[menuId]++;
      });
    });

    const maxCount = Math.max(...Object.values(counts));
    const topMenus = Object.keys(counts).filter(
      (id) => counts[id] === maxCount
    );

    // 동률이면 무작위, 아니면 최다 득표
    const winnerId = topMenus[Math.floor(Math.random() * topMenus.length)];

    await update(ref(db, `rooms/${roomId}`), {
      status: 'closed',
      result: {
        winnerId,
        winnerName: menus[winnerId].name,
        topMenus,
        counts,
        isTie: topMenus.length > 1,
      },
    });
  };

  const copyRoomCode = () => {
    navigator.clipboard.writeText(window.location.href);
    alert('링크가 복사되었습니다!');
  };

  if (loading) return <div className="loading">방 정보 로딩 중...</div>;

  return (
    <div className="room-container">
      <header className="room-header">
        <h1>🍽️ 오늘 뭐 먹지?</h1>
        <div className="room-code">
          <span>방 코드: <strong>{roomId}</strong></span>
          <button onClick={copyRoomCode}>📋 링크 복사</button>
        </div>
        <p>참가자: {nickname} {isHost && '(방장)'}</p>
      </header>

      {searchLoading && <p className="loading">주변 음식점 검색 중...</p>}

      <MenuList
        menus={room.menus}
        votes={room.votes}
        myVotes={myVotes}
        onVote={handleVote}
        status={room.status}
      />

      {room.status === 'voting' && (
        <>
          <AddMenu onAdd={handleAddMenu} />
          {isHost && (
            <button className="close-btn" onClick={handleClose}>
              🏁 투표 마감하기
            </button>
          )}
        </>
      )}
    </div>
  );
}
```

**Step 5: 동작 확인**

방 생성 → 주변 음식점 로드 → 메뉴 추가 → 투표 클릭하여 투표 수 반영 확인

**Step 6: 커밋**

```bash
git add src/pages/Room.jsx src/utils/naverSearch.js src/components/
git commit -m "feat: implement Room page with menu list, voting, and nearby search"
```

---

### Task 7: Result 페이지 - 결과 & 추첨 애니메이션

**Files:**
- Modify: `src/pages/Result.jsx`
- Create: `src/components/Roulette.jsx`

**Step 1: 룰렛 추첨 컴포넌트 작성**

```jsx
// src/components/Roulette.jsx
import { useState, useEffect } from 'react';

export default function Roulette({ candidates, onFinish }) {
  const [current, setCurrent] = useState(0);
  const [spinning, setSpinning] = useState(true);

  useEffect(() => {
    if (!spinning) return;

    let interval = 50;
    let count = 0;
    const totalSpins = 20 + Math.floor(Math.random() * 10);

    const spin = () => {
      setCurrent((prev) => (prev + 1) % candidates.length);
      count++;

      if (count >= totalSpins) {
        setSpinning(false);
        onFinish();
        return;
      }

      // 점점 느려지는 효과
      interval = 50 + (count / totalSpins) * 300;
      setTimeout(spin, interval);
    };

    setTimeout(spin, interval);
  }, []);

  return (
    <div className="roulette">
      <div className="roulette-display">
        <h2 className={spinning ? 'spinning' : 'winner'}>
          {candidates[current]}
        </h2>
      </div>
      {!spinning && <p className="roulette-label">🎉 당첨!</p>}
    </div>
  );
}
```

**Step 2: Result 페이지 구현**

```jsx
// src/pages/Result.jsx
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db, ref, onValue } from '../firebase';
import Roulette from '../components/Roulette';

export default function Result() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const [room, setRoom] = useState(null);
  const [showRoulette, setShowRoulette] = useState(false);
  const [rouletteFinished, setRouletteFinished] = useState(false);

  useEffect(() => {
    const roomRef = ref(db, `rooms/${roomId}`);
    const unsubscribe = onValue(roomRef, (snapshot) => {
      const data = snapshot.val();
      if (!data || !data.result) {
        navigate(`/room/${roomId}`);
        return;
      }
      setRoom(data);

      // 동률이면 룰렛 표시
      if (data.result.isTie) {
        setShowRoulette(true);
      }
    });
    return () => unsubscribe();
  }, [roomId, navigate]);

  if (!room) return <div className="loading">결과 로딩 중...</div>;

  const { result, menus } = room;
  const { counts, topMenus, winnerId, winnerName, isTie } = result;

  // 투표 결과를 득표 수 내림차순으로 정렬
  const sortedMenus = Object.entries(counts)
    .sort(([, a], [, b]) => b - a)
    .map(([menuId, count]) => ({
      menuId,
      name: menus[menuId]?.name || '알 수 없음',
      count,
      isWinner: menuId === winnerId,
      isTied: topMenus.includes(menuId),
    }));

  const maxVotes = sortedMenus[0]?.count || 1;

  return (
    <div className="result-container">
      <h1>🍽️ 투표 결과</h1>

      {isTie && showRoulette && !rouletteFinished && (
        <div className="tie-section">
          <p>🎲 동률 발생! 무작위 추첨 중...</p>
          <Roulette
            candidates={topMenus.map((id) => menus[id]?.name || '알 수 없음')}
            onFinish={() => setRouletteFinished(true)}
          />
        </div>
      )}

      {(!isTie || rouletteFinished) && (
        <div className="winner-section">
          <h2>🏆 오늘의 점심</h2>
          <div className="winner-name">{winnerName}</div>
          {isTie && <p className="tie-note">동률 추첨으로 선정되었습니다</p>}
        </div>
      )}

      <div className="vote-chart">
        <h3>📊 전체 투표 결과</h3>
        {sortedMenus.map(({ menuId, name, count, isWinner }) => (
          <div key={menuId} className={`chart-bar ${isWinner ? 'winner' : ''}`}>
            <div className="bar-label">{name}</div>
            <div className="bar-track">
              <div
                className="bar-fill"
                style={{ width: `${(count / maxVotes) * 100}%` }}
              />
            </div>
            <div className="bar-count">{count}표</div>
          </div>
        ))}
      </div>

      <button className="home-btn" onClick={() => navigate('/')}>
        🏠 메인으로
      </button>
    </div>
  );
}
```

**Step 3: 동작 확인**

투표 마감 → 결과 페이지 이동 → 바 차트 표시 확인. 동률 시 룰렛 애니메이션 확인.

**Step 4: 커밋**

```bash
git add src/pages/Result.jsx src/components/Roulette.jsx
git commit -m "feat: implement Result page with vote chart and tie-breaking roulette"
```

---

### Task 8: CSS 스타일링

**Files:**
- Modify: `src/index.css`
- Modify: `src/App.css`

**Step 1: 전역 스타일 작성**

`src/index.css`에 리셋 및 기본 스타일 작성:
- 모바일 우선 반응형 (max-width: 480px 기본, 768px 태블릿)
- 한글 폰트: Pretendard 또는 system-ui
- 따뜻한 색상 테마 (오렌지/코랄 계열)

**Step 2: 컴포넌트별 스타일 작성**

`src/App.css`에 각 페이지/컴포넌트 스타일:
- `.home-container`: 중앙 정렬, 카드형 레이아웃
- `.room-container`: 메뉴 리스트, 투표 버튼
- `.menu-item`: 카드형, 투표 시 하이라이트
- `.vote-btn.voted`: 선택된 상태 스타일
- `.result-container`: 바 차트, 승자 강조
- `.roulette`: 추첨 애니메이션 (spinning 클래스)
- `.chart-bar`: 가로 바 차트
- `.winner`: 금색 강조

**Step 3: 반응형 확인**

모바일 뷰포트(375px)와 데스크탑에서 레이아웃 확인

**Step 4: 커밋**

```bash
git add src/index.css src/App.css
git commit -m "style: add responsive CSS for all pages and components"
```

---

### Task 9: 네이버 지도 표시 (선택적)

**Files:**
- Create: `src/components/NaverMap.jsx`
- Modify: `index.html` (네이버 Maps JS SDK 스크립트 추가)

**Step 1: index.html에 네이버 Maps SDK 추가**

```html
<script src="https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=YOUR_CLIENT_ID"></script>
```

`YOUR_CLIENT_ID`는 환경 변수에서 주입하거나 빌드 시 교체.

**Step 2: NaverMap 컴포넌트 작성**

```jsx
// src/components/NaverMap.jsx
import { useEffect, useRef } from 'react';

export default function NaverMap({ lat, lng, markers = [] }) {
  const mapRef = useRef(null);

  useEffect(() => {
    if (!window.naver || !mapRef.current) return;

    const map = new window.naver.maps.Map(mapRef.current, {
      center: new window.naver.maps.LatLng(lat, lng),
      zoom: 15,
    });

    // 현재 위치 마커
    new window.naver.maps.Marker({
      position: new window.naver.maps.LatLng(lat, lng),
      map,
      title: '현재 위치',
    });

    // 음식점 마커들
    markers.forEach((m) => {
      if (m.mapx && m.mapy) {
        new window.naver.maps.Marker({
          position: new window.naver.maps.LatLng(m.mapy, m.mapx),
          map,
          title: m.name,
        });
      }
    });
  }, [lat, lng, markers]);

  return <div ref={mapRef} style={{ width: '100%', height: '300px' }} />;
}
```

**Step 3: Room 페이지에 지도 삽입**

Room.jsx에서 NaverMap 컴포넌트를 room.location이 있을 때 표시

**Step 4: 커밋**

```bash
git add src/components/NaverMap.jsx index.html
git commit -m "feat: add Naver Map display with restaurant markers"
```

---

### Task 10: 최종 통합 테스트 및 배포 설정

**Files:**
- Modify: `vite.config.js` (빌드 설정)
- Create: `vercel.json` 또는 `netlify.toml` (SPA 라우팅 설정)

**Step 1: 빌드 테스트**

```bash
npm run build
npm run preview
```

모든 페이지가 정상 동작하는지 확인

**Step 2: SPA 라우팅 설정 (Vercel)**

```json
// vercel.json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

**Step 3: 전체 플로우 테스트**

1. 메인 페이지 → 닉네임 입력 → 방 생성
2. 주변 음식점 자동 로드 확인
3. 다른 브라우저/탭에서 방 코드로 참가
4. 메뉴 추가
5. 양쪽에서 투표 → 실시간 반영 확인
6. 투표 마감 → 결과 표시
7. 동률 시 룰렛 추첨 확인

**Step 4: 최종 커밋**

```bash
git add -A
git commit -m "chore: add build and deployment configuration"
```

---

## 요약

| Task | 내용 | 예상 파일 수 |
|------|------|------------|
| 1 | 프로젝트 초기 설정 | ~7 |
| 2 | Firebase 설정 | 1 |
| 3 | 라우팅 구조 | 4 |
| 4 | Home 페이지 | 2 |
| 5 | 네이버 검색 프록시 (Cloud Functions) | 3 |
| 6 | Room 페이지 + 메뉴 + 투표 | 4 |
| 7 | Result 페이지 + 추첨 | 2 |
| 8 | CSS 스타일링 | 2 |
| 9 | 네이버 지도 표시 | 2 |
| 10 | 통합 테스트 & 배포 | 2 |
