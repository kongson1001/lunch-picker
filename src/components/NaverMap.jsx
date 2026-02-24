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

    new window.naver.maps.Marker({
      position: new window.naver.maps.LatLng(lat, lng),
      map,
      title: '현재 위치',
    });

    markers.forEach((m) => {
      if (m.lat && m.lng) {
        new window.naver.maps.Marker({
          position: new window.naver.maps.LatLng(m.lat, m.lng),
          map,
          title: m.name,
        });
      }
    });
  }, [sdkReady, lat, lng, markers]);

  return (
    <div className="map-container">
      <div ref={mapRef} style={{ width: '100%', height: '300px' }} />
    </div>
  );
}
