import { db, ref, set, push, get, onValue, remove } from '../firebase';

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
  const roomRef = ref(db, `rooms/${roomId}`);
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
  await set(roomRef, roomData);
  return roomId;
}

export async function checkRoomPassword(roomId, password) {
  try {
    const res = await fetch('/api/checkPassword', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomId, password }),
    });
    const data = await res.json();
    return data.success;
  } catch (err) {
    console.error('Password check failed:', err);
    return false;
  }
}

export async function hasRoomPassword(roomId) {
  const snapshot = await get(ref(db, `rooms/${roomId}/password`));
  return !!snapshot.val();
}

export async function roomExists(roomId) {
  const roomRef = ref(db, `rooms/${roomId}`);
  const snapshot = await get(roomRef);
  return snapshot.exists();
}

// 방장 외 다른 사람이 투표(참여)했으면 true
export function hasOtherParticipants(room, creatorUid) {
  const votes = room.votes || {};
  return Object.keys(votes).some((uid) => uid !== creatorUid);
}

export async function deleteRoom(roomId) {
  await remove(ref(db, `rooms/${roomId}`));
}

export async function sendMessage(roomId, user, text) {
  const messagesRef = ref(db, `rooms/${roomId}/messages`);
  const newRef = push(messagesRef);
  await set(newRef, {
    uid: user.uid,
    nickname: user.nickname,
    profileImage: user.profileImage || null,
    text: text.trim(),
    createdAt: Date.now(),
  });
}

export async function deleteMessage(roomId, messageId) {
  await remove(ref(db, `rooms/${roomId}/messages/${messageId}`));
}

export async function toggleReaction(roomId, messageId, emoji, user) {
  const reactionRef = ref(db, `rooms/${roomId}/messages/${messageId}/reactions/${emoji}/${user.uid}`);
  const snapshot = await get(reactionRef);
  
  if (snapshot.exists()) {
    // 이미 해당 이모지를 눌렀다면 제거
    await remove(reactionRef);
  } else {
    // 새로 누르는 것이라면 닉네임과 함께 저장
    await set(reactionRef, {
      nickname: user.nickname,
      timestamp: Date.now()
    });
  }
}

export function onRoomList(callback) {
  const roomsRef = ref(db, 'rooms');
  return onValue(roomsRef, (snapshot) => {
    const data = snapshot.val();
    if (!data) {
      callback([]);
      return;
    }
    const rooms = Object.entries(data).map(([id, room]) => {
      const roomInfo = {
        id,
        ...room,
        hasPassword: !!room.password
      };
      delete roomInfo.password; // 클라이언트에 비밀번호가 전달되지 않도록 명시적 삭제
      return roomInfo;
    });
    callback(rooms);
  });
}
