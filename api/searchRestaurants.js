export default async function handler(req, res) {
  const { query, x, y } = req.query;

  if (!query) {
    return res.status(400).json({ error: 'query parameter is required' });
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

  try {
    const response = await fetch(url, {
      headers: { Authorization: `KakaoAK ${process.env.KAKAO_REST_API_KEY}` },
    });

    const data = await response.json();
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch from Kakao API' });
  }
}
