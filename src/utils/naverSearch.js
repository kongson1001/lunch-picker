const FUNCTIONS_BASE_URL = import.meta.env.VITE_FIREBASE_FUNCTIONS_URL || '';

export async function searchNearbyRestaurants(lat, lng) {
  const categories = ['맛집', '음식점', '식당', '점심'];
  const allResults = [];
  const seen = new Set();

  for (const category of categories) {
    try {
      const response = await fetch(
        `${FUNCTIONS_BASE_URL}/searchRestaurants?query=${encodeURIComponent(category)}`
      );
      const data = await response.json();
      if (data.items) {
        for (const item of data.items) {
          const cleanName = item.title.replace(/<[^>]*>/g, '');
          if (!seen.has(cleanName)) {
            seen.add(cleanName);
            allResults.push({
              name: cleanName,
              category: item.category,
              address: item.roadAddress || item.address,
              mapx: item.mapx,
              mapy: item.mapy,
              source: 'naver',
            });
          }
        }
      }
    } catch (err) {
      console.error(`검색 실패: ${category}`, err);
    }
  }

  return allResults;
}
