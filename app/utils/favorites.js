// 즐겨찾기 로직 (API 기반)

export const addFavorite = async (userId, restaurant) => {
  if (!userId) return;
  const rawName = restaurant.name || restaurant.title || '알 수 없는 식당';
  const cleanName = rawName.replace(/<[^>]*>?/gm, '');
  const favId = restaurant.id || cleanName;
  
  await fetch(`/api/db/users/${userId}/favorites/${favId}`, {
    method: 'PUT',
    body: JSON.stringify({
      ...restaurant,
      name: cleanName,
      addedAt: Date.now()
    })
  });
};

export const removeFavorite = async (userId, restaurantId) => {
  if (!userId) return;
  await fetch(`/api/db/users/${userId}/favorites/${restaurantId}`, { method: 'DELETE' });
};

export const getFavorites = async (userId) => {
  if (!userId) return [];
  const res = await fetch(`/api/db/users/${userId}/favorites`);
  const data = await res.json();
  if (!data) return [];
  return Object.entries(data)
    .map(([id, value]) => ({ id, ...value }))
    .sort((a, b) => b.addedAt - a.addedAt);
};
