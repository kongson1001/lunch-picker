import { ImageResponse } from 'next/og';

export const runtime = 'edge';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const size = Number(searchParams.get('size') || 192);

  return new ImageResponse(
    (
      <div
        style={{
          width: size,
          height: size,
          background: 'linear-gradient(135deg, #e85d26 0%, #ff8c5a 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: size * 0.2,
        }}
      >
        <div style={{ fontSize: size * 0.45, lineHeight: 1 }}>🍱</div>
      </div>
    ),
    { width: size, height: size }
  );
}
