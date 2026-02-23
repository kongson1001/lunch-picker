import { db, ref, set, push, get } from '../firebase';

export function generateRoomId() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export async function createRoom(nickname, location) {
  const roomId = generateRoomId();
  const roomRef = ref(db, `rooms/${roomId}`);
  await set(roomRef, {
    createdAt: Date.now(),
    createdBy: nickname,
    status: 'voting',
    location: location,
    menus: {},
    votes: {},
    result: null,
  });
  return roomId;
}

export async function roomExists(roomId) {
  const roomRef = ref(db, `rooms/${roomId}`);
  const snapshot = await get(roomRef);
  return snapshot.exists();
}
