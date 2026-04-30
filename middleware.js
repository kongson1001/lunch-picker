import { NextResponse } from 'next/server';

export function middleware(request) {
  const { method, nextUrl } = request;
  const path = nextUrl.pathname;

  // API 요청만 로깅 (내부 로그 엔드포인트 제외)
  if (!path.startsWith('/api/') || path === '/api/_log') {
    return NextResponse.next();
  }

  const start = Date.now();
  const response = NextResponse.next();

  // 응답 후 비동기로 로그 전송 (요청 지연 없음)
  const entry = {
    time: new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }),
    method,
    path,
    ms: Date.now() - start,
    ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || '-',
    ua: request.headers.get('user-agent')?.slice(0, 80) || '-',
  };

  fetch(new URL('/api/_log', request.url), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(entry),
  }).catch(() => {});

  return response;
}

export const config = {
  matcher: '/api/:path*',
};
