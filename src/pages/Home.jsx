import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { createRoom, roomExists, hasRoomPassword, checkRoomPassword, onRoomList, deleteRoom, hasOtherParticipants } from '../utils/room';

export default function Home() {
  const { user, login, loginAsAdmin, logout, loading: authLoading, updateProfile } = useAuth();
  const [roomName, setRoomName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [rooms, setRooms] = useState([]);
  const [usePassword, setUsePassword] = useState(false);
  const [password, setPassword] = useState('');
  const [editing, setEditing] = useState(false);
  const [editNickname, setEditNickname] = useState('');
  const [editImage, setEditImage] = useState(null);
  // 비밀번호 모달 상태
  const [passwordModal, setPasswordModal] = useState(null); // { roomId }
  const [modalInput, setModalInput] = useState('');
  const [modalError, setModalError] = useState('');
  // 관리자 로그인 모달 상태
  const [adminLoginModal, setAdminLoginModal] = useState(false);
  const [adminId, setAdminId] = useState('');
  const [adminPw, setAdminPw] = useState('');
  const [adminClickCount, setAdminClickCount] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = onRoomList(setRooms);
    return () => unsubscribe();
  }, []);

  const handleTitleClick = () => {
    setAdminClickCount((prev) => {
      const next = prev + 1;
      if (next === 5) {
        setAdminLoginModal(true);
        return 0;
      }
      return next;
    });
  };

  const handleLogin = async () => {
    setError('');
    try {
      await login();
    } catch (err) {
      console.error('카카오 로그인 에러:', err);
      setError(`카카오 로그인에 실패했습니다 (${err?.msg || err?.message || JSON.stringify(err)})`);
    }
  };

  const handleCreate = async () => {
    if (usePassword && !password.trim()) {
      setError('비밀번호를 입력해주세요');
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
      const roomId = await createRoom(user.nickname, location, roomName.trim(), user.uid, usePassword ? password.trim() : '');
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
    const hasPw = await hasRoomPassword(code);
    if (hasPw && !sessionStorage.getItem(`room_auth_${code}`)) {
      setPasswordModal({ roomId: code });
      setModalInput('');
      setModalError('');
      return;
    }
    navigate(`/room/${code}`);
  };

  const handleRoomClick = async (room) => {
    // 방장은 비밀번호 없이 바로 입장
    if (room.createdByUid === user?.uid) {
      sessionStorage.setItem(`room_auth_${room.id}`, 'true');
      navigate(`/room/${room.id}`);
      return;
    }
    // 이미 인증된 방
    if (sessionStorage.getItem(`room_auth_${room.id}`)) {
      navigate(`/room/${room.id}`);
      return;
    }
    // 비밀번호방이면 모달
    if (room.hasPassword) {
      setPasswordModal({ roomId: room.id });
      setModalInput('');
      setModalError('');
      return;
    }
    navigate(`/room/${room.id}`);
  };

  const handlePasswordSubmit = async () => {
    if (!passwordModal) return;
    setLoading(true);
    const success = await checkRoomPassword(passwordModal.roomId, modalInput);
    setLoading(false);
    
    if (success) {
      sessionStorage.setItem(`room_auth_${passwordModal.roomId}`, 'true');
      setPasswordModal(null);
      navigate(`/room/${passwordModal.roomId}`);
    } else {
      setModalError('비밀번호가 틀렸습니다');
    }
  };

  const handleAdminLoginSubmit = async () => {
    try {
      const res = await fetch('/api/adminAuth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminId, adminPw }),
      });
      const data = await res.json();

      if (data.success) {
        loginAsAdmin(data.adminUser);
        setAdminLoginModal(false);
        setAdminId('');
        setAdminPw('');
      } else {
        alert(data.error || '관리자 계정 정보가 일치하지 않습니다.');
      }
    } catch (err) {
      console.error('관리자 로그인 요청 실패:', err);
      alert('서버와 통신 중 오류가 발생했습니다.');
    }
  };

  const handleDeleteRoom = async (e, room) => {
    e.stopPropagation();
    if (hasOtherParticipants(room, user.uid)) {
      alert('다른 참여자가 있는 방은 삭제할 수 없습니다.');
      return;
    }
    if (!window.confirm(`"${room.roomName || room.id}" 방을 삭제할까요?`)) return;
    await deleteRoom(room.id);
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setEditImage(ev.target.result);
    reader.readAsDataURL(file);
  };

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

  if (authLoading) {
    return <div className="loading">로딩 중...</div>;
  }

  // 비로그인 상태: 카카오 로그인 버튼만 표시
  if (!user) {
    return (
      <div className="home-container">
        <h1 onClick={handleTitleClick} style={{ cursor: 'default', userSelect: 'none' }}>오늘 뭐 먹지?</h1>
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

        {adminLoginModal && (
          <div className="modal-overlay" onClick={() => setAdminLoginModal(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <h3>🔧 관리자 로그인</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '10px' }}>
                <input
                  type="text"
                  placeholder="관리자 ID"
                  value={adminId}
                  onChange={(e) => setAdminId(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAdminLoginSubmit()}
                  autoFocus
                />
                <input
                  type="password"
                  placeholder="비밀번호"
                  value={adminPw}
                  onChange={(e) => setAdminPw(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAdminLoginSubmit()}
                />
              </div>
              <div className="modal-buttons" style={{ marginTop: '20px' }}>
                <button className="secondary-btn" onClick={() => setAdminLoginModal(false)}>취소</button>
                <button className="primary-btn" onClick={handleAdminLoginSubmit}>로그인</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // 로그인 상태: 프로필 + 방 만들기/참가 UI
  return (
    <div className="home-container">
      <h1 onClick={handleTitleClick} style={{ cursor: 'default', userSelect: 'none' }}>오늘 뭐 먹지?</h1>
      <p className="subtitle">팀 점심 메뉴를 투표로 정해보세요</p>

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
              : <div className="profile-image-placeholder">{user.nickname?.[0] || '?'}</div>
            }
            <span className="profile-name">{user.nickname}</span>
            <button className="profile-edit-btn" onClick={handleEditStart}>편집</button>
            <button className="logout-btn" onClick={logout}>로그아웃</button>
          </>
        )}
      </div>

      <div className="input-group">
        <input
          type="text"
          placeholder="방 이름 (예: 개발팀 점심)"
          value={roomName}
          onChange={(e) => setRoomName(e.target.value)}
          maxLength={20}
        />
        <label className="password-toggle">
          <input
            type="checkbox"
            checked={usePassword}
            onChange={(e) => {
              setUsePassword(e.target.checked);
              if (!e.target.checked) setPassword('');
            }}
          />
          비밀번호 설정
        </label>
        {usePassword && (
          <input
            type="password"
            className="password-input"
            placeholder="비밀번호 입력"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            maxLength={20}
          />
        )}
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
                onClick={() => handleRoomClick(room)}
              >
                <div className="room-card-header">
                  <span className="room-card-code">
                    {room.hasPassword && <span className="room-lock-icon">🔒</span>}
                    {room.roomName || room.id}
                  </span>
                  <div className="room-card-header-right">
                    <span className={`room-status-badge ${isClosed ? 'closed' : 'voting'}`}>
                      {isClosed ? '마감' : '투표중'}
                    </span>
                    {(room.createdByUid === user?.uid || user?.isAdmin) && (
                      <button
                        className="room-delete-btn"
                        onClick={(e) => handleDeleteRoom(e, room)}
                      >
                        삭제
                      </button>
                    )}
                  </div>
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
      {passwordModal && (
        <div className="modal-overlay" onClick={() => setPasswordModal(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>🔒 비밀번호 입력</h3>
            <input
              type="password"
              placeholder="비밀번호를 입력하세요"
              value={modalInput}
              onChange={(e) => {
                setModalInput(e.target.value);
                setModalError('');
              }}
              onKeyDown={(e) => e.key === 'Enter' && handlePasswordSubmit()}
              autoFocus
            />
            {modalError && <p className="error">{modalError}</p>}
            <div className="modal-buttons">
              <button className="secondary-btn" onClick={() => setPasswordModal(null)}>취소</button>
              <button className="primary-btn" onClick={handlePasswordSubmit}>입장</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
