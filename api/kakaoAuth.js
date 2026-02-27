export default async function handler(req, res) {
  const { code, redirectUri } = req.query;

  if (!code || !redirectUri) {
    return res.status(400).json({ error: 'code와 redirectUri가 필요합니다' });
  }

  const response = await fetch('https://kauth.kakao.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: process.env.KAKAO_REST_API_KEY,
      redirect_uri: redirectUri,
      code,
    }),
  });

  const data = await response.json();

  if (data.error) {
    return res.status(400).json(data);
  }

  res.json({ access_token: data.access_token });
}
