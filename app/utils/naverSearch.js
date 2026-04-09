export function reverseGeocodeNaver(lat, lng) {
  return new Promise((resolve) => {
    if (!window.naver || !window.naver.maps || !window.naver.maps.Service) {
      console.warn('Naver Maps Service not loaded');
      resolve('');
      return;
    }

    window.naver.maps.Service.reverseGeocode(
      {
        coords: new window.naver.maps.LatLng(lat, lng),
        orders: [window.naver.maps.Service.OrderType.ADDR],
      },
      (status, response) => {
        if (status !== window.naver.maps.Service.Status.OK) {
          console.warn('역지오코딩 실패:', status);
          resolve('');
          return;
        }

        try {
          const result = response.v2.address;
          const parts = [];
          if (result.jibunAddress) {
            const tokens = result.jibunAddress.split(' ');
            for (const token of tokens) {
              if (token.endsWith('구') || token.endsWith('군') || token.endsWith('시')) {
                if (!token.endsWith('광역시') && !token.endsWith('특별시') && !token.endsWith('도')) {
                  parts.push(token);
                }
              }
              if (token.endsWith('동') || token.endsWith('읍') || token.endsWith('면') || token.endsWith('리')) {
                parts.push(token);
                break;
              }
            }
          }
          const areaName = parts.join(' ');
          console.log('역지오코딩 결과:', areaName || '(지역 못 찾음)');
          resolve(areaName);
        } catch (err) {
          console.error('역지오코딩 파싱 실패:', err);
          resolve('');
        }
      }
    );
  });
}

export async function searchRestaurants(query, lat, lng, noRadius = false) {
  const params = new URLSearchParams({ query });
  if (lat && lng) {
    params.append('x', lng);
    params.append('y', lat);
  }
  if (noRadius) params.append('noRadius', '1');

  const url = `/api/searchRestaurants?${params}`;

  try {
    const response = await fetch(url);
    const data = await response.json();

    if (!data.documents) {
      return [];
    }

    const results = data.documents.map((doc) => ({
      name: doc.place_name,
      category: doc.category_name,
      address: doc.road_address_name || doc.address_name,
      lat: doc.y,
      lng: doc.x,
      distance: doc.distance,
      source: 'search',
    }));
    return results;
  } catch (err) {
    console.error('[검색] 실패:', err);
    return [];
  }
}
