'use client';
import { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);
const STORAGE_KEY = 'kakao_user';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Database API를 통해 사용자 정보 가져오기
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
    // 카카오 SDK 초기화 (서버에서 키를 받아옴)
    const initKakao = async () => {
      if (typeof window !== 'undefined' && window.Kakao && !window.Kakao.isInitialized()) {
        const res = await fetch('/api/naverConfig'); // 범용 설정 API로 활용 (실제로는 카카오 키도 서버에서 관리 가능)
        // 실제로는 카카오 JS Key는 노출이 불가피한 경우가 많지만, 서버 API로 리다이렉트하는 방식을 이미 적용했으므로
        // SDK 초기화용 키도 별도의 설정 API를 만들어 관리하는 것이 좋습니다.
        // 여기서는 기존 API 설계를 확장하여 처리합니다.
      }
    };

    // 카카오 로그인 리다이렉트 후 code 처리
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
        body: JSON.stringify({
          nickname,
          profileImage,
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
