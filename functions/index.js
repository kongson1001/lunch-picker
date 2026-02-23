const { onRequest } = require('firebase-functions/v2/https');
const { defineString } = require('firebase-functions/params');

const naverClientId = defineString('NAVER_CLIENT_ID');
const naverClientSecret = defineString('NAVER_CLIENT_SECRET');

exports.searchRestaurants = onRequest({ cors: true }, async (req, res) => {
  const { query } = req.query;

  if (!query) {
    res.status(400).json({ error: 'query parameter is required' });
    return;
  }

  const url = `https://openapi.naver.com/v1/search/local.json?query=${encodeURIComponent(query)}&display=5&start=1&sort=comment`;

  try {
    const response = await fetch(url, {
      headers: {
        'X-Naver-Client-Id': naverClientId.value(),
        'X-Naver-Client-Secret': naverClientSecret.value(),
      },
    });

    const data = await response.json();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch from Naver API' });
  }
});
