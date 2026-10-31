import { CREDIT_PACKS_USD, packCreditUsd } from '@/config/credits.config';
import { requireMember } from '@/lib/auth';
import { createFacilitator } from '@/lib/facilitator';
import { ensureWalletKey, recordTopUp, walletCredit } from '@/lib/wallet';
import { decodeXPaymentHeader } from '@/lib/x402/header';
import { paymentRequirements } from '@/lib/x402/requirements';
import { type PaymentResource, X402_VERSION } from '@/lib/x402/spec';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
// Settling waits until the payment's blockhash expires (~90s on mainnet).
export const maxDuration = 120;

// Buy OpenRouter credit with x402: POST { pack } answers 402 with what to pay, then
// the same POST with an X-PAYMENT header settles it and raises the member's key
// limit by the pack less the service fee. Always paid, whatever NEXT_PUBLIC_DISABLE_X402
// says about voice sessions.
export async function POST(req: NextRequest) {
  const member = await requireMember();
  if (member instanceof NextResponse) return member;

  const { pack } = (await req.json().catch(() => ({}))) as { pack?: unknown };
  const usd = CREDIT_PACKS_USD.find(p => p === pack);
  if (!usd) return NextResponse.json({ error: 'Unknown credit pack' }, { status: 400 });

  if (!process.env.SOLANA_RECIPIENT_ADDRESS) {
    return NextResponse.json({ error: 'SOLANA_RECIPIENT_ADDRESS not configured' }, { status: 500 });
  }

  try {
    await ensureWalletKey(member.email);
  } catch (err) {
    console.error('wallet provisioning failed', err);
    return NextResponse.json({ error: 'Your OpenRouter wallet is not ready yet.' }, { status: 503 });
  }

  let facilitator;
  let feePayer: string;
  try {
    facilitator = createFacilitator();
    feePayer = await facilitator.getFeePayer();
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'facilitator error' }, { status: 502 });
  }

  const requirements = paymentRequirements(feePayer, usd);
  const xPayment = req.headers.get('x-payment');

  if (!xPayment) {
    const resource: PaymentResource = {
      url: new URL(req.url).toString(),
      description: `${usd} USDC of OpenRouter credit`,
      mimeType: 'application/json',
    };
    return NextResponse.json({ x402Version: X402_VERSION, resource, accepts: [requirements] }, { status: 402 });
  }

  let payload;
  try {
    payload = decodeXPaymentHeader(xPayment);
  } catch {
    return NextResponse.json({ error: 'Invalid X-PAYMENT header' }, { status: 400 });
  }

  const verifyResult = await facilitator.verify(payload, requirements);
  if (!verifyResult.isValid) {
    return NextResponse.json({ error: verifyResult.invalidReason ?? 'Verification failed' }, { status: 402 });
  }

  const settleResult = await facilitator.settle(payload, requirements);
  if (!settleResult.success) {
    return NextResponse.json({ error: settleResult.error ?? 'Settlement failed' }, { status: 502 });
  }

  // Paid from here on. A failure to reach OpenRouter leaves the top-up pending;
  // /api/wallet retries it.
  try {
    await recordTopUp(member.email, settleResult.transaction, usd, packCreditUsd(usd));
  } catch (err) {
    console.error('top-up not applied yet', settleResult.transaction, err);
    return NextResponse.json(
      { error: 'Payment received. Your credits will show up shortly.', tx_hash: settleResult.transaction },
      { status: 502 }
    );
  }
  return NextResponse.json({ credit: await walletCredit(member.email), tx_hash: settleResult.transaction });
}
