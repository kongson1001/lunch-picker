export default async function handler(req, res) {
  const { query, x, y } = req.query;

  if (!query) {
    return res.status(400).json({ error: 'query parameter is required' });
  }

  const apiKey = process.env.KAKAO_REST_API_KEY;
  if (!apiKey) {
    console.error('[API] KAKAO_REST_API_KEY 환경변수가 설정되지 않음');
    return res.status(500).json({ error: 'KAKAO_REST_API_KEY not configured' });
  }

  const params = new URLSearchParams({
    query,
    category_group_code: 'FD6',
    size: '5',
    sort: 'accuracy',
  });
  if (x && y) {
    params.append('x', x);
    params.append('y', y);
    params.append('radius', '2000');
  }

  const url = `https://dapi.kakao.com/v2/local/search/keyword.json?${params}`;
  console.log('[API] 카카오 검색 요청:', url);

  try {
    const response = await fetch(url, {
      headers: { Authorization: `KakaoAK ${apiKey}` },
    });

    const data = await response.json();
    console.log('[API] 카카오 응답 상태:', response.status, '결과 수:', data.documents?.length || 0);
    res.status(200).json(data);
  } catch (error) {
    console.error('[API] 카카오 검색 실패:', error);
    res.status(500).json({ error: 'Failed to fetch from Kakao API' });
  }
}
