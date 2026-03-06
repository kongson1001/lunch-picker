export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { adminId, adminPw } = req.body;

  // Vercel 환경 변수에 등록된 값과 비교
  const EXPECTED_ID = process.env.ADMIN_ID;
  const EXPECTED_PW = process.env.ADMIN_PW;

  // 환경 변수가 설정되지 않은 경우 보안을 위해 접근 차단
  if (!EXPECTED_ID || !EXPECTED_PW) {
    console.error('[SECURITY] ADMIN_ID or ADMIN_PW is not configured in environment variables.');
    return res.status(500).json({ success: false, error: '서버 설정 오류가 발생했습니다.' });
  }

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
    // 보안을 위해 ID/PW 중 어느 것이 틀렸는지 명시하지 않음
    return res.status(401).json({ success: false, error: '인증 정보가 일치하지 않습니다.' });
  }
}
