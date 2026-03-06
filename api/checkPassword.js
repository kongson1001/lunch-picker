export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { roomId, password } = req.body;

  if (!roomId || !password) {
    return res.status(400).json({ error: 'roomId와 password가 필요합니다' });
  }

  // Firebase Admin SDK를 사용하는 것이 좋지만, 현재 구조상 런타임 fetch 또는 환경변수를 통한 DB 접근이 필요할 수 있습니다.
  // 여기서는 단순화를 위해 DB에서 직접 해당 방의 비밀번호를 확인하는 로직을 시뮬레이션하거나 
  // 실제 Firebase Realtime DB REST API를 호출할 수 있습니다.
  
  const DATABASE_URL = process.env.VITE_FIREBASE_DATABASE_URL;
  if (!DATABASE_URL) {
    return res.status(500).json({ error: 'DATABASE_URL not configured' });
  }

  try {
    const response = await fetch(`${DATABASE_URL}/rooms/${roomId}/password.json`);
    const expectedPassword = await response.json();

    if (expectedPassword === password) {
      return res.status(200).json({ success: true });
    } else {
      return res.status(401).json({ success: false, error: '비밀번호가 일치하지 않습니다.' });
    }
  } catch (error) {
    console.error('Password check failed:', error);
    return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
}
