'use client';
import { useEffect, useState } from 'react';

const HIDE_UNTIL_KEY = 'installPromptHideUntil';
const INSTALLED_KEY  = 'pwaInstalled';

function isMobile() {
  return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
}

function isStandalone() {
  // 현재 PWA/standalone 모드로 실행 중인지 실시간 감지
  if (window.navigator.standalone === true) return true;
  if (window.matchMedia('(display-mode: standalone)').matches) return true;
  if (window.matchMedia('(display-mode: fullscreen)').matches) return true;
  if (document.referrer.startsWith('android-app://')) return true;
  return false;
}

function shouldSkip() {
  if (isStandalone()) return true;
  return false;
}

function isInstalledInBrowser() {
  // 설치는 했지만 브라우저로 접속 중
  return !!localStorage.getItem(INSTALLED_KEY) && !isStandalone();
}

function isHiddenByUser() {
  const until = localStorage.getItem(HIDE_UNTIL_KEY);
  return until ? Date.now() < Number(until) : false;
}

function isIOS() {
  return /iPhone|iPad|iPod/i.test(navigator.userAgent);
}

function isInAppBrowser() {
  return /KAKAOTALK|NAVER|Line\/|Instagram/i.test(navigator.userAgent);
}

function getChromeIntentUrl() {
  if (/iPhone|iPad|iPod/i.test(navigator.userAgent)) return null;
  const { host, pathname, search, protocol } = window.location;
  return `intent://${host}${pathname}${search}#Intent;scheme=${protocol.replace(':', '')};package=com.android.chrome;end`;
}

function markInstalled() {
  localStorage.setItem(INSTALLED_KEY, '1');
}

// iOS 안내 모달
function IOSGuide({ onClose, onInstalled }) {
  return (
    <div className="install-ios-overlay" onClick={onClose}>
      <div className="install-ios-modal" onClick={e => e.stopPropagation()}>
        <button className="install-ios-close" onClick={onClose}>✕</button>
        <h3 className="install-ios-title">홈 화면에 추가하기</h3>
        <ol className="install-ios-steps">
          <li>
            <span className="install-ios-step-icon">1</span>
            Safari 하단 공유 버튼을 누르세요
            <div className="install-ios-share-icon">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#e85d26" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
                <polyline points="16 6 12 2 8 6"/>
                <line x1="12" y1="2" x2="12" y2="15"/>
              </svg>
            </div>
          </li>
          <li>
            <span className="install-ios-step-icon">2</span>
            스크롤해서 <strong>"홈 화면에 추가"</strong>를 누르세요
          </li>
          <li>
            <span className="install-ios-step-icon">3</span>
            오른쪽 상단 <strong>"추가"</strong>를 누르면 완료!
          </li>
        </ol>
        <button className="install-ios-done-btn" onClick={onInstalled}>
          설치 완료
        </button>
      </div>
    </div>
  );
}

export default function InstallPrompt({ loggedIn }) {
  const [visible, setVisible] = useState(false);
  const [openInApp, setOpenInApp] = useState(false); // 설치됨 + 브라우저 접속
  const [skipped] = useState(() =>
    typeof window !== 'undefined' && (shouldSkip() || isHiddenByUser())
  );
  const [noShowMonth, setNoShowMonth]   = useState(false);
  const [ios, setIos]                   = useState(false);
  const [hasNativePrompt, setHasNativePrompt] = useState(false);
  const [inApp, setInApp]               = useState(false);
  const [chromeIntentUrl, setChromeIntentUrl] = useState(null);
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  useEffect(() => {
    // standalone으로 실행 중이면 설치 플래그 자동 저장
    if (isStandalone()) markInstalled();

    // 설치 완료 이벤트 (Android Chrome)
    const onInstalled = () => { markInstalled(); setVisible(false); };
    window.addEventListener('appinstalled', onInstalled);
    return () => window.removeEventListener('appinstalled', onInstalled);
  }, []);

  useEffect(() => {
    if (!loggedIn) return;
    if (!isMobile()) return;
    if (shouldSkip()) return;
    if (isHiddenByUser()) return;

    if (isInstalledInBrowser()) {
      const timer = setTimeout(() => setOpenInApp(true), 1500);
      return () => clearTimeout(timer);
    }

    setIos(isIOS());
    setInApp(isInAppBrowser());
    setChromeIntentUrl(getChromeIntentUrl());

    if (window._installPrompt) setHasNativePrompt(true);
    const handler = () => setHasNativePrompt(true);
    window.addEventListener('beforeinstallprompt', handler);

    const timer = setTimeout(() => setVisible(true), 1500);
    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      clearTimeout(timer);
    };
  }, [loggedIn]);

  const dismiss = () => {
    if (noShowMonth) {
      localStorage.setItem(HIDE_UNTIL_KEY, String(Date.now() + 30 * 24 * 60 * 60 * 1000));
    }
    setVisible(false);
  };

  const handleInstall = async () => {
    const prompt = window._installPrompt;
    if (prompt) {
      prompt.prompt();
      const { outcome } = await prompt.userChoice;
      window._installPrompt = null;
      if (outcome === 'accepted') {
        markInstalled();
        setVisible(false);
        return;
      }
    }
    dismiss();
  };

  const handleIOSInstalled = () => {
    markInstalled();
    setShowIOSGuide(false);
    setVisible(false);
  };

  if (skipped) return null;

  if (openInApp) return (
    <div className="install-prompt">
      <div className="install-prompt-inner">
        <div className="install-prompt-text">
          <span className="install-prompt-icon">🏠</span>
          <div>
            <strong>설치된 앱으로 접속하시겠습니까?</strong>
            <p className="install-prompt-sub">홈 화면의 앱 아이콘으로 실행해주세요</p>
          </div>
        </div>
        <button className="install-prompt-close" onClick={() => setOpenInApp(false)}>✕</button>
      </div>
    </div>
  );

  if (!visible) return null;

  return (
    <>
      {showIOSGuide && (
        <IOSGuide
          onClose={() => setShowIOSGuide(false)}
          onInstalled={handleIOSInstalled}
        />
      )}
      <div className="install-prompt">
        <div className="install-prompt-inner">
          <div className="install-prompt-text">
            <span className="install-prompt-icon">📱</span>
            <div>
              <strong>바로가기를 만드시겠습니까?</strong>
              {inApp ? (
                <p className="install-prompt-sub">Chrome에서 열면 바로가기를 추가할 수 있어요</p>
              ) : ios ? (
                <p className="install-prompt-sub">Safari 공유(⎙) → 홈 화면에 추가</p>
              ) : !hasNativePrompt ? (
                <p className="install-prompt-sub">브라우저 메뉴(⋮) → 홈 화면에 추가</p>
              ) : null}
            </div>
          </div>
          <div className="install-prompt-actions">
            {inApp && chromeIntentUrl ? (
              <a className="install-prompt-btn" href={chromeIntentUrl}>Chrome으로 열기</a>
            ) : ios ? (
              <button className="install-prompt-btn" onClick={() => setShowIOSGuide(true)}>추가하기</button>
            ) : hasNativePrompt ? (
              <button className="install-prompt-btn" onClick={handleInstall}>추가하기</button>
            ) : null}
            <button className="install-prompt-close" onClick={dismiss}>✕</button>
          </div>
        </div>
        <label className="install-prompt-noshowlabel">
          <input
            type="checkbox"
            checked={noShowMonth}
            onChange={e => setNoShowMonth(e.target.checked)}
          />
          한달동안 안보이기
        </label>
      </div>
    </>
  );
}
