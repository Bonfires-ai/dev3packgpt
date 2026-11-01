import { SESSION_COOKIE_NAME, currentUser } from '@/lib/auth';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// Hands the session JWT to the sign-in popup page, which passes it to the embedding
// iframe (see app/auth/popup). Only answers when the cookie itself is valid.
export async function GET() {
  const token = cookies().get(SESSION_COOKIE_NAME)?.value;
  if (!token || !(await currentUser())) return NextResponse.json({ token: null }, { status: 401 });
  return NextResponse.json({ token }, { headers: { 'Cache-Control': 'no-store' } });
}
