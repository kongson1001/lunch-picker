'use client';
import { useEffect, useRef, useState } from 'react';

async function loadNaverMapsSDK() {
  if (window.naver && window.naver.maps) return;

  // 서버 API로부터 클라이언트 ID를 동적으로 가져옴
  const res = await fetch('/api/naverConfig');
  const { clientId } = await res.json();

  if (!clientId) throw new Error('Naver Maps Client ID not found');

  return new Promise((resolve, reject) => {
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

  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const newCenter = new window.naver.maps.LatLng(lat, lng);
    mapInstanceRef.current.setCenter(newCenter);
    if (currentMarkerRef.current) currentMarkerRef.current.setPosition(newCenter);
  }, [lat, lng]);

  useEffect(() => {
    if (!mapInstanceRef.current) return;
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
