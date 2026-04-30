import { NextResponse } from 'next/server';
import { getAuthUser } from '../../lib/auth.js';

export async function GET(request) {
  const authUser = getAuthUser(request);
  if (!authUser) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }
  return NextResponse.json({ authenticated: true, uid: authUser.uid, isAdmin: authUser.isAdmin });
}
