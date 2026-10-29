import { SESSION_COOKIE_NAME, currentUser } from '@/lib/auth';
import { forgetSaltsTokens } from '@/lib/salts-tokens';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST() {
  const email = (await currentUser())?.email;
  if (email) await forgetSaltsTokens(email).catch(err => console.error('forgetting salts tokens failed', err));
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(SESSION_COOKIE_NAME);
  return res;
}
