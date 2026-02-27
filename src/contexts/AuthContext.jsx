import { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

const STORAGE_KEY = 'kakao_user';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // localStorage에서 캐시된 유저 정보 복원
    const cached = localStorage.getItem(STORAGE_KEY);
    if (cached) {
      try {
        setUser(JSON.parse(cached));
      } catch {
        localStorage.removeItem(STORAGE_KEY);
      }
    }

    // 카카오 SDK 초기화
    const jsKey = import.meta.env.VITE_KAKAO_JS_KEY;
    if (window.Kakao && !window.Kakao.isInitialized()) {
      window.Kakao.init(jsKey);
    }

    setLoading(false);
  }, []);

  const login = () => {
    return new Promise((resolve, reject) => {
      if (!window.Kakao) {
        reject(new Error('카카오 SDK가 로드되지 않았습니다'));
        return;
      }

      window.Kakao.Auth.login({
        success: () => {
          window.Kakao.API.request({
            url: '/v2/user/me',
            success: (res) => {
              const kakaoUser = {
                uid: `kakao_${res.id}`,
                nickname: res.kakao_account?.profile?.nickname || `사용자${res.id}`,
                profileImage: res.kakao_account?.profile?.profile_image_url || null,
              };
              setUser(kakaoUser);
              localStorage.setItem(STORAGE_KEY, JSON.stringify(kakaoUser));
              resolve(kakaoUser);
            },
            fail: (err) => {
              reject(err);
            },
          });
        },
        fail: (err) => {
          reject(err);
        },
      });
    });
  };

  const logout = () => {
    if (window.Kakao?.Auth?.getAccessToken()) {
      window.Kakao.Auth.logout();
    }
    setUser(null);
    localStorage.removeItem(STORAGE_KEY);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
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
