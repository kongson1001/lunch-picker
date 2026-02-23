async function getAreaName(lat, lng) {
  try {
    // OpenStreetMap Nominatim (무료, 키 불필요)
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=ko&zoom=16`
    );
    const data = await response.json();

    if (data.address) {
      // 구 + 동 조합 (예: "유성구 봉명동", "강남구 역삼동")
      const parts = [];
      if (data.address.city_district) parts.push(data.address.city_district);
      else if (data.address.borough) parts.push(data.address.borough);
      else if (data.address.county) parts.push(data.address.county);

      if (data.address.neighbourhood) parts.push(data.address.neighbourhood);
      else if (data.address.quarter) parts.push(data.address.quarter);
      else if (data.address.suburb) parts.push(data.address.suburb);

      if (parts.length > 0) return parts.join(' ');

      // fallback: city만이라도
      if (data.address.city) return data.address.city;
    }
    return '';
  } catch (err) {
    console.error('역지오코딩 실패:', err);
    return '';
  }
}

export async function searchNearbyRestaurants(lat, lng) {
  const areaName = await getAreaName(lat, lng);
  console.log('검색 지역:', areaName || '(지역 못 찾음)');

  const categories = ['맛집', '음식점', '식당', '점심'];
  const allResults = [];
  const seen = new Set();

  for (const category of categories) {
    const searchQuery = areaName ? `${areaName} ${category}` : category;
    try {
      const response = await fetch(
        `/api/searchRestaurants?query=${encodeURIComponent(searchQuery)}`
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
      console.error(`검색 실패: ${searchQuery}`, err);
    }
  }

  return allResults;
}
