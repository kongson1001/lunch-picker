import { NextResponse } from 'next/server';
import { getAdminDb } from '../../../lib/firebaseAdmin';
import { pusherServer } from '../../../lib/pusher';

async function triggerUpdate(path) {
  try {
    const rootPath = path.split('/')[0];
    const subPath = path.split('/')[1];
    
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
    const adminDb = getAdminDb();
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
    const adminDb = getAdminDb();
    const newRef = adminDb.ref(path).push();
    await newRef.set({ ...body, createdAt: Date.now() });
    await triggerUpdate(path);
    return NextResponse.json({ id: newRef.key });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request, { params }) {
  const path = params.path.join('/');
  const body = await request.json();
  try {
    const adminDb = getAdminDb();
    await adminDb.ref(path).set(body);
    await triggerUpdate(path);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(request, { params }) {
  const path = params.path.join('/');
  const body = await request.json();
  try {
    const adminDb = getAdminDb();
    await adminDb.ref(path).update(body);
    await triggerUpdate(path);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  const path = params.path.join('/');
  try {
    const adminDb = getAdminDb();
    await adminDb.ref(path).remove();
    await triggerUpdate(path);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
