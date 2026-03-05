import { createContext, useContext, useState, useEffect } from 'react';
import { db, ref, get, set, update as dbUpdate } from '../firebase';

const AuthContext = createContext(null);

const STORAGE_KEY = 'kakao_user';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Database에서 사용자 정보 가져오기
  const fetchUserData = async (uid) => {
    try {
      const userRef = ref(db, `users/${uid}/profile`);
      const snapshot = await get(userRef);
      if (snapshot.exists()) {
        return snapshot.val();
      }
    } catch (err) {
      console.error('사용자 정보 불러오기 실패:', err);
    }
    return null;
  };

  useEffect(() => {
    // 카카오 SDK 초기화
    const jsKey = import.meta.env.VITE_KAKAO_JS_KEY?.trim();
    if (window.Kakao && !window.Kakao.isInitialized()) {
      window.Kakao.init(jsKey);
    }

    // 카카오 로그인 리다이렉트 후 code 처리
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    if (code) {
      window.history.replaceState({}, '', window.location.pathname);
      handleAuthCode(code);
      return;
    }

    // localStorage에서 캐시된 유저 정보 복원
    const initAuth = async () => {
      const cached = localStorage.getItem(STORAGE_KEY);
      if (cached) {
        try {
          const cachedUser = JSON.parse(cached);
          // DB에서 최신 정보 확인
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

      // 액세스 토큰으로 사용자 정보 조회
      const userRes = await fetch('https://kapi.kakao.com/v2/user/me', {
        headers: { Authorization: `Bearer ${data.access_token}` },
      });
      const userData = await userRes.json();
      const uid = `kakao_${userData.id}`;

      // DB에서 기존 정보 확인
      const dbData = await fetchUserData(uid);
      
      const kakaoUser = {
        uid,
        nickname: dbData?.nickname || userData.kakao_account?.profile?.nickname || `사용자${userData.id}`,
        profileImage: dbData?.profileImage || null,
      };

      // 처음 로그인하는 경우 DB에 기본 정보 저장
      if (!dbData) {
        await set(ref(db, `users/${uid}/profile`), {
          nickname: kakaoUser.nickname,
          profileImage: kakaoUser.profileImage,
          updatedAt: Date.now()
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
    const restApiKey = import.meta.env.VITE_KAKAO_REST_API_KEY?.trim();
    const redirectUri = encodeURIComponent(window.location.origin);
    window.location.href = `https://kauth.kakao.com/oauth/authorize?client_id=${restApiKey}&redirect_uri=${redirectUri}&response_type=code`;
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
      // DB 업데이트
      await dbUpdate(ref(db, `users/${user.uid}/profile`), {
        nickname,
        profileImage,
        updatedAt: Date.now()
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
