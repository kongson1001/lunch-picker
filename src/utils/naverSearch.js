function getAreaName(lat, lng) {
  return new Promise((resolve) => {
    if (!window.naver || !window.naver.maps || !window.naver.maps.Service) {
      resolve('');
      return;
    }

    window.naver.maps.Service.reverseGeocode(
      {
        coords: new window.naver.maps.LatLng(lat, lng),
        orders: 'addr',
      },
      (status, response) => {
        if (status !== window.naver.maps.Service.Status.OK) {
          resolve('');
          return;
        }
        const result = response.v2.address;
        if (result) {
          // "서울특별시 강남구 역삼동" → "강남구 역삼동"
          const area = [result.jibunAddress || '']
            .map((addr) => {
              const parts = addr.split(' ');
              // 시/도 제외하고 구/동 부분 사용
              if (parts.length >= 3) return parts.slice(1, 3).join(' ');
              if (parts.length >= 2) return parts.slice(1).join(' ');
              return addr;
            })[0];
          resolve(area);
        } else {
          resolve('');
        }
      }
    );
  });
}

export async function searchNearbyRestaurants(lat, lng) {
  // 현재 위치의 동네 이름을 먼저 가져옴
  const areaName = await getAreaName(lat, lng);

  const categories = ['맛집', '음식점', '식당', '점심'];
  const allResults = [];
  const seen = new Set();

  for (const category of categories) {
    // "강남구 역삼동 맛집" 형태로 검색
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
