import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { db, ref, onValue, push, set, update, remove } from '../firebase';
import { reverseGeocodeNaver } from '../utils/naverSearch';
import MenuList from '../components/MenuList';
import AddMenu from '../components/AddMenu';
import NaverMap from '../components/NaverMap';
import RestaurantSearch from '../components/RestaurantSearch';

export default function Room() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const nickname = user?.nickname || '익명';
  const uid = user?.uid || '';

  const [room, setRoom] = useState(null);
  const [myVotes, setMyVotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [areaName, setAreaName] = useState('');
  const [searchMarkers, setSearchMarkers] = useState([]);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [locating, setLocating] = useState(false);

  // 로그인 안 된 상태면 홈으로
  useEffect(() => {
    if (!user) {
      navigate('/');
    }
  }, [user, navigate]);

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

      if (data.status === 'closed' && data.result) {
        navigate(`/room/${roomId}/result`);
      }
    });
    return () => unsubscribe();
  }, [roomId, navigate]);

  // uid 기준으로 내 투표 복원
  useEffect(() => {
    if (room?.votes?.[uid]) {
      setMyVotes(room.votes[uid].menuIds || []);
    }
  }, [room, uid]);

  // 방장 판별: createdByUid 기준
  const computedIsHost = room?.createdByUid === uid;

  // room.location이 처음 로드될 때 currentLocation 초기화
  useEffect(() => {
    if (room?.location && !currentLocation) {
      setCurrentLocation(room.location);
    }
  }, [room?.location]);

  const handleMapReady = useCallback(async () => {
    if (!room?.location) return;
    const loc = currentLocation || room.location;
    const name = await reverseGeocodeNaver(loc.lat, loc.lng);
    setAreaName(name);
  }, [room?.location, currentLocation]);

  const handleUpdateLocation = () => {
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const loc = { lat: position.coords.latitude, lng: position.coords.longitude };
        setCurrentLocation(loc);
        const name = await reverseGeocodeNaver(loc.lat, loc.lng);
        setAreaName(name);
        setLocating(false);
      },
      () => {
        alert('위치 정보를 가져올 수 없습니다. 위치 권한을 확인해주세요.');
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleSearchResults = (results) => {
    setSearchMarkers(
      results
        .filter((r) => r.lat && r.lng)
        .map((r) => ({ name: r.name, lat: Number(r.lat), lng: Number(r.lng) }))
    );
  };

  const handleAddRestaurant = async (restaurant) => {
    const menusRef = ref(db, `rooms/${roomId}/menus`);
    const newMenuRef = push(menusRef);
    await set(newMenuRef, {
      name: restaurant.name,
      address: restaurant.address || '',
      source: 'search',
      addedBy: nickname,
    });
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

  const handleDeleteMenu = async (menuId) => {
    await remove(ref(db, `rooms/${roomId}/menus/${menuId}`));
  };

  // 투표 키: uid 기준 (1인 1투표)
  const handleVote = async (menuId) => {
    const newVotes = myVotes.includes(menuId)
      ? myVotes.filter((id) => id !== menuId)
      : [...myVotes, menuId];
    setMyVotes(newVotes);

    const voteRef = ref(db, `rooms/${roomId}/votes/${uid}`);
    await set(voteRef, { nickname, menuIds: newVotes });
  };

  const handleClose = async () => {
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

  const handleLeave = () => {
    navigate('/');
  };

  // 이미 추가된 메뉴 이름 Set (중복 추가 방지)
  const addedNames = new Set(
    Object.values(room?.menus || {}).map((m) => m.name)
  );

  if (loading) return <div className="loading">방 정보 로딩 중...</div>;

  return (
    <div className="room-container">
      <header className="room-header">
        <h1>{room.roomName || '오늘 뭐 먹지?'}</h1>
        <div className="room-code">
          <span>방 코드: <strong>{roomId}</strong></span>
          <button className="copy-btn" onClick={copyRoomCode}>링크 복사</button>
          <button className="leave-btn" onClick={handleLeave}>나가기</button>
        </div>
        <p className="participant">참가자: {nickname} {computedIsHost && '(방장)'}</p>
      </header>

      <div className="room-body">
        <section className="room-section">
          <h2 className="section-title">투표</h2>
          <MenuList
            menus={room.menus}
            votes={room.votes}
            myVotes={myVotes}
            onVote={handleVote}
            onDelete={handleDeleteMenu}
            status={room.status}
          />
          {room.status === 'voting' && (
            <>
              <AddMenu onAdd={handleAddMenu} />
              {computedIsHost && (
                <button className="close-btn" onClick={handleClose}>
                  투표 마감하기
                </button>
              )}
            </>
          )}
        </section>

        <section className="room-section">
          <h2 className="section-title">검색</h2>
          {currentLocation && (
            <>
              <NaverMap
                lat={currentLocation.lat}
                lng={currentLocation.lng}
                markers={searchMarkers}
                onReady={handleMapReady}
              />
              <button
                className="location-update-btn"
                onClick={handleUpdateLocation}
                disabled={locating}
              >
                {locating ? '위치 가져오는 중...' : '내 현재 위치로 갱신'}
              </button>
            </>
          )}
          {room.status === 'voting' && (
            <RestaurantSearch
              lat={currentLocation?.lat || room.location?.lat}
              lng={currentLocation?.lng || room.location?.lng}
              areaName={areaName}
              onAdd={handleAddRestaurant}
              onResults={handleSearchResults}
              addedNames={addedNames}
            />
          )}
        </section>
      </div>
    </div>
  );
}
