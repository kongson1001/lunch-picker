import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { createRoom, roomExists, onRoomList } from '../utils/room';

export default function Home() {
  const { user, login, logout, loading: authLoading } = useAuth();
  const [roomName, setRoomName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [rooms, setRooms] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = onRoomList(setRooms);
    return () => unsubscribe();
  }, []);

  const handleLogin = async () => {
    setError('');
    try {
      await login();
    } catch {
      setError('카카오 로그인에 실패했습니다');
    }
  };

  const handleCreate = async () => {
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
      const roomId = await createRoom(user.nickname, location, roomName.trim(), user.uid);
      navigate(`/room/${roomId}`);
    } catch {
      setError('위치 정보를 가져올 수 없습니다. 위치 권한을 허용해주세요.');
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async () => {
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
    navigate(`/room/${code}`);
  };

  const handleRoomClick = (roomId) => {
    navigate(`/room/${roomId}`);
  };

  if (authLoading) {
    return <div className="loading">로딩 중...</div>;
  }

  // 비로그인 상태: 카카오 로그인 버튼만 표시
  if (!user) {
    return (
      <div className="home-container">
        <h1>오늘 뭐 먹지?</h1>
        <p className="subtitle">팀 점심 메뉴를 투표로 정해보세요</p>

        {error && <p className="error">{error}</p>}

        <div className="action-group">
          <button className="kakao-login-btn" onClick={handleLogin}>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path fillRule="evenodd" clipRule="evenodd" d="M9 0.6C4.03 0.6 0 3.713 0 7.554c0 2.486 1.656 4.672 4.148 5.905l-1.054 3.9c-.093.345.302.616.596.408l4.67-3.096c.21.015.422.023.64.023 4.97 0 9-3.113 9-6.954C18 3.713 13.97 0.6 9 0.6" fill="#000000"/>
            </svg>
            카카오로 시작하기
          </button>
        </div>
      </div>
    );
  }

  // 로그인 상태: 프로필 + 방 만들기/참가 UI
  return (
    <div className="home-container">
      <h1>오늘 뭐 먹지?</h1>
      <p className="subtitle">팀 점심 메뉴를 투표로 정해보세요</p>

      <div className="profile-card">
        {user.profileImage && (
          <img src={user.profileImage} alt="" className="profile-image" />
        )}
        <span className="profile-name">{user.nickname}</span>
        <button className="logout-btn" onClick={logout}>로그아웃</button>
      </div>

      <div className="input-group">
        <input
          type="text"
          placeholder="방 이름 (예: 개발팀 점심)"
          value={roomName}
          onChange={(e) => setRoomName(e.target.value)}
          maxLength={20}
        />
      </div>

      {error && <p className="error">{error}</p>}

      <div className="action-group">
        <button className="primary-btn" onClick={handleCreate} disabled={loading}>
          {loading ? '방 만드는 중...' : '새 방 만들기'}
        </button>
      </div>

      <div className="divider"><span>또는</span></div>

      <div className="join-group">
        <input
          type="text"
          placeholder="방 코드 입력 (예: ABC123)"
          value={joinCode}
          onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
          maxLength={6}
        />
        <button className="secondary-btn" onClick={handleJoin}>참가하기</button>
      </div>

      {rooms.length > 0 && (
        <div className="room-list">
          <h2>활성 방 목록</h2>
          {rooms.map((room) => {
            const menuCount = room.menus ? Object.keys(room.menus).length : 0;
            const voteCount = room.votes ? Object.keys(room.votes).length : 0;
            const isClosed = room.status === 'closed';
            return (
              <div
                key={room.id}
                className={`room-card ${isClosed ? 'closed' : ''}`}
                onClick={() => handleRoomClick(room.id)}
              >
                <div className="room-card-header">
                  <span className="room-card-code">
                    {room.roomName || room.id}
                  </span>
                  <span className={`room-status-badge ${isClosed ? 'closed' : 'voting'}`}>
                    {isClosed ? '마감' : '투표중'}
                  </span>
                </div>
                <div className="room-card-info">
                  <span>만든 사람: {room.createdBy}</span>
                  <span>메뉴 {menuCount}개 · 참여 {voteCount}명</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
