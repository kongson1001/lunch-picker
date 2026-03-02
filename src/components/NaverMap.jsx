import { useEffect, useRef, useState } from 'react';

function loadNaverMapsSDK() {
  return new Promise((resolve, reject) => {
    if (window.naver && window.naver.maps) {
      resolve();
      return;
    }
    const clientId = import.meta.env.VITE_NAVER_MAPS_CLIENT_ID;
    if (!clientId) {
      reject(new Error('VITE_NAVER_MAPS_CLIENT_ID not set'));
      return;
    }
    const script = document.createElement('script');
    script.src = `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${clientId}&submodules=geocoder`;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Naver Maps SDK'));
    document.head.appendChild(script);
  });
}

export default function NaverMap({ lat, lng, markers = [], onReady }) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const currentMarkerRef = useRef(null);
  const searchMarkersRef = useRef([]);
  const [sdkReady, setSdkReady] = useState(false);

  useEffect(() => {
    loadNaverMapsSDK()
      .then(() => {
        setSdkReady(true);
        if (onReady) onReady();
      })
      .catch((err) => console.error(err));
  }, []);

  // 맵 최초 생성 (sdkReady 시 한 번만)
  useEffect(() => {
    if (!sdkReady || !mapRef.current) return;

    const map = new window.naver.maps.Map(mapRef.current, {
      center: new window.naver.maps.LatLng(lat, lng),
      zoom: 15,
    });
    mapInstanceRef.current = map;

    currentMarkerRef.current = new window.naver.maps.Marker({
      position: new window.naver.maps.LatLng(lat, lng),
      map,
      title: '현재 위치',
    });
  }, [sdkReady]);

  // lat/lng 변경 시 맵 중심 이동 (재생성 없이)
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    const newCenter = new window.naver.maps.LatLng(lat, lng);
    mapInstanceRef.current.setCenter(newCenter);

    if (currentMarkerRef.current) {
      currentMarkerRef.current.setPosition(newCenter);
    }
  }, [lat, lng]);

  // 검색 마커 업데이트
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    // 기존 검색 마커 제거
    searchMarkersRef.current.forEach((m) => m.setMap(null));
    searchMarkersRef.current = [];

    markers.forEach((m) => {
      if (m.lat && m.lng) {
        const marker = new window.naver.maps.Marker({
          position: new window.naver.maps.LatLng(m.lat, m.lng),
          map: mapInstanceRef.current,
          title: m.name,
        });
        window.naver.maps.Event.addListener(marker, 'click', () => {
          const query = encodeURIComponent(m.name);
          window.open(`https://map.naver.com/v5/search/${query}`, '_blank');
        });
        searchMarkersRef.current.push(marker);
      }
    });
  }, [markers]);

  return (
    <div className="map-container">
      <div ref={mapRef} style={{ width: '100%', height: '300px' }} />
    </div>
  );
}
