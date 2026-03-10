'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Pusher from 'pusher-js';
import { useAuth } from '../../contexts/AuthContext';
import { deleteRoom, hasOtherParticipants, checkRoomPassword } from '../../utils/room';
import { reverseGeocodeNaver } from '../../utils/naverSearch';
import MenuList from '../../components/MenuList';
import AddMenu from '../../components/AddMenu';
import NaverMap from '../../components/NaverMap';
import RestaurantSearch from '../../components/RestaurantSearch';
import Chat from '../../components/Chat';

export default function RoomPage() {
  const params = useParams();
  const roomId = params.roomId;
  const router = useRouter();
  const { user } = useAuth();

  const nickname = user?.nickname || '익명';
  const uid = user?.uid || '';

  const [room, setRoom] = useState(null);
  const [myVotes, setMyVotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [passwordChecked, setPasswordChecked] = useState(false);
  const [gateInput, setGateInput] = useState('');
  const [gateError, setGateError] = useState('');
  const [areaName, setAreaName] = useState('');
  const [searchMarkers, setSearchMarkers] = useState([]);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [locating, setLocating] = useState(false);
  const [participation, setParticipation] = useState('pending');
  const [participationReason, setParticipationReason] = useState('');

  const fetchRoomData = async () => {
    if (!roomId) return;
    try {
      const res = await fetch(`/api/db/rooms/${roomId}`);
      const data = await res.json();
      
      if (!data) {
        router.push('/');
        return;
      }
      
      setRoom(data);
      setLoading(false);

      if (data.participation?.[uid]) {
        setParticipation(data.participation[uid].status || 'pending');
        setParticipationReason(data.participation[uid].reason || '');
      }

      if (!passwordChecked) {
        const isHost = data.createdByUid === uid;
        const hasAuth = sessionStorage.getItem(`room_auth_${roomId}`);
        if (isHost || hasAuth || data.password === undefined) {
          setPasswordChecked(true);
        }
      }

      if (data.status === 'closed' && data.result) {
        router.push(`/room/${roomId}/result`);
      }
    } catch (err) {
      console.error('방 데이터 로딩 실패:', err);
    }
  };

  useEffect(() => {
    if (!user) { router.push('/'); return; }
    fetchRoomData();

    const pusher = new Pusher(process.env.NEXT_PUBLIC_PUSHER_KEY, {
      cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER,
    });
    const channel = pusher.subscribe('db-updated');
    channel.bind('update', (data) => {
      if (data.path === 'rooms' && data.id === roomId) {
        fetchRoomData();
      }
    });

    const interval = setInterval(fetchRoomData, 10000); // Pusher 보조용 10초 폴백
    return () => {
      pusher.unsubscribe('db-updated');
      clearInterval(interval);
    };
  }, [roomId, user]);

  useEffect(() => {
    if (room?.votes?.[uid]) {
      setMyVotes(room.votes[uid].menuIds || []);
    }
  }, [room, uid]);

  const computedIsHost = room?.createdByUid === uid || user?.isAdmin;

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
        alert('위치 정보를 가져올 수 없습니다.');
        setLocating(false);
      }
    );
  };

  const handleAddRestaurant = async (restaurant) => {
    await fetch(`/api/db/rooms/${roomId}/menus`, {
      method: 'POST',
      body: JSON.stringify({
        name: restaurant.name,
        address: restaurant.address || '',
        source: 'search',
        addedBy: nickname,
      })
    });
    fetchRoomData();
  };

  const handleAddMenu = async (menuName) => {
    await fetch(`/api/db/rooms/${roomId}/menus`, {
      method: 'POST',
      body: JSON.stringify({
        name: menuName,
        source: 'custom',
        addedBy: nickname,
      })
    });
    fetchRoomData();
  };

  const handleParticipationChange = async (status, reason = '', isSaveOnly = false) => {
    if (!isSaveOnly && status === participation && status !== 'pending') {
      await fetch(`/api/db/rooms/${roomId}/participation/${uid}`, { method: 'DELETE' });
      setParticipation('pending');
      setParticipationReason('');
    } else {
      await fetch(`/api/db/rooms/${roomId}/participation/${uid}`, {
        method: 'PUT',
        body: JSON.stringify({
          nickname, status, reason: status === 'decline' ? reason : '', updatedAt: Date.now()
        })
      });
      setParticipation(status);
    }
    fetchRoomData();
  };

  const handleVote = async (menuId) => {
    const voteSet = new Set(myVotes);
    if (voteSet.has(menuId)) voteSet.delete(menuId);
    else voteSet.add(menuId);
    
    const updatedVotes = Array.from(voteSet);
    await fetch(`/api/db/rooms/${roomId}/votes/${uid}`, {
      method: 'PUT',
      body: JSON.stringify({ nickname, menuIds: updatedVotes })
    });
    setMyVotes(updatedVotes);
    fetchRoomData();
  };

  const handleClose = async () => {
    const menus = room.menus || {};
    const votes = room.votes || {};
    const counts = {};
    Object.keys(menus).forEach(id => counts[id] = 0);
    Object.values(votes).forEach(v => (v.menuIds || []).forEach(id => { if (counts[id] !== undefined) counts[id]++; }));

    const maxCount = Math.max(...Object.values(counts));
    const topMenus = Object.keys(counts).filter(id => counts[id] === maxCount);
    const winnerId = topMenus[Math.floor(Math.random() * topMenus.length)];

    await fetch(`/api/db/rooms/${roomId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        status: 'closed',
        result: { winnerId, winnerName: menus[winnerId].name, topMenus, counts, isTie: topMenus.length > 1 }
      })
    });
    fetchRoomData();
  };

  if (loading) return <div className="loading">방 정보 로딩 중...</div>;

  if (!passwordChecked) {
    return (
      <div className="main-container">
        <div className="password-gate">
          <div className="password-gate-card">
            <h2>🔒 비밀번호가 필요합니다</h2>
            <input
              type="password"
              placeholder="비밀번호를 입력하세요"
              value={gateInput}
              onChange={(e) => setGateInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && checkRoomPassword(roomId, gateInput).then(ok => ok ? setPasswordChecked(true) : alert('틀림'))}
              autoFocus
            />
            <div className="password-gate-buttons">
              <button className="secondary-btn" onClick={() => router.push('/')}>돌아가기</button>
              <button className="primary-btn" onClick={() => checkRoomPassword(roomId, gateInput).then(ok => ok ? setPasswordChecked(true) : alert('틀림'))}>입장</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="main-container">
      <div className="room-container">
        <header className="room-header">
          <h1>{room.roomName || '오늘 뭐 먹지?'}</h1>
          <div className="room-code">
            <span>방 코드: <strong>{roomId}</strong></span>
            <button className="copy-btn" onClick={() => { navigator.clipboard.writeText(window.location.href); alert('복사됨'); }}>링크 복사</button>
            <button className="leave-btn" onClick={() => router.push('/')}>나가기</button>
          </div>
        </header>

        <div className="room-body">
          <section className="room-section">
            <h2 className="section-title">투표</h2>
            <MenuList menus={room.menus} votes={room.votes} myVotes={myVotes} onVote={handleVote} onDelete={id => fetch(`/api/db/rooms/${roomId}/menus/${id}`, {method:'DELETE'}).then(fetchRoomData)} status={room.status} />
            {room.status === 'voting' && (
              <>
                <AddMenu onAdd={handleAddMenu} />
                {computedIsHost && <button className="close-btn" onClick={handleClose}>투표 마감하기</button>}
              </>
            )}
          </section>

          <section className="room-section">
            <h2 className="section-title">음식점 찾기</h2>
            {currentLocation && (
              <>
                <NaverMap lat={currentLocation.lat} lng={currentLocation.lng} markers={searchMarkers} onReady={handleMapReady} />
                <button className="location-update-btn" onClick={handleUpdateLocation} disabled={locating}>{locating ? '위치 가져오는 중...' : '내 현재 위치로 갱신'}</button>
              </>
            )}
            {room.status === 'voting' && (
              <RestaurantSearch lat={currentLocation?.lat || room.location?.lat} lng={currentLocation?.lng || room.location?.lng} areaName={areaName} onAdd={handleAddRestaurant} onResults={setSearchMarkers} addedNames={new Set(Object.values(room?.menus || {}).map(m => m.name))} />
            )}
          </section>
        </div>
        <Chat roomId={roomId} user={user} />
      </div>
    </div>
  );
}
