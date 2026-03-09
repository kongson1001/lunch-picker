import { NextResponse } from 'next/server';
import { adminDb } from '../../../lib/firebaseAdmin';

// GET: 데이터 읽기
export async function GET(request, { params }) {
  const path = params.path.join('/');
  try {
    const snapshot = await adminDb.ref(path).once('value');
    return NextResponse.json(snapshot.val());
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST: 데이터 추가 (push)
export async function POST(request, { params }) {
  const path = params.path.join('/');
  const body = await request.json();
  try {
    const newRef = adminDb.ref(path).push();
    await newRef.set({ ...body, createdAt: Date.now() });
    return NextResponse.json({ id: newRef.key });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PUT: 데이터 저장 (set)
export async function PUT(request, { params }) {
  const path = params.path.join('/');
  const body = await request.json();
  try {
    await adminDb.ref(path).set(body);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PATCH: 데이터 수정 (update)
export async function PATCH(request, { params }) {
  const path = params.path.join('/');
  const body = await request.json();
  try {
    await adminDb.ref(path).update(body);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE: 데이터 삭제 (remove)
export async function DELETE(request, { params }) {
  const path = params.path.join('/');
  try {
    await adminDb.ref(path).remove();
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
