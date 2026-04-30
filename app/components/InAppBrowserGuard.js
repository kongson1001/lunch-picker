'use client';
import { useEffect, useState } from 'react';

function detectInAppBrowser() {
  const ua = navigator.userAgent;
  if (/KAKAOTALK/i.test(ua)) return 'kakaotalk';
  if (/NAVER/i.test(ua) && !/NaverBot/i.test(ua)) return 'naver';
  if (/Line\//i.test(ua)) return 'line';
  if (/Instagram/i.test(ua)) return 'instagram';
  return null;
}

function getExternalBrowserUrl() {
  const url = encodeURIComponent(window.location.href);
  const ua = navigator.userAgent;
  // iOS는 intent 스킴 미지원 → intent 없이 안내만
  if (/iPhone|iPad|iPod/i.test(ua)) return null;
  // Android: Chrome으로 강제 오픈
  return `intent://${window.location.host}${window.location.pathname}${window.location.search}#Intent;scheme=${window.location.protocol.replace(':', '')};package=com.android.chrome;end`;
}

export default function InAppBrowserGuard() {
  const [browserType, setBrowserType] = useState(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const type = detectInAppBrowser();
    if (type) setBrowserType(type);
  }, []);

  if (!browserType || dismissed) return null;

  const labels = {
    kakaotalk: '카카오톡',
    naver: '네이버',
    line: '라인',
    instagram: '인스타그램',
  };

  const externalUrl = getExternalBrowserUrl();

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999,
      background: '#ff6b35', color: '#fff', padding: '12px 16px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      fontSize: '14px', boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
    }}>
      <span>
        {labels[browserType]} 앱에서는 로그인이 불안정할 수 있어요.
        {externalUrl ? ' Chrome으로 여는 것을 권장합니다.' : ' Safari 또는 Chrome에서 열어주세요.'}
      </span>
      <div style={{ display: 'flex', gap: '8px', marginLeft: '12px', flexShrink: 0 }}>
        {externalUrl && (
          <a
            href={externalUrl}
            style={{
              background: '#fff', color: '#ff6b35', padding: '4px 10px',
              borderRadius: '4px', fontWeight: 'bold', textDecoration: 'none', fontSize: '13px',
            }}
          >
            Chrome으로 열기
          </a>
        )}
        <button
          onClick={() => setDismissed(true)}
          style={{
            background: 'transparent', border: '1px solid rgba(255,255,255,0.6)',
            color: '#fff', padding: '4px 8px', borderRadius: '4px',
            cursor: 'pointer', fontSize: '13px',
          }}
        >
          닫기
        </button>
      </div>
    </div>
  );
}
