import {
  NETWORK_SOLANA_DEVNET,
  NETWORK_SOLANA_MAINNET,
  type PaymentRequirements,
  SCHEME_EXACT,
  USDC_DECIMALS,
  USDC_DEVNET_MINT,
  USDC_MAINNET_MINT,
} from './spec';

/** What a payment of `usdAmount` USDC to SOLANA_RECIPIENT_ADDRESS must look like. Server-side only. */
export function paymentRequirements(feePayer: string, usdAmount: number): PaymentRequirements {
  const isMainnet = (process.env.NEXT_PUBLIC_SOLANA_NETWORK ?? 'devnet').toLowerCase() === 'mainnet';
  return {
    scheme: SCHEME_EXACT,
    network: isMainnet ? NETWORK_SOLANA_MAINNET : NETWORK_SOLANA_DEVNET,
    amount: String(Math.round(usdAmount * 10 ** USDC_DECIMALS)),
    asset: isMainnet ? USDC_MAINNET_MINT : USDC_DEVNET_MINT,
    payTo: process.env.SOLANA_RECIPIENT_ADDRESS as string,
    maxTimeoutSeconds: 60,
    extra: { feePayer },
  };
}
