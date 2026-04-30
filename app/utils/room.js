// 클라이언트 SDK를 쓰지 않고 우리 서버 API를 호출합니다.

export function generateRoomId() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export async function createRoom(nickname, location, roomName, uid, password = '', roomType = 'lunch', options = {}) {
  const roomId = generateRoomId();
  const roomData = {
    createdAt: Date.now(),
    createdBy: nickname,
    createdByUid: uid || '',
    roomName: roomName || '',
    roomType,
    status: 'voting',
    location: location,
    menus: {},
    votes: {},
    schedules: {},
    scheduleVotes: {},
    result: null,
    anonymousVote: options.anonymousVote ?? false,
    hideVoteCount: options.hideVoteCount ?? false,
  };
  if (password) {
    roomData.password = password;
  }

  const res = await fetch(`/api/db/rooms/${roomId}`, {
    method: 'PUT',
    body: JSON.stringify(roomData)
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || '방 생성에 실패했습니다');
  }

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

export function hasOtherParticipants(room, creatorUid) {
  const votes = room.votes || {};
  return Object.keys(votes).some((uid) => uid !== creatorUid);
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

export async function deleteMessage(roomId, messageId) {
  await fetch(`/api/db/rooms/${roomId}/messages/${messageId}`, { method: 'DELETE' });
}

export async function editMessage(roomId, messageId, newText) {
  await fetch(`/api/db/rooms/${roomId}/messages/${messageId}`, {
    method: 'PATCH',
    body: JSON.stringify({ 
      text: newText,
      updatedAt: Date.now()
    })
  });
}

export async function toggleReaction(roomId, messageId, emoji, user) {
  // 반응 기능은 서버 사이드 API 확장이 필요하므로 현재는 뼈대만 유지합니다.
  console.warn('반응 기능은 현재 서버 API에서 준비 중입니다.');
}

export function onRoomList(callback) {
  const fetchList = async () => {
    try {
      const res = await fetch('/api/db/rooms');
      if (!res.ok) { callback([]); return; }
      const data = await res.json();
      if (!data) { callback([]); return; }
      const rooms = Object.entries(data)
        .map(([id, room]) => ({ id, ...room, hasPassword: !!room.password }))
        .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      callback(rooms);
    } catch (err) {
      console.error('방 목록 불러오기 실패:', err);
    }
  };

  fetchList();
  const es = new EventSource('/api/sse?channel=rooms');
  es.onmessage = () => fetchList();
  es.onerror = () => {};
  return () => es.close();
}
