export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { adminId, adminPw } = req.body;

  // Vercel 환경 변수에 등록된 값과 비교 (없으면 기본값 사용 - 설정 전까지 테스트용)
  const EXPECTED_ID = process.env.ADMIN_ID || 'kyoungmin';
  const EXPECTED_PW = process.env.ADMIN_PW || '15901590';

  if (adminId === EXPECTED_ID && adminPw === EXPECTED_PW) {
    // 인증 성공 시 보안 토큰이나 성공 메시지 반환
    return res.status(200).json({ 
      success: true, 
      adminUser: {
        uid: 'admin_test_id',
        nickname: '관리자(보안인증)',
        isAdmin: true
      }
    });
  } else {
    return res.status(401).json({ success: false, error: '인증 정보가 일치하지 않습니다.' });
  }
}
