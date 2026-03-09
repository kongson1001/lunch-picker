import { db, ref, set, get, remove } from '../firebase';

export const addFavorite = async (userId, restaurant) => {
  if (!userId) return;
  
  const rawName = restaurant.name || restaurant.title || '알 수 없는 식당';
  const cleanName = rawName.replace(/<[^>]*>?/gm, '');
  
  const favId = restaurant.id || cleanName;
  
  const cleanedRestaurant = JSON.parse(JSON.stringify(restaurant));
  
  const favRef = ref(db, `users/${userId}/favorites/${favId}`);
  
  await set(favRef, {
    ...cleanedRestaurant,
    name: cleanName,
    addedAt: Date.now()
  });
};

export const removeFavorite = async (userId, restaurantId) => {
  if (!userId) return;
  
  const favRef = ref(db, `users/${userId}/favorites/${restaurantId}`);
  await remove(favRef);
};

export const getFavorites = async (userId) => {
  if (!userId) return [];
  
  const favsRef = ref(db, `users/${userId}/favorites`);
  const snapshot = await get(favsRef);
  
  if (!snapshot.exists()) return [];
  
  const data = snapshot.val();
  return Object.entries(data)
    .map(([id, value]) => ({
      id,
      ...value
    }))
    .sort((a, b) => b.addedAt - a.addedAt);
};
