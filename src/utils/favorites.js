import { db } from '../firebase';
import { 
  collection, 
  doc, 
  setDoc, 
  deleteDoc, 
  getDocs, 
  query, 
  orderBy,
  serverTimestamp 
} from 'firebase/firestore';

// 즐겨찾기 추가
export const addFavorite = async (userId, restaurant) => {
  if (!userId) return;
  // 식당 이름 추출 (name 또는 title 필드 중 있는 것 사용, HTML 태그 제거)
  const rawName = restaurant.name || restaurant.title || '알 수 없는 식당';
  const cleanName = rawName.replace(/<[^>]*>?/gm, '');
  
  // ID가 없으면 정제된 이름을 ID로 사용
  const favId = restaurant.id || cleanName;
  const favRef = doc(db, 'users', userId, 'favorites', favId);
  
  await setDoc(favRef, {
    ...restaurant,
    name: cleanName, // 이름을 정제된 버전으로 통일
    addedAt: serverTimestamp()
  });
};

// 즐겨찾기 삭제
export const removeFavorite = async (userId, restaurantId) => {
  if (!userId) return;
  const favRef = doc(db, 'users', userId, 'favorites', restaurantId);
  await deleteDoc(favRef);
};

// 즐겨찾기 목록 가져오기
export const getFavorites = async (userId) => {
  if (!userId) return [];
  const favsRef = collection(db, 'users', userId, 'favorites');
  const q = query(favsRef, orderBy('addedAt', 'desc'));
  const snapshot = await getDocs(q);
  
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));
};
