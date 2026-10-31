#!/usr/bin/env node
/**
 * credit-topup.mjs — credit a top-up by hand from its Solana transaction.
 *
 * For a payment that landed on chain but was never credited (the server gave
 * up before it confirmed, or crashed after). It checks the transaction paid
 * SOLANA_RECIPIENT_ADDRESS one credit pack in USDC, then records the top-up
 * for the member. The member's key limit rises the next time they open the
 * site (/api/wallet applies pending top-ups). A transaction counts once, so
 * running this twice, or for a top-up that was already credited, adds nothing.
 *
 * Run from client/ with the deployment's env, e.g. production's:
 *
 *   vercel env pull .env.production.local --environment=production
 *   node --env-file=.env.production.local scripts/credit-topup.mjs <tx_hash> <member email>
 *
 * Without --apply it only checks and says what it would do; add --apply to write.
 * Needs DATABASE_URL, SOLANA_RPC_URL, SOLANA_RECIPIENT_ADDRESS and
 * NEXT_PUBLIC_SOLANA_NETWORK.
 */
import { Connection } from '@solana/web3.js';
import postgres from 'postgres';

// Keep in sync with config/credits.config.ts and lib/x402/spec.ts.
const CREDIT_PACKS_USD = [1, 4, 12];
const SERVICE_FEE_BPS = 500;
const packCreditUsd = usd => Math.floor(usd * (10_000 - SERVICE_FEE_BPS)) / 10_000;
const USDC_MINT = {
  mainnet: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  devnet: '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU',
};

const args = process.argv.slice(2);
const apply = args.includes('--apply');
const [txHash, email] = args.filter(a => a !== '--apply');
if (!txHash || !email) {
  console.error('Usage: node scripts/credit-topup.mjs <tx_hash> <member email> [--apply]');
  process.exit(1);
}

const fail = message => {
  console.error(`✗ ${message}`);
  process.exit(1);
};
const env = name => process.env[name] || fail(`${name} is not set`);

const network = (process.env.NEXT_PUBLIC_SOLANA_NETWORK ?? 'devnet').toLowerCase() === 'mainnet' ? 'mainnet' : 'devnet';
const mint = USDC_MINT[network];
const recipient = env('SOLANA_RECIPIENT_ADDRESS');

// The payment: a finalized transaction that moved one pack of USDC to the recipient.
const connection = new Connection(env('SOLANA_RPC_URL'), 'finalized');
const tx = await connection.getTransaction(txHash, { commitment: 'finalized', maxSupportedTransactionVersion: 0 });
if (!tx) fail(`No finalized transaction ${txHash} on ${network}`);
if (tx.meta?.err) fail(`Transaction failed on chain: ${JSON.stringify(tx.meta.err)}`);

const usdcOf = (balances, owner) =>
  (balances ?? [])
    .filter(b => b.mint === mint && b.owner === owner)
    .reduce((sum, b) => sum + BigInt(b.uiTokenAmount.amount), 0n);
const received = usdcOf(tx.meta.postTokenBalances, recipient) - usdcOf(tx.meta.preTokenBalances, recipient);
const paidUsd = Number(received) / 1e6;
if (received <= 0n) fail(`Transaction paid no USDC to ${recipient}`);
if (!CREDIT_PACKS_USD.includes(paidUsd)) fail(`Paid ${paidUsd} USDC, which is not a credit pack (${CREDIT_PACKS_USD})`);

const payer = (tx.meta.preTokenBalances ?? []).find(
  b =>
    b.mint === mint &&
    b.owner !== recipient &&
    usdcOf(tx.meta.postTokenBalances, b.owner) < BigInt(b.uiTokenAmount.amount)
)?.owner;
const creditUsd = packCreditUsd(paidUsd);

console.log(`  Transaction  ${txHash}`);
console.log(`  Network      ${network}, ${new Date(tx.blockTime * 1000).toISOString()}`);
console.log(`  Paid         ${paidUsd} USDC from ${payer ?? 'unknown'} to ${recipient}`);
console.log(`  Credit       $${creditUsd} of OpenRouter credit to ${email}`);

const sql = postgres(env('DATABASE_URL'), { prepare: false, max: 1 });
try {
  const [wallet] = await sql`select email from openrouter_wallets where email = ${email}`;
  if (!wallet) fail(`${email} has no OpenRouter wallet (they sign in once to get one)`);

  const [existing] = await sql`select email, applied_at from openrouter_topups where tx_hash = ${txHash}`;
  if (existing) {
    const state = existing.applied_at ? `applied ${existing.applied_at.toISOString()}` : 'pending';
    fail(`Already recorded for ${existing.email} (${state}); nothing to do`);
  }

  if (!apply) {
    console.log('\n  Checks passed. Run again with --apply to credit it.');
  } else {
    await sql`
      insert into openrouter_topups (tx_hash, email, paid_usd, credit_usd)
      values (${txHash}, ${email}, ${paidUsd}, ${creditUsd})
      on conflict (tx_hash) do nothing`;
    console.log(`\n✓ Recorded. ${email}'s limit rises by $${creditUsd} the next time they open the site.`);
  }
} finally {
  await sql.end();
}
