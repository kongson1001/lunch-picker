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
      <h1>오늘 뭐 먹지?</h1>
      <p className="subtitle">팀 점심 메뉴를 투표로 정해보세요</p>

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
    </div>
  );
}
