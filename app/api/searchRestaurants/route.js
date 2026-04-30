import { NextResponse } from 'next/server';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('query');
  const x = searchParams.get('x');
  const y = searchParams.get('y');

  if (!query) {
    return NextResponse.json({ error: 'query parameter is required' }, { status: 400 });
  }

  const apiKey = process.env.KAKAO_REST_API_KEY;
  if (!apiKey) {
    console.error('[API] KAKAO_REST_API_KEY 환경변수가 설정되지 않음');
    return NextResponse.json({ error: 'KAKAO_REST_API_KEY not configured' }, { status: 500 });
  }

  const rect = searchParams.get('rect');
  const radius = searchParams.get('radius');
  const page = searchParams.get('page') || '1';
  const params = new URLSearchParams({
    query,
    size: '15',
    page,
    sort: 'accuracy',
  });
  if (rect) {
    params.append('rect', rect);
  } else if (x && y) {
    params.append('x', x);
    params.append('y', y);
    if (radius) params.append('radius', radius);
  }

  const url = `https://dapi.kakao.com/v2/local/search/keyword.json?${params}`;
  try {
    const response = await fetch(url, {
      headers: {
        Authorization: `KakaoAK ${apiKey}`,
      },
    });

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('[API] 카카오 검색 실패:', error);
    return NextResponse.json({ error: 'Failed to fetch from Kakao API' }, { status: 500 });
  }
}
