'use client';
import { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);
const STORAGE_KEY = 'kakao_user';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pendingKakaoUser, setPendingKakaoUser] = useState(null);
  // { uid, kakaoNickname } — 이름 중복으로 재입력 필요한 카카오 신규 유저

  const fetchUserData = async (uid) => {
    try {
      const res = await fetch(`/api/db/users/${uid}/profile`);
      const data = await res.json();
      return data;
    } catch (err) {
      console.error('사용자 정보 불러오기 실패:', err);
    }
    return null;
  };

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    if (code) {
      window.history.replaceState({}, '', window.location.pathname);
      handleAuthCode(code);
      return;
    }

    const initAuth = async () => {
      const cached = localStorage.getItem(STORAGE_KEY);
      if (cached) {
        try {
          const cachedUser = JSON.parse(cached);
          setUser(cachedUser);

          const sessionRes = await fetch('/api/me');
          if (!sessionRes.ok) {
            setUser(null);
            localStorage.removeItem(STORAGE_KEY);
            setLoading(false);
            return;
          }

          if (!cachedUser.isGuest) {
            const dbData = await fetchUserData(cachedUser.uid);
            if (dbData) {
              const mergedUser = { ...cachedUser, ...dbData };
              setUser(mergedUser);
              localStorage.setItem(STORAGE_KEY, JSON.stringify(mergedUser));
            }
          }
        } catch {
          // 네트워크 오류 시 캐시 유저 유지
        }
      }
      setLoading(false);
    };

    initAuth();
  }, []);

  const handleAuthCode = async (code) => {
    try {
      const redirectUri = window.location.origin;
      const res = await fetch(
        `/api/kakaoAuth?code=${encodeURIComponent(code)}&redirectUri=${encodeURIComponent(redirectUri)}`
      );
      const data = await res.json();

      if (!data.uid) {
        throw new Error(data.error_description || '로그인 실패');
      }

      const dbData = await fetchUserData(data.uid);

      if (!dbData) {
        // 신규 유저 — 이름 중복 검사
        const checkRes = await fetch(
          `/api/checkNickname?nickname=${encodeURIComponent(data.nickname)}&excludeUid=${data.uid}`
        );
        const { available } = await checkRes.json();

        if (!available) {
          // 이름 중복 → 재입력 모달 (page.js에서 처리)
          setPendingKakaoUser({ uid: data.uid, kakaoNickname: data.nickname });
          setLoading(false);
          return;
        }

        // 이름 사용 가능 → 프로필 저장 후 로그인 완료
        await fetch(`/api/db/users/${data.uid}/profile`, {
          method: 'PUT',
          body: JSON.stringify({
            nickname: data.nickname,
            profileImage: null,
            updatedAt: Date.now()
          })
        });

        const kakaoUser = { uid: data.uid, nickname: data.nickname, profileImage: null };
        setUser(kakaoUser);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(kakaoUser));
      } else {
        // 기존 유저 — 저장된 이름 사용
        const kakaoUser = {
          uid: data.uid,
          nickname: dbData.nickname,
          profileImage: dbData.profileImage || null,
        };
        setUser(kakaoUser);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(kakaoUser));
      }
    } catch (err) {
      console.error('카카오 로그인 실패:', err);
    }
    setLoading(false);
  };

  const completeKakaoLogin = async (nickname) => {
    if (!pendingKakaoUser) return;
    const { uid } = pendingKakaoUser;
    await fetch(`/api/db/users/${uid}/profile`, {
      method: 'PUT',
      body: JSON.stringify({ nickname, profileImage: null, updatedAt: Date.now() })
    });
    const kakaoUser = { uid, nickname, profileImage: null };
    setUser(kakaoUser);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(kakaoUser));
    setPendingKakaoUser(null);
  };

  const guestLogin = async (nickname, password, mode = 'register') => {
    const res = await fetch('/api/guestLogin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nickname, password, mode }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || '비로그인 로그인 실패');
    }

    const guestUser = { uid: data.uid, nickname: data.nickname, isGuest: true };
    setUser(guestUser);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(guestUser));
    return guestUser;
  };

  const login = () => {
    const redirectUri = encodeURIComponent(window.location.origin);
    window.location.href = `/api/kakaoLogin?redirectUri=${redirectUri}`;
  };

  const loginAsAdmin = async (adminData) => {
    const dbData = await fetchUserData(adminData.uid);
    const adminUser = {
      ...adminData,
      nickname: dbData?.nickname || adminData.nickname,
      profileImage: dbData?.profileImage || null,
    };
    setUser(adminUser);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(adminUser));
  };

  const logout = async () => {
    await fetch('/api/logout', { method: 'POST' });
    setUser(null);
    localStorage.removeItem(STORAGE_KEY);
  };

  const updateProfile = async (nickname, profileImage) => {
    if (!user) return;
    try {
      // 닉네임이 변경되는 경우에만 중복 검사
      if (nickname !== user.nickname) {
        const checkRes = await fetch(
          `/api/checkNickname?nickname=${encodeURIComponent(nickname)}&excludeUid=${user.uid}`
        );
        const { available } = await checkRes.json();
        if (!available) {
          throw new Error('사용이 불가능한 이름입니다');
        }
      }

      await fetch(`/api/db/users/${user.uid}/profile`, {
        method: 'PATCH',
        body: JSON.stringify({
          nickname,
          profileImage: user.isGuest ? null : profileImage,
          updatedAt: Date.now()
        })
      });

      const updated = { ...user, nickname, profileImage, isAdmin: user.isAdmin };
      setUser(updated);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch (err) {
      console.error('프로필 업데이트 실패:', err);
      throw err;
    }
  };

  return (
    <AuthContext.Provider value={{ user, login, loginAsAdmin, logout, loading, updateProfile, guestLogin, pendingKakaoUser, completeKakaoLogin }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
