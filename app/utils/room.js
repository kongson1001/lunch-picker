// 클라이언트 SDK를 쓰지 않고 우리 서버 API를 호출합니다.

export function generateRoomId() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export async function createRoom(nickname, location, roomName, uid, password = '') {
  const roomId = generateRoomId();
  const roomData = {
    createdAt: Date.now(),
    createdBy: nickname,
    createdByUid: uid || '',
    roomName: roomName || '',
    status: 'voting',
    location: location,
    menus: {},
    votes: {},
    result: null,
  };
  if (password) {
    roomData.password = password;
  }
  
  await fetch(`/api/db/rooms/${roomId}`, {
    method: 'PUT',
    body: JSON.stringify(roomData)
  });
  
  return roomId;
}

export async function roomExists(roomId) {
  const res = await fetch(`/api/db/rooms/${roomId}`);
  const data = await res.json();
  return !!data;
}

export async function hasRoomPassword(roomId) {
  const res = await fetch(`/api/db/rooms/${roomId}/password`);
  const data = await res.json();
  return !!data;
}

export async function checkRoomPassword(roomId, password) {
  const res = await fetch('/api/checkPassword', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ roomId, password }),
  });
  const data = await res.json();
  return data.success;
}

export async function deleteRoom(roomId) {
  await fetch(`/api/db/rooms/${roomId}`, { method: 'DELETE' });
}

export async function sendMessage(roomId, user, text) {
  await fetch(`/api/db/rooms/${roomId}/messages`, {
    method: 'POST',
    body: JSON.stringify({
      uid: user.uid,
      nickname: user.nickname,
      profileImage: user.profileImage || null,
      text: text.trim(),
    })
  });
}

export function onRoomList(callback) {
  // 실시간 구독(onValue) 대신 정기적인 Fetch로 대체 (보안 우선)
  const fetchList = async () => {
    const res = await fetch('/api/db/rooms');
    const data = await res.json();
    if (!data) {
      callback([]);
      return;
    }
    const rooms = Object.entries(data).map(([id, room]) => ({
      id,
      ...room,
      hasPassword: !!room.password
    }));
    callback(rooms);
  };

  fetchList();
  const interval = setInterval(fetchList, 5000); // 5초마다 갱신
  return () => clearInterval(interval);
}
