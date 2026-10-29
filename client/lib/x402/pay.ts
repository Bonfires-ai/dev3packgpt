import type { WalletContextState } from '@solana/wallet-adapter-react';
import type { Connection } from '@solana/web3.js';
import { encodeXPaymentHeader } from './header';
import { buildAndSignPayment } from './payment-builder';
import { type PaymentRequiredBody, X402_VERSION } from './spec';

const errorOf = async (res: Response) =>
  ((await res.json().catch(() => ({}))) as { error?: string }).error ?? `Payment failed (${res.status})`;

/**
 * POST `body` to an x402-gated `url`: probe for the 402, sign the USDC transfer it
 * asks for in the connected wallet, and send it again with the X-PAYMENT header.
 * `onSigned` fires once the wallet has signed, while the payment settles.
 */
export async function payWithX402<T>(
  url: string,
  body: unknown,
  { connection, wallet, onSigned }: { connection: Connection; wallet: WalletContextState; onSigned?: () => void }
): Promise<T> {
  const init = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };

  const probe = await fetch(url, init);
  if (probe.status !== 402) throw new Error(await errorOf(probe));
  const required = (await probe.json()) as PaymentRequiredBody;
  const requirements = required.accepts?.[0];
  if (!requirements) throw new Error('No payment requirements in 402 response');

  const transaction = await buildAndSignPayment({ connection, wallet, requirements });
  onSigned?.();
  const xPayment = encodeXPaymentHeader({
    x402Version: X402_VERSION,
    resource: required.resource,
    accepted: requirements,
    payload: { transaction },
  });

  const paid = await fetch(url, { ...init, headers: { ...init.headers, 'X-PAYMENT': xPayment } });
  if (!paid.ok) throw new Error(await errorOf(paid));
  return (await paid.json()) as T;
}
