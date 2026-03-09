import { initializeApp, getApps, getApp } from 'firebase/app';
import { getDatabase, ref, set, push, get, onValue, update, remove } from 'firebase/database';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
};

let app;
let db;

// 빌드 타임에 환경변수가 없는 경우(예: CI/CD 환경 등)를 대비한 체크
if (typeof window !== 'undefined' || (firebaseConfig.projectId && firebaseConfig.databaseURL)) {
  app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
  db = getDatabase(app);
} else {
  // SSR 환경이고 환경변수가 없는 경우에 대한 더미 객체 혹은 지연 초기화 전략
  // 실제 런타임에는 이 부분이 실행되지 않도록 환경변수 설정이 필요합니다.
  db = {}; 
}

export { db, ref, set, push, get, onValue, update, remove };
