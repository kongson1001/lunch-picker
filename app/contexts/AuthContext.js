'use client';
import { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);
const STORAGE_KEY = 'kakao_user';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

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
    // 카카오 SDK 초기화 코드 완전 삭제 (서버 사이드 REST API 방식으로 대체됨)

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
          const dbData = await fetchUserData(cachedUser.uid);
          if (dbData) {
            const mergedUser = { ...cachedUser, ...dbData };
            setUser(mergedUser);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(mergedUser));
          } else {
            setUser(cachedUser);
          }
        } catch {
          localStorage.removeItem(STORAGE_KEY);
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

      if (!data.access_token) {
        throw new Error(data.error_description || '토큰 발급 실패');
      }

      const userRes = await fetch('https://kapi.kakao.com/v2/user/me', {
        headers: { Authorization: `Bearer ${data.access_token}` },
      });
      const userData = await userRes.json();
      const uid = `kakao_${userData.id}`;

      const dbData = await fetchUserData(uid);
      
      const kakaoUser = {
        uid,
        nickname: dbData?.nickname || userData.kakao_account?.profile?.nickname || `사용자${userData.id}`,
        profileImage: dbData?.profileImage || null,
      };

      if (!dbData) {
        await fetch(`/api/db/users/${uid}/profile`, {
          method: 'PUT',
          body: JSON.stringify({
            nickname: kakaoUser.nickname,
            profileImage: kakaoUser.profileImage,
            updatedAt: Date.now()
          })
        });
      }

      setUser(kakaoUser);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(kakaoUser));
    } catch (err) {
      console.error('카카오 로그인 실패:', err);
    }
    setLoading(false);
  };

  const login = () => {
    const redirectUri = encodeURIComponent(window.location.origin);
    // 서버 API로 리다이렉트 (키는 서버에서 처리)
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

  const logout = () => {
    setUser(null);
    localStorage.removeItem(STORAGE_KEY);
  };

  const updateProfile = async (nickname, profileImage) => {
    if (!user) return;
    try {
      await fetch(`/api/db/users/${user.uid}/profile`, {
        method: 'PATCH',
        body: JSON.stringify({ nickname, profileImage, updatedAt: Date.now() })
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
    <AuthContext.Provider value={{ user, login, loginAsAdmin, logout, loading, updateProfile }}>
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
