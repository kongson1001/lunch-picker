import { db, ref, set, get, remove, push } from '../firebase';

// 즐겨찾기 추가
export const addFavorite = async (userId, restaurant) => {
  if (!userId) return;
  
  // 식당 이름 추출 (name 또는 title 필드 중 있는 것 사용, HTML 태그 제거)
  const rawName = restaurant.name || restaurant.title || '알 수 없는 식당';
  const cleanName = rawName.replace(/<[^>]*>?/gm, '');
  
  // ID가 없으면 정제된 이름을 ID로 사용
  const favId = restaurant.id || cleanName;
  
  // Realtime Database는 undefined를 허용하지 않으므로 데이터 정제
  const cleanedRestaurant = JSON.parse(JSON.stringify(restaurant));
  
  // Realtime Database 경로: users/{userId}/favorites/{favId}
  const favRef = ref(db, `users/${userId}/favorites/${favId}`);
  
  await set(favRef, {
    ...cleanedRestaurant,
    name: cleanName,
    addedAt: Date.now()
  });
};

// 즐겨찾기 삭제
export const removeFavorite = async (userId, restaurantId) => {
  if (!userId) return;
  
  // Realtime Database 경로: users/{userId}/favorites/{restaurantId}
  const favRef = ref(db, `users/${userId}/favorites/${restaurantId}`);
  await remove(favRef);
};

// 즐겨찾기 목록 가져오기
export const getFavorites = async (userId) => {
  if (!userId) return [];
  
  const favsRef = ref(db, `users/${userId}/favorites`);
  const snapshot = await get(favsRef);
  
  if (!snapshot.exists()) return [];
  
  const data = snapshot.val();
  // 객체 형태의 데이터를 배열로 변환하고 최신순으로 정렬
  return Object.entries(data)
    .map(([id, value]) => ({
      id,
      ...value
    }))
    .sort((a, b) => b.addedAt - a.addedAt);
};
