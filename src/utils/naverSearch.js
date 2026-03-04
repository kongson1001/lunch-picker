/**
 * 네이버 Maps SDK reverseGeocode를 사용하여 좌표 → 동네 이름 변환
 * SDK가 이미 로드된 상태에서 호출해야 함 (NaverMap 컴포넌트의 onReady 이후)
 */
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
            // "대전광역시 유성구 봉명동 123" → "유성구 봉명동"
            const tokens = result.jibunAddress.split(' ');
            // 시/도 제외, 구/군 + 동/읍/면 추출
            for (const token of tokens) {
              if (token.endsWith('구') || token.endsWith('군') || token.endsWith('시')) {
                // 광역시/도 수준은 건너뛰고, 구/군 수준만 포함
                if (!token.endsWith('광역시') && !token.endsWith('특별시') && !token.endsWith('도')) {
                  parts.push(token);
                }
              }
              if (token.endsWith('동') || token.endsWith('읍') || token.endsWith('면') || token.endsWith('리')) {
                parts.push(token);
                break; // 동까지만
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

/**
 * 카카오 로컬 검색 API로 음식점 검색
 * @param {string} query - 사용자 입력 검색어 (예: "파스타")
 * @param {number} lat - 위도
 * @param {number} lng - 경도
 * @returns {Promise<Array>} 검색 결과 (최대 15개)
 */
export async function searchRestaurants(query, lat, lng) {
  const params = new URLSearchParams({ query });
  if (lat && lng) {
    params.append('x', lng); // 카카오: x=경도, y=위도
    params.append('y', lat);
  }

  const url = `/api/searchRestaurants?${params}`;
  console.log('[검색] 요청 URL:', url);
  console.log('[검색] 파라미터:', { query, lat, lng });

  try {
    const response = await fetch(url);
    console.log('[검색] 응답 상태:', response.status, response.statusText);

    const data = await response.json();
    console.log('[검색] 응답 데이터:', data);

    if (!data.documents) {
      console.warn('[검색] documents 없음. 전체 응답:', data);
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
    console.log('[검색] 파싱 결과:', results);
    return results;
  } catch (err) {
    console.error('[검색] 실패:', err);
    return [];
  }
}
