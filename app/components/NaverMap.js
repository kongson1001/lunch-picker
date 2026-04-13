'use client';
import { useEffect, useRef, useState } from 'react';

async function loadNaverMapsSDK() {
  if (window.naver && window.naver.maps) return;

  const res = await fetch('/api/naverConfig');
  const { naverClientId: clientId } = await res.json();

  if (!clientId) throw new Error('Naver Maps Client ID not found');

  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${clientId}&submodules=geocoder`;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Naver Maps SDK'));
    document.head.appendChild(script);
  });
}

export default function NaverMap({ lat, lng, markers = [], menuMarkers = [], onReady }) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const currentMarkerRef = useRef(null);
  const searchMarkersRef = useRef([]);
  const menuMarkersRef = useRef([]);
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
    markers.forEach((m, index) => {
      if (m.lat && m.lng) {
        const num = index + 1;
        const marker = new window.naver.maps.Marker({
          position: new window.naver.maps.LatLng(m.lat, m.lng),
          map: mapInstanceRef.current,
          icon: {
            content: `
              <div style="display:flex;flex-direction:column;align-items:center;cursor:pointer;">
                <div style="background:white;border:1px solid #ddd;border-radius:6px;padding:3px 7px;font-size:11px;font-weight:600;white-space:nowrap;max-width:120px;overflow:hidden;text-overflow:ellipsis;box-shadow:0 1px 4px rgba(0,0,0,0.2);margin-bottom:4px;color:#333;">${num}. ${m.name}</div>
                <div style="background:#ff5722;color:white;width:22px;height:22px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:bold;box-shadow:0 2px 4px rgba(0,0,0,0.3);">${num}</div>
                <div style="width:2px;height:6px;background:#ff5722;"></div>
              </div>`,
            anchor: new window.naver.maps.Point(11, 54),
          },
        });
        window.naver.maps.Event.addListener(marker, 'click', () => {
          const query = encodeURIComponent(m.name);
          window.open(`https://map.naver.com/v5/search/${query}`, '_blank');
        });
        searchMarkersRef.current.push(marker);
      }
    });
  }, [markers]);

  useEffect(() => {
    if (!mapInstanceRef.current) return;
    menuMarkersRef.current.forEach((m) => m.setMap(null));
    menuMarkersRef.current = [];
    menuMarkers.forEach((m, index) => {
      if (m.lat && m.lng) {
        const num = index + 1;
        const marker = new window.naver.maps.Marker({
          position: new window.naver.maps.LatLng(m.lat, m.lng),
          map: mapInstanceRef.current,
          icon: {
            content: `
              <div style="display:flex;flex-direction:column;align-items:center;cursor:pointer;">
                <div style="background:white;border:1px solid #ddd;border-radius:6px;padding:3px 7px;font-size:11px;font-weight:600;white-space:nowrap;max-width:120px;overflow:hidden;text-overflow:ellipsis;box-shadow:0 1px 4px rgba(0,0,0,0.2);margin-bottom:4px;color:#333;">${num}. ${m.name}</div>
                <div style="background:#1976d2;color:white;width:22px;height:22px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:bold;box-shadow:0 2px 4px rgba(0,0,0,0.3);">${num}</div>
                <div style="width:2px;height:6px;background:#1976d2;"></div>
              </div>`,
            anchor: new window.naver.maps.Point(11, 54),
          },
        });
        window.naver.maps.Event.addListener(marker, 'click', () => {
          const query = encodeURIComponent(m.name);
          window.open(`https://map.naver.com/v5/search/${query}`, '_blank');
        });
        menuMarkersRef.current.push(marker);
      }
    });
  }, [menuMarkers]);

  return (
    <div className="map-container" style={{ height: '100%' }}>
      <div ref={mapRef} style={{ width: '100%', height: '100%' }} />
    </div>
  );
}
