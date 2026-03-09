import { NextResponse } from 'next/server';
import { adminDb } from '../../../lib/firebaseAdmin';
import { pusherServer } from '../../../lib/pusher';

async function triggerUpdate(path) {
  try {
    const rootPath = path.split('/')[0]; // rooms or users
    const subPath = path.split('/')[1]; // roomId or userId
    
    // Pusher를 통해 'db-updated' 채널의 'update' 이벤트를 쏩니다.
    await pusherServer.trigger('db-updated', 'update', { 
      path: rootPath, 
      id: subPath,
      fullPath: path
    });
  } catch (err) {
    console.error('Pusher trigger error:', err);
  }
}

export async function GET(request, { params }) {
  const path = params.path.join('/');
  try {
    const snapshot = await adminDb.ref(path).once('value');
    return NextResponse.json(snapshot.val());
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request, { params }) {
  const path = params.path.join('/');
  const body = await request.json();
  try {
    const newRef = adminDb.ref(path).push();
    await newRef.set({ ...body, createdAt: Date.now() });
    await triggerUpdate(path); // 알림 발송
    return NextResponse.json({ id: newRef.key });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request, { params }) {
  const path = params.path.join('/');
  const body = await request.json();
  try {
    await adminDb.ref(path).set(body);
    await triggerUpdate(path); // 알림 발송
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(request, { params }) {
  const path = params.path.join('/');
  const body = await request.json();
  try {
    await adminDb.ref(path).update(body);
    await triggerUpdate(path); // 알림 발송
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  const path = params.path.join('/');
  try {
    await adminDb.ref(path).remove();
    await triggerUpdate(path); // 알림 발송
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
