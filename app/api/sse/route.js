export const dynamic = 'force-dynamic';

import { subscribe, unsubscribe } from '../../lib/sse.js';

const encoder = new TextEncoder();

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const channel = searchParams.get('channel');
  if (!channel) return new Response('Missing channel', { status: 400 });

  let ctrl;
  const stream = new ReadableStream({
    start(c) {
      ctrl = c;
      subscribe(channel, ctrl);
      ctrl.enqueue(encoder.encode('data: connected\n\n'));
    },
    cancel() {
      unsubscribe(channel, ctrl);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
      'Alt-Svc': 'clear',
    },
  });
}
