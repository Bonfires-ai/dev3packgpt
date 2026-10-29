import { requireMember } from '@/lib/auth';
import { applyTopUps, ensureWalletKey, revealWalletKey, walletCredit } from '@/lib/wallet';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// The signed-in member's OpenRouter wallet: its credit, and the key itself the
// first time only. A key that failed to provision at sign-in is made here.
export async function GET() {
  const member = await requireMember();
  if (member instanceof NextResponse) return member;

  try {
    await ensureWalletKey(member.email);
  } catch (err) {
    console.error('wallet provisioning failed', err);
    return NextResponse.json({ error: 'Your OpenRouter wallet is not ready yet.' }, { status: 503 });
  }
  // A paid top-up that could not reach OpenRouter at the time goes on now.
  await applyTopUps(member.email).catch(err => console.error('pending top-ups not applied', err));
  const [credit, key] = await Promise.all([walletCredit(member.email), revealWalletKey(member.email)]);
  return NextResponse.json({ credit, key }, { headers: { 'Cache-Control': 'no-store' } });
}
