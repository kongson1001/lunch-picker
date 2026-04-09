'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from './contexts/AuthContext';
import { createRoom, roomExists, hasRoomPassword, checkRoomPassword, onRoomList, deleteRoom, hasOtherParticipants } from './utils/room';

export default function Home() {
  const { user, login, loginAsAdmin, logout, loading: authLoading, updateProfile, guestLogin, pendingKakaoUser, completeKakaoLogin } = useAuth();
  const [roomName, setRoomName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('lunch');
  const [error, setError] = useState('');
  const [rooms, setRooms] = useState([]);
  const [usePassword, setUsePassword] = useState(false);
  const [password, setPassword] = useState('');
  const [editing, setEditing] = useState(false);
  const [editNickname, setEditNickname] = useState('');
  const [editImage, setEditImage] = useState(null);
  const [passwordModal, setPasswordModal] = useState(null);
  const [modalInput, setModalInput] = useState('');
  const [modalError, setModalError] = useState('');
  const [adminLoginModal, setAdminLoginModal] = useState(false);
  const [adminId, setAdminId] = useState('');
  const [adminPw, setAdminPw] = useState('');
  const [adminClickCount, setAdminClickCount] = useState(0);
  const [guestModal, setGuestModal] = useState(false);
  const [guestName, setGuestName] = useState('');
  const [guestPassword, setGuestPassword] = useState('');
  const [guestPasswordConfirm, setGuestPasswordConfirm] = useState('');
  const [guestError, setGuestError] = useState('');
  const [guestLoading, setGuestLoading] = useState(false);
  const [kakaoNicknameModal, setKakaoNicknameModal] = useState(false);
  const [kakaoNicknameInput, setKakaoNicknameInput] = useState('');
  const [kakaoNicknameError, setKakaoNicknameError] = useState('');
  const [kakaoNicknameLoading, setKakaoNicknameLoading] = useState(false);
  const [profileError, setProfileError] = useState('');
  const router = useRouter();

  useEffect(() => {
    if (pendingKakaoUser) {
      setKakaoNicknameInput(pendingKakaoUser.kakaoNickname);
      setKakaoNicknameModal(true);
    } else {
      setKakaoNicknameModal(false);
    }
  }, [pendingKakaoUser]);

  useEffect(() => {
    if (!user) return;
    const unsubscribe = onRoomList(setRooms);
    return () => unsubscribe();
  }, [user]);

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

  const handleGuestLogin = async () => {
    const name = guestName.trim();
    const pw = guestPassword.trim();
    if (!name) { setGuestError('이름을 입력해주세요'); return; }
    if (!pw) { setGuestError('비밀번호를 입력해주세요'); return; }
    if (pw !== guestPasswordConfirm.trim()) { setGuestError('비밀번호가 일치하지 않습니다'); return; }
    setGuestLoading(true);
    setGuestError('');
    try {
      await guestLogin(name, pw);
      setGuestModal(false);
      setGuestName('');
      setGuestPassword('');
      setGuestPasswordConfirm('');
    } catch (err) {
      setGuestError(err.message || '비회원 로그인 실패');
    } finally {
      setGuestLoading(false);
    }
  };

  const handleKakaoNicknameSubmit = async () => {
    const name = kakaoNicknameInput.trim();
    if (!name) { setKakaoNicknameError('이름을 입력해주세요'); return; }
    setKakaoNicknameLoading(true);
    setKakaoNicknameError('');
    try {
      const checkRes = await fetch(`/api/checkNickname?nickname=${encodeURIComponent(name)}`);
      const { available } = await checkRes.json();
      if (!available) {
        setKakaoNicknameError('사용이 불가능한 이름입니다');
        setKakaoNicknameLoading(false);
        return;
      }
      await completeKakaoLogin(name);
      setKakaoNicknameModal(false);
    } catch (err) {
      setKakaoNicknameError(err.message || '오류가 발생했습니다');
    } finally {
      setKakaoNicknameLoading(false);
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
      let location = null;
      if (activeTab === 'lunch') {
        const position = await new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 10000,
          });
        });
        location = { lat: position.coords.latitude, lng: position.coords.longitude };
      } else {
        try {
          const position = await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              enableHighAccuracy: true,
              timeout: 5000,
            });
          });
          location = { lat: position.coords.latitude, lng: position.coords.longitude };
        } catch {}
      }
      const roomId = await createRoom(user.nickname, location, roomName.trim(), user.uid, usePassword ? password.trim() : '', activeTab);
      router.push(`/room/${roomId}`);
    } catch (err) {
      if (err?.code === 1) {
        setError('위치 권한을 허용해주세요.');
      } else {
        setError(err?.message || '방 생성에 실패했습니다. 다시 로그인해주세요.');
      }
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
    router.push(`/room/${code}`);
  };

  const handleRoomClick = async (room) => {
    if (room.isMyRoom) {
      sessionStorage.setItem(`room_auth_${room.id}`, 'true');
      router.push(`/room/${room.id}`);
      return;
    }
    if (sessionStorage.getItem(`room_auth_${room.id}`)) {
      router.push(`/room/${room.id}`);
      return;
    }
    if (room.hasPassword) {
      setPasswordModal({ roomId: room.id });
      setModalInput('');
      setModalError('');
      return;
    }
    router.push(`/room/${room.id}`);
  };

  const handlePasswordSubmit = async () => {
    if (!passwordModal) return;
    setLoading(true);
    const success = await checkRoomPassword(passwordModal.roomId, modalInput);
    setLoading(false);

    if (success) {
      sessionStorage.setItem(`room_auth_${passwordModal.roomId}`, 'true');
      setPasswordModal(null);
      router.push(`/room/${passwordModal.roomId}`);
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
    if (file.size > 200 * 1024) {
      alert('이미지 크기는 200KB 이하만 가능합니다.');
      e.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => setEditImage(ev.target.result);
    reader.readAsDataURL(file);
  };

  const handleEditStart = () => {
    setEditNickname(user.nickname);
    setEditImage(user.profileImage || null);
    setProfileError('');
    setEditing(true);
  };

  const handleEditSave = async () => {
    const trimmed = editNickname.trim();
    if (!trimmed) return;
    setProfileError('');
    try {
      await updateProfile(trimmed, editImage);
      setEditing(false);
    } catch (err) {
      setProfileError(err.message || '저장에 실패했습니다');
    }
  };

  const handleEditCancel = () => {
    setEditing(false);
  };

  if (authLoading) {
    return <div className="loading">로딩 중...</div>;
  }

  return (
    <div className="main-container home-layout">
      <div className="home-container">
        <h1 onClick={handleTitleClick} style={{ cursor: 'default', userSelect: 'none' }}>오늘 뭐 먹지?</h1>
        <p className="subtitle">팀 점심 메뉴를 투표로 정해보세요</p>

        {!user ? (
          <>
            {error && <p className="error">{error}</p>}
            <div className="action-group">
              <button className="kakao-login-btn" onClick={handleLogin}>
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <path fillRule="evenodd" clipRule="evenodd" d="M9 0.6C4.03 0.6 0 3.713 0 7.554c0 2.486 1.656 4.672 4.148 5.905l-1.054 3.9c-.093.345.302.616.596.408l4.67-3.096c.21.015.422.023.64.023 4.97 0 9-3.113 9-6.954C18 3.713 13.97 0.6 9 0.6" fill="#000000"/>
                </svg>
                카카오로 시작하기
              </button>
              <button className="guest-login-btn" onClick={() => { setGuestModal(true); setGuestName(''); setGuestPassword(''); setGuestPasswordConfirm(''); setGuestError(''); }}>
                비회원 로그인
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="profile-card">
              {editing ? (
                <>
                  <label className="profile-image-label" style={user?.isGuest ? { cursor: 'default' } : {}}>
                    {editImage
                      ? <img src={editImage} alt="" className="profile-image" />
                      : <div className="profile-image-placeholder">{editNickname[0] || '?'}</div>
                    }
                    {!user?.isGuest && (
                      <input
                        type="file"
                        accept="image/*"
                        className="profile-image-input"
                        onChange={handleImageChange}
                      />
                    )}
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
                  {profileError && <p className="error" style={{ marginTop: '8px' }}>{profileError}</p>}
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

            <div className="room-type-tabs">
              <button
                className={`room-type-tab ${activeTab === 'lunch' ? 'active' : ''}`}
                onClick={() => setActiveTab('lunch')}
              >
                🍱 점심
              </button>
              <button
                className={`room-type-tab ${activeTab === 'hoesik' ? 'active' : ''}`}
                onClick={() => setActiveTab('hoesik')}
              >
                🍻 회식
              </button>
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
                <h2>{activeTab === 'lunch' ? '점심 방 목록' : '회식 방 목록'}</h2>
                {rooms
                  .filter(room => (room.roomType ?? 'lunch') === activeTab)
                  .map((room) => {
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
                          {room.roomType === 'hoesik' && <span className="hoesik-badge">🍻</span>}
                          {room.roomName || room.id}
                        </span>
                        <div className="room-card-header-right">
                          <span className={`room-status-badge ${isClosed ? 'closed' : 'voting'}`}>
                            {isClosed ? '마감' : '투표중'}
                          </span>
                          {(room.isMyRoom || user?.isAdmin) && (
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
          </>
        )}

        {guestModal && (
          <div className="modal-overlay" onClick={() => setGuestModal(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <h3>비회원 로그인</h3>
              <p style={{ fontSize: '14px', color: '#666', marginBottom: '12px' }}>
                이름과 비밀번호를 입력하세요.<br />
                처음이면 계정이 만들어지고, 같은 이름으로 돌아오면 기존 데이터를 이어서 사용할 수 있습니다.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <input
                  type="text"
                  placeholder="이름 입력"
                  value={guestName}
                  onChange={(e) => { setGuestName(e.target.value); setGuestError(''); }}
                  onKeyDown={(e) => e.key === 'Enter' && handleGuestLogin()}
                  maxLength={20}
                  autoFocus
                />
                <input
                  type="password"
                  placeholder="비밀번호 입력"
                  value={guestPassword}
                  onChange={(e) => { setGuestPassword(e.target.value); setGuestError(''); }}
                  onKeyDown={(e) => e.key === 'Enter' && handleGuestLogin()}
                  maxLength={30}
                />
                <input
                  type="password"
                  placeholder="비밀번호 확인"
                  value={guestPasswordConfirm}
                  onChange={(e) => { setGuestPasswordConfirm(e.target.value); setGuestError(''); }}
                  onKeyDown={(e) => e.key === 'Enter' && handleGuestLogin()}
                  maxLength={30}
                />
              </div>
              {guestError && <p className="error">{guestError}</p>}
              <div className="modal-buttons">
                <button className="secondary-btn" onClick={() => setGuestModal(false)}>취소</button>
                <button className="primary-btn" onClick={handleGuestLogin} disabled={guestLoading}>
                  {guestLoading ? '확인 중...' : '시작하기'}
                </button>
              </div>
            </div>
          </div>
        )}

        {kakaoNicknameModal && pendingKakaoUser && (
          <div className="modal-overlay">
            <div className="modal-content">
              <h3>이름 설정</h3>
              <p style={{ fontSize: '14px', color: '#666', marginBottom: '12px' }}>
                이미 <strong>{pendingKakaoUser.kakaoNickname}</strong>이라는 사용자가 있습니다.<br />사용할 이름을 입력해주세요.
              </p>
              <input
                type="text"
                placeholder="이름 입력"
                value={kakaoNicknameInput}
                onChange={(e) => { setKakaoNicknameInput(e.target.value); setKakaoNicknameError(''); }}
                onKeyDown={(e) => e.key === 'Enter' && handleKakaoNicknameSubmit()}
                maxLength={20}
                autoFocus
              />
              {kakaoNicknameError && <p className="error">{kakaoNicknameError}</p>}
              <div className="modal-buttons">
                <button className="primary-btn" onClick={handleKakaoNicknameSubmit} disabled={kakaoNicknameLoading}>
                  {kakaoNicknameLoading ? '확인 중...' : '확인'}
                </button>
              </div>
            </div>
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
    </div>
  );
}
