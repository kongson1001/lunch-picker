import admin from 'firebase-admin';

const firebaseConfig = {
  projectId: process.env.FIREBASE_PROJECT_ID,
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  databaseURL: process.env.FIREBASE_DATABASE_URL,
};

function getAdminApp() {
  if (admin.apps.length > 0) return admin.apps[0];

  // 환경 변수가 없는 경우(빌드 타임 등) 에러 방지
  if (!firebaseConfig.projectId || !firebaseConfig.clientEmail || !firebaseConfig.privateKey) {
    console.warn('Firebase Admin 환경 변수가 설정되지 않았습니다. 빌드 타임이 아닐 경우 확인이 필요합니다.');
    return null;
  }

  try {
    return admin.initializeApp({
      credential: admin.credential.cert({
        projectId: firebaseConfig.projectId,
        clientEmail: firebaseConfig.clientEmail,
        privateKey: firebaseConfig.privateKey,
      }),
      databaseURL: firebaseConfig.databaseURL,
    });
  } catch (error) {
    console.error('Firebase admin initialization error', error);
    return null;
  }
}

// adminDb를 함수나 Getter로 처리하여 초기화 실패 시 에러 방지
export const getAdminDb = () => {
  const app = getAdminApp();
  if (!app) {
    // 빌드 타임에는 가짜 객체 반환 (런타임에는 위에서 경고가 뜸)
    return {
      ref: () => ({
        once: () => Promise.resolve({ val: () => null }),
        push: () => ({ set: () => Promise.resolve(), key: 'temp' }),
        set: () => Promise.resolve(),
        update: () => Promise.resolve(),
        remove: () => Promise.resolve(),
      })
    };
  }
  return admin.database();
};

export default admin;
