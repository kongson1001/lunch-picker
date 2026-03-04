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
  // 식당 ID가 없는 경우 이름을 ID 대용으로 사용 (네이버 검색 결과 기준)
  const favId = restaurant.id || restaurant.title.replace(/<[^>]*>?/gm, '');
  const favRef = doc(db, 'users', userId, 'favorites', favId);
  
  await setDoc(favRef, {
    ...restaurant,
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
