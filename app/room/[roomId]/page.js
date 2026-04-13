'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '../../contexts/AuthContext';
import { deleteRoom, hasOtherParticipants, checkRoomPassword } from '../../utils/room';
import { reverseGeocodeNaver } from '../../utils/naverSearch';
import MenuList from '../../components/MenuList';
import AddMenu from '../../components/AddMenu';
import NaverMap from '../../components/NaverMap';
import RestaurantSearch from '../../components/RestaurantSearch';
import Chat from '../../components/Chat';
import ScheduleVote from '../../components/ScheduleVote';
import AddSchedule from '../../components/AddSchedule';
import BottomSheet, { resetBottomSheet } from '../../components/BottomSheet';
import { PanelIconBar, getPanelTitle } from '../../components/RoomPanel';

export default function RoomPage() {
  const params = useParams();
  const roomId = params.roomId;
  const router = useRouter();
  const { user, loading: authLoading, updateProfile } = useAuth();

  const nickname = user?.nickname || '익명';
  const uid = user?.uid || '';

  const [room, setRoom] = useState(null);
  const [myVotes, setMyVotes] = useState([]);
  const [myScheduleVotes, setMyScheduleVotes] = useState([]);
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
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState('');
  const [nameConflictModal, setNameConflictModal] = useState(false);
  const [nameConflictInput, setNameConflictInput] = useState('');
  const [nameConflictError, setNameConflictError] = useState('');
  const [nameConflictLoading, setNameConflictLoading] = useState(false);
  const [activePanel, setActivePanel] = useState('search');
  const bottomSheetRef = useRef(null);

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

      // 방 진입 시 이름 충돌 체크 (내 데이터가 없고 같은 이름이 있으면 변경 유도)
      if (data && uid && nickname !== '익명') {
        const myParticipation = data.participation?.[uid];
        const myVote = data.votes?.[uid];
        if (!myParticipation && !myVote) {
          const participationNicknames = Object.values(data.participation || {}).map(p => p.nickname);
          const voteNicknames = Object.values(data.votes || {}).map(v => v.nickname);
          const allNicknames = new Set([...participationNicknames, ...voteNicknames]);
          if (allNicknames.has(nickname)) {
            setNameConflictModal(true);
            setNameConflictInput('');
            setNameConflictError('');
          }
        }
      }

      if (data.participation?.[uid]) {
        setParticipation(data.participation[uid].status || 'pending');
        setParticipationReason(data.participation[uid].reason || '');
      }

      if (!passwordChecked) {
        const isHost = data.isMyRoom;
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
    if (authLoading) return;
    if (!user) { router.push('/'); return; }
    fetchRoomData();

    const es = new EventSource(`/api/sse?channel=rooms/${roomId}`);
    es.onmessage = () => fetchRoomData();
    es.onerror = () => {};
    return () => es.close();
  }, [roomId, user, authLoading]);

  useEffect(() => {
    if (room?.votes?.[uid]) {
      setMyVotes(room.votes[uid].menuIds || []);
    }
  }, [room, uid]);

  useEffect(() => {
    if (room?.scheduleVotes?.[uid]) {
      setMyScheduleVotes(room.scheduleVotes[uid].scheduleIds || []);
    }
  }, [room, uid]);

  const computedIsHost = room?.isMyRoom || user?.isAdmin;

  const isHoesik = room?.roomType === 'hoesik';

  const panels = [
    { id: 'search',   icon: '🔍', label: '음식점 검색' },
    { id: 'vote',     icon: '🗳️', label: '투표' },
    { id: 'chat',     icon: '💬', label: '채팅' },
    { id: 'attend',   icon: '🙋', label: '참여 여부' },
    { id: 'schedule', icon: '🗓️', label: '날짜·시간 투표', disabled: !isHoesik },
  ];

  const handlePanelSelect = (id) => {
    setActivePanel(id);
    resetBottomSheet(bottomSheetRef.current);
  };

  const activeInfo = getPanelTitle(panels, activePanel);

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
        lat: restaurant.lat || null,
        lng: restaurant.lng || null,
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
          nickname, status, reason: status === 'decline' ? reason : '', updatedAt: Date.now(),
          isGuest: user?.isGuest || false
        })
      });
      setParticipation(status);
    }
    fetchRoomData();
  };

  const handleNameConflictSubmit = async () => {
    const name = nameConflictInput.trim();
    if (!name) { setNameConflictError('이름을 입력해주세요'); return; }
    setNameConflictLoading(true);
    setNameConflictError('');
    try {
      const checkRes = await fetch(`/api/checkNickname?nickname=${encodeURIComponent(name)}&excludeUid=${uid}`);
      const { available } = await checkRes.json();
      if (!available) {
        setNameConflictError('사용이 불가능한 이름입니다');
        setNameConflictLoading(false);
        return;
      }
      await updateProfile(name, user?.profileImage || null);
      setNameConflictModal(false);
    } catch (err) {
      setNameConflictError(err.message || '오류가 발생했습니다');
    } finally {
      setNameConflictLoading(false);
    }
  };

  const handleVote = async (menuId) => {
    const voteSet = new Set(myVotes);
    if (voteSet.has(menuId)) voteSet.delete(menuId);
    else voteSet.add(menuId);

    const updatedVotes = Array.from(voteSet);

    // votes 먼저 저장
    await fetch(`/api/db/rooms/${roomId}/votes/${uid}`, {
      method: 'PUT',
      body: JSON.stringify({ nickname, menuIds: updatedVotes, isGuest: user?.isGuest || false })
    });

    // 투표가 1개 이상이면 votes 저장 후 순차적으로 참여 처리 (동시 실행 시 race condition 방지)
    if (updatedVotes.length > 0 && participation !== 'participate') {
      await fetch(`/api/db/rooms/${roomId}/participation/${uid}`, {
        method: 'PUT',
        body: JSON.stringify({ nickname, status: 'participate', reason: '', updatedAt: Date.now(), isGuest: user?.isGuest || false })
      });
      setParticipation('participate');
    }

    setMyVotes(updatedVotes);
    fetchRoomData();
  };

  const handleTitleSave = async () => {
    const trimmed = titleInput.trim();
    if (trimmed && trimmed !== room.roomName) {
      await fetch(`/api/db/rooms/${roomId}`, {
        method: 'PATCH',
        body: JSON.stringify({ roomName: trimmed }),
      });
      fetchRoomData();
    }
    setEditingTitle(false);
  };

  const handleAddSchedule = async (schedule) => {
    await fetch(`/api/db/rooms/${roomId}/schedules`, {
      method: 'POST',
      body: JSON.stringify({ ...schedule, addedBy: nickname }),
    });
    fetchRoomData();
  };

  const handleScheduleVote = async (scheduleId) => {
    const voteSet = new Set(myScheduleVotes);
    if (voteSet.has(scheduleId)) voteSet.delete(scheduleId);
    else voteSet.add(scheduleId);
    const updatedScheduleVotes = Array.from(voteSet);
    await fetch(`/api/db/rooms/${roomId}/scheduleVotes/${uid}`, {
      method: 'PUT',
      body: JSON.stringify({ nickname, scheduleIds: updatedScheduleVotes, isGuest: user?.isGuest || false }),
    });
    setMyScheduleVotes(updatedScheduleVotes);
    fetchRoomData();
  };

  const handleDeleteSchedule = async (scheduleId) => {
    await fetch(`/api/db/rooms/${roomId}/schedules/${scheduleId}`, { method: 'DELETE' });
    fetchRoomData();
  };

  const handleClose = async () => {
    const menus = room.menus || {};
    const votes = room.votes || {};
    const counts = {};
    Object.keys(menus).forEach(id => counts[id] = 0);
    Object.values(votes).forEach(v => (v.menuIds || []).forEach(id => { if (counts[id] !== undefined) counts[id]++; }));

    const maxCount = Math.max(0, ...Object.values(counts));
    const topMenus = Object.keys(counts).filter(id => counts[id] === maxCount && maxCount > 0);
    const winnerId = topMenus.length > 0 ? topMenus[Math.floor(Math.random() * topMenus.length)] : null;

    const result = {
      winnerId,
      winnerName: winnerId ? menus[winnerId]?.name : null,
      topMenus,
      counts,
      isTie: topMenus.length > 1,
    };

    if (room.roomType === 'hoesik') {
      const schedules = room.schedules || {};
      const scheduleVotes = room.scheduleVotes || {};
      const scheduleCounts = {};
      Object.keys(schedules).forEach(id => scheduleCounts[id] = 0);
      Object.values(scheduleVotes).forEach(v => (v.scheduleIds || []).forEach(id => {
        if (scheduleCounts[id] !== undefined) scheduleCounts[id]++;
      }));
      const maxSCount = Math.max(0, ...Object.values(scheduleCounts));
      const topScheduleIds = Object.keys(scheduleCounts).filter(id => scheduleCounts[id] === maxSCount && maxSCount > 0);
      if (topScheduleIds.length > 0) {
        const winnerScheduleId = topScheduleIds[Math.floor(Math.random() * topScheduleIds.length)];
        result.winnerScheduleId = winnerScheduleId;
        result.winnerSchedule = schedules[winnerScheduleId];
        result.scheduleCounts = scheduleCounts;
      }
    }

    await fetch(`/api/db/rooms/${roomId}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'closed', result }),
    });
    fetchRoomData();
  };

  const renderPanelContent = () => {
    switch (activePanel) {
      case 'search':
        return (
          <>
            {room.status === 'voting' && (
              <RestaurantSearch
                lat={currentLocation?.lat || room.location?.lat}
                lng={currentLocation?.lng || room.location?.lng}
                areaName={areaName}
                onAdd={handleAddRestaurant}
                onResults={setSearchMarkers}
                addedNames={new Set(Object.values(room?.menus || {}).map(m => m.name))}
                noRadius={room.roomType === 'hoesik'}
              />
            )}
            {room.status !== 'voting' && (
              <p style={{ color: '#999', fontSize: '13px', textAlign: 'center', padding: '20px 0' }}>투표가 마감되었습니다.</p>
            )}
          </>
        );
      case 'vote':
        return (
          <>
            <MenuList
              menus={room.menus}
              votes={room.votes}
              myVotes={myVotes}
              onVote={handleVote}
              onDelete={id => fetch(`/api/db/rooms/${roomId}/menus/${id}`, { method: 'DELETE' }).then(fetchRoomData)}
              status={room.status}
            />
            {room.status === 'voting' && (
              <>
                <AddMenu onAdd={handleAddMenu} />
                {computedIsHost && (
                  <button className="close-btn" onClick={handleClose} style={{ marginTop: '12px' }}>
                    투표 마감하기
                  </button>
                )}
              </>
            )}
          </>
        );
      case 'chat':
        return <Chat roomId={roomId} user={user} />;
      case 'attend':
        return (
          <>
            <div className="participation-selector" style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
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
              <div className="decline-reason-input" style={{ marginBottom: '16px' }}>
                <input
                  type="text"
                  placeholder="미참여 사유 입력"
                  value={participationReason}
                  onChange={(e) => setParticipationReason(e.target.value)}
                />
                <button
                  className="reason-save-btn"
                  onClick={() => handleParticipationChange('decline', participationReason, true)}
                >
                  저장
                </button>
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
                      .map((p, idx) => (
                        <li key={idx}>{p.isGuest && <span className="guest-badge">👤</span>}{p.nickname}</li>
                      ))}
                  </ul>
                </div>
                <div className="status-column decline">
                  <h4>미참여 ({Object.values(room?.participation || {}).filter(p => p.status === 'decline').length})</h4>
                  <ul>
                    {Object.values(room?.participation || {})
                      .filter(p => p.status === 'decline')
                      .map((p, idx) => (
                        <li key={idx}>
                          <strong>{p.isGuest && <span className="guest-badge">👤</span>}{p.nickname}</strong>
                          {p.reason && <span className="reason"> - {p.reason}</span>}
                        </li>
                      ))}
                  </ul>
                </div>
              </div>
            </div>
          </>
        );
      case 'schedule':
        return (
          <>
            <ScheduleVote
              schedules={room.schedules}
              scheduleVotes={room.scheduleVotes}
              myScheduleVotes={myScheduleVotes}
              onVote={handleScheduleVote}
              onDelete={handleDeleteSchedule}
              status={room.status}
            />
            {room.status === 'voting' && (
              <AddSchedule onAdd={handleAddSchedule} />
            )}
          </>
        );
      default:
        return null;
    }
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
    <div className="room-map-layout">
      {/* 슬림 헤더 */}
      <header className="room-map-header">
        {editingTitle ? (
          <input
            className="room-title-input"
            value={titleInput}
            onChange={(e) => setTitleInput(e.target.value)}
            onBlur={handleTitleSave}
            onKeyDown={(e) => { if (e.key === 'Enter') handleTitleSave(); if (e.key === 'Escape') setEditingTitle(false); }}
            autoFocus
          />
        ) : (
          <>
            <h1>{room.roomName || '오늘 뭐 먹지?'}</h1>
            {computedIsHost && (
              <button className="title-edit-btn" onClick={() => { setTitleInput(room.roomName || ''); setEditingTitle(true); }}>✏️</button>
            )}
          </>
        )}
        <div className="header-right">
          <span className="header-code">{roomId}</span>
          <button className="header-btn" onClick={() => { navigator.clipboard.writeText(window.location.href); alert('복사됨'); }}>링크 복사</button>
          <button className="header-btn" onClick={() => router.push('/')}>나가기</button>
        </div>
      </header>

      {/* 본문 */}
      <div className="room-map-body">
        {/* 데스크탑 왼쪽 패널 */}
        <aside className="room-sidebar">
          <div className="room-sidebar-header">
            <span>{activeInfo.icon}</span>
            <span>{activeInfo.label}</span>
          </div>
          <div className="room-sidebar-content">
            {renderPanelContent()}
          </div>
        </aside>

        {/* 지도 */}
        <div className="room-map-area">
          {currentLocation && (
            <NaverMap
              lat={currentLocation.lat}
              lng={currentLocation.lng}
              markers={searchMarkers}
              menuMarkers={Object.values(room?.menus || {}).filter(m => m.lat && m.lng).map(m => ({ name: m.name, lat: m.lat, lng: m.lng }))}
              onReady={handleMapReady}
            />
          )}

          {/* 아이콘 바 */}
          <PanelIconBar
            panels={panels}
            activePanel={activePanel}
            onSelect={handlePanelSelect}
          />

          {/* 현재 위치 갱신 버튼 */}
          <button
            className="room-location-btn"
            onClick={handleUpdateLocation}
            disabled={locating}
          >
            📍 {locating ? '가져오는 중...' : '현재위치'}
          </button>

          {/* 모바일: 하단 드래그 시트 */}
          <BottomSheet
            ref={bottomSheetRef}
            header={<><span>{activeInfo.icon}</span><span>{activeInfo.label}</span></>}
          >
            {renderPanelContent()}
          </BottomSheet>
        </div>
      </div>

      {/* 이름 충돌 모달 */}
      {nameConflictModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>이름 변경 필요</h3>
            <p style={{ fontSize: '14px', color: '#666', marginBottom: '12px' }}>
              이미 <strong>{nickname}</strong>이 이 방에 있습니다.<br />이름을 변경하고 입장하세요.
            </p>
            <input
              type="text"
              placeholder="새 이름 입력"
              value={nameConflictInput}
              onChange={(e) => { setNameConflictInput(e.target.value); setNameConflictError(''); }}
              onKeyDown={(e) => e.key === 'Enter' && handleNameConflictSubmit()}
              maxLength={20}
              autoFocus
            />
            {nameConflictError && <p className="error">{nameConflictError}</p>}
            <div className="modal-buttons">
              <button className="primary-btn" onClick={handleNameConflictSubmit} disabled={nameConflictLoading}>
                {nameConflictLoading ? '확인 중...' : '변경 후 입장'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
