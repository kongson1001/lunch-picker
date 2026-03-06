import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { db, ref, onValue, push, set, update, remove } from '../firebase';
import { deleteRoom, hasOtherParticipants, checkRoomPassword } from '../utils/room';
import { reverseGeocodeNaver } from '../utils/naverSearch';
import MenuList from '../components/MenuList';
import AddMenu from '../components/AddMenu';
import NaverMap from '../components/NaverMap';
import RestaurantSearch from '../components/RestaurantSearch';
import Chat from '../components/Chat';

export default function Room() {
  const { roomId } = useParams();
  const navigate = useNavigate();
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
  const [participation, setParticipation] = useState('pending'); // 'participate', 'decline', 'pending'
  const [participationReason, setParticipationReason] = useState('');

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

      // 내 참여 정보 로드
      if (data.participation?.[uid]) {
        setParticipation(data.participation[uid].status || 'pending');
        setParticipationReason(data.participation[uid].reason || '');
      }

      // 비밀번호 체크: 방장이거나, 인증 캐시가 있거나, 비밀번호 없는 방이면 통과
      if (!passwordChecked) {
        const isHost = data.createdByUid === uid;
        const hasAuth = sessionStorage.getItem(`room_auth_${roomId}`);
        // data.password 대신 data.hasPassword(또는 undefined 체크) 사용
        const hasPassword = data.password !== undefined; 
        if (isHost || hasAuth || !hasPassword) {
          setPasswordChecked(true);
        }
      }

      if (data.status === 'closed' && data.result) {
        navigate(`/room/${roomId}/result`);
      }
    });
    return () => unsubscribe();
  }, [roomId, navigate, uid, passwordChecked]);

  // uid 기준으로 내 투표 복원
  useEffect(() => {
    if (room?.votes?.[uid]) {
      setMyVotes(room.votes[uid].menuIds || []);
    }
  }, [room, uid]);

  // 방장 판별: createdByUid 기준 또는 관리자
  const computedIsHost = room?.createdByUid === uid || user?.isAdmin;

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

  const handleParticipationChange = async (status, reason = '') => {
    const pRef = ref(db, `rooms/${roomId}/participation/${uid}`);
    await set(pRef, {
      nickname,
      status,
      reason,
      updatedAt: Date.now()
    });
    setParticipation(status);
    if (reason) setParticipationReason(reason);
  };

  const handleDeleteMenu = async (menuId) => {
    await remove(ref(db, `rooms/${roomId}/menus/${menuId}`));
  };

  // 투표 키: uid 기준 (1인 1투표)
  const handleVote = async (menuId) => {
    setMyVotes((prev) => {
      // Set을 사용하여 중복을 원천적으로 방지하고 toggle 처리
      const voteSet = new Set(prev);
      if (voteSet.has(menuId)) {
        voteSet.delete(menuId);
      } else {
        voteSet.add(menuId);
      }
      const updatedVotes = Array.from(voteSet);
      
      // DB에도 즉시 업데이트
      const voteRef = ref(db, `rooms/${roomId}/votes/${uid}`);
      set(voteRef, { nickname, menuIds: updatedVotes });
      
      return updatedVotes;
    });
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

  const handleDeleteRoom = async () => {
    if (hasOtherParticipants(room, uid)) {
      alert('다른 참여자가 있는 방은 삭제할 수 없습니다.');
      return;
    }
    if (!window.confirm(`"${room.roomName || roomId}" 방을 삭제할까요?`)) return;
    await deleteRoom(roomId);
    navigate('/');
  };

  // 이미 추가된 메뉴 이름 Set (중복 추가 방지)
  const addedNames = new Set(
    Object.values(room?.menus || {}).map((m) => m.name)
  );

  if (loading) return <div className="loading">방 정보 로딩 중...</div>;

  // 비밀번호 미인증 상태면 비밀번호 입력 화면 표시
  if (!passwordChecked) {
    const handleGateSubmit = async () => {
      setLoading(true);
      const success = await checkRoomPassword(roomId, gateInput);
      setLoading(false);
      
      if (success) {
        sessionStorage.setItem(`room_auth_${roomId}`, 'true');
        setPasswordChecked(true);
      } else {
        setGateError('비밀번호가 틀렸습니다');
      }
    };
    return (
      <div className="password-gate">
        <div className="password-gate-card">
          <h2>🔒 비밀번호가 필요합니다</h2>
          <p>{room.roomName || roomId}</p>
          <input
            type="password"
            placeholder="비밀번호를 입력하세요"
            value={gateInput}
            onChange={(e) => {
              setGateInput(e.target.value);
              setGateError('');
            }}
            onKeyDown={(e) => e.key === 'Enter' && handleGateSubmit()}
            autoFocus
          />
          {gateError && <p className="error">{gateError}</p>}
          <div className="password-gate-buttons">
            <button className="secondary-btn" onClick={() => navigate('/')}>돌아가기</button>
            <button className="primary-btn" onClick={handleGateSubmit}>입장</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="room-container">
      <header className="room-header">
        <h1>{room.roomName || '오늘 뭐 먹지?'}</h1>
        <div className="room-code">
          <span>방 코드: <strong>{roomId}</strong></span>
          <button className="copy-btn" onClick={copyRoomCode}>링크 복사</button>
          <button className="leave-btn" onClick={handleLeave}>나가기</button>
          {computedIsHost && (
            <button className="delete-room-btn" onClick={handleDeleteRoom}>방 삭제</button>
          )}
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
          <h2 className="section-title">점심 참여 여부</h2>
          <div className="participation-selector">
            <button 
              className={`participation-btn ${participation === 'participate' ? 'active' : ''}`}
              onClick={() => handleParticipationChange('participate')}
            >
              🙋‍♂️ 참여
            </button>
            <button 
              className={`participation-btn decline ${participation === 'decline' ? 'active' : ''}`}
              onClick={() => handleParticipationChange('decline', participationReason)}
            >
              🙅‍♀️ 미참여
            </button>
          </div>
          
          {participation === 'decline' && (
            <div className="decline-reason-input">
              <input 
                type="text" 
                placeholder="미참여 사유를 입력해주세요 (예: 외부 미팅)"
                value={participationReason}
                onChange={(e) => setParticipationReason(e.target.value)}
                onBlur={(e) => handleParticipationChange('decline', e.target.value)}
              />
            </div>
          )}

          <div className="participant-status-list">
            <h3>참여자 현황</h3>
            <div className="status-grid">
              <div className="status-column">
                <h4>참여 ({Object.values(room?.participation || {}).filter(p => p.status === 'participate').length})</h4>
                <ul>
                  {Object.values(room?.participation || {})
                    .filter(p => p.status === 'participate')
                    .map((p, idx) => <li key={idx}>{p.nickname}</li>)}
                </ul>
              </div>
              <div className="status-column decline">
                <h4>미참여 ({Object.values(room?.participation || {}).filter(p => p.status === 'decline').length})</h4>
                <ul>
                  {Object.values(room?.participation || {})
                    .filter(p => p.status === 'decline')
                    .map((p, idx) => (
                      <li key={idx}>
                        <strong>{p.nickname}</strong>
                        {p.reason && <span className="reason"> - {p.reason}</span>}
                      </li>
                    ))}
                </ul>
              </div>
            </div>
          </div>
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

      <Chat roomId={roomId} user={user} />
    </div>
  );
}
