// Server-side only. Each fleet member gets one OpenRouter key, made on their first
// sign-in with the deployment's provisioning key and held to a fixed credit limit.
// The voice agent spends from it; the key itself is shown to its owner once.
//
// Keys are stored encrypted (AES-256-GCM, WALLET_ENCRYPTION_KEY) in Supabase
// Postgres; see db/wallet.sql for the table.
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import postgres from 'postgres';

const OPENROUTER_API = 'https://openrouter.ai/api/v1';
const PROVISIONING_KEY = process.env.OPENROUTER_PROVISIONING_KEY;
const CREDIT_USD = Number(process.env.OPENROUTER_KEY_CREDIT_USD ?? '0.5');

// One client per server instance. Supabase's pooler (transaction mode) has no
// prepared statements.
let client: postgres.Sql | undefined;
function db() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not defined');
  client ??= postgres(process.env.DATABASE_URL, { prepare: false, max: 5 });
  return client;
}

function encryptionKey() {
  const key = Buffer.from(process.env.WALLET_ENCRYPTION_KEY ?? '', 'hex');
  if (key.length !== 32) throw new Error('WALLET_ENCRYPTION_KEY must be 64 hex characters');
  return key;
}

function encrypt(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), data].map(b => b.toString('base64')).join('.');
}

function decrypt(sealed: string): string {
  const [iv, tag, data] = sealed.split('.').map(part => Buffer.from(part, 'base64'));
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}

/** Make a key held to `limit` dollars. `name` is what OpenRouter's dashboard lists it by. */
async function createKey(name: string, limit: number): Promise<{ secret: string; hash: string }> {
  if (!PROVISIONING_KEY) throw new Error('OPENROUTER_PROVISIONING_KEY is not defined');
  const res = await fetch(`${OPENROUTER_API}/keys`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${PROVISIONING_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, limit }),
    cache: 'no-store',
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`OpenRouter refused to make a key (${res.status})`);
  const made = (await res.json()) as { key?: string; data?: { hash?: string } };
  if (!made.key || !made.data?.hash) throw new Error('OpenRouter made no key');
  return { secret: made.key, hash: made.data.hash };
}

/**
 * The member's key, made now if they have none. A transaction-scoped advisory lock
 * per email keeps two first sign-ins at once from making two keys.
 */
export async function ensureWalletKey(email: string): Promise<string> {
  return db().begin(async sql => {
    await sql`select pg_advisory_xact_lock(hashtext(${email}))`;
    const [row] = await sql<{ encrypted_key: string }[]>`
      select encrypted_key from openrouter_wallets where email = ${email}`;
    if (row) return decrypt(row.encrypted_key);

    const { secret, hash } = await createKey(`SoleneGPT ${email}`, CREDIT_USD);
    await sql`
      insert into openrouter_wallets (email, encrypted_key, openrouter_hash, limit_usd)
      values (${email}, ${encrypt(secret)}, ${hash}, ${CREDIT_USD})`;
    return secret;
  });
}

/** Set a key's limit to `limit` dollars. Absolute, so repeating it changes nothing. */
async function setKeyLimit(hash: string, limit: number) {
  if (!PROVISIONING_KEY) throw new Error('OPENROUTER_PROVISIONING_KEY is not defined');
  const res = await fetch(`${OPENROUTER_API}/keys/${encodeURIComponent(hash)}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${PROVISIONING_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ limit }),
    cache: 'no-store',
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`OpenRouter refused the new limit (${res.status})`);
}

/**
 * Record a settled payment as credit for `email`, then put it on their key.
 * A payment counts once, by its transaction signature.
 */
export async function recordTopUp(email: string, txHash: string, paidUsd: number, creditUsd: number) {
  await db()`
    insert into openrouter_topups (tx_hash, email, paid_usd, credit_usd)
    values (${txHash}, ${email}, ${paidUsd}, ${creditUsd})
    on conflict (tx_hash) do nothing`;
  await applyTopUps(email);
}

/**
 * Raise the key's limit by every pending top-up. The limit sent is the stored one
 * plus the pending credit, so if the commit fails after OpenRouter took it, the
 * retry sends the same limit again rather than adding the credit twice.
 */
export async function applyTopUps(email: string) {
  await db().begin(async sql => {
    await sql`select pg_advisory_xact_lock(hashtext(${email}))`;
    const pending = await sql<{ tx_hash: string; credit_usd: string }[]>`
      select tx_hash, credit_usd from openrouter_topups where email = ${email} and applied_at is null`;
    if (!pending.length) return;
    const [wallet] = await sql<{ openrouter_hash: string; limit_usd: string }[]>`
      select openrouter_hash, limit_usd from openrouter_wallets where email = ${email}`;
    const limit = pending.reduce((sum, p) => sum + Number(p.credit_usd), Number(wallet.limit_usd));

    await setKeyLimit(wallet.openrouter_hash, limit);
    await sql`update openrouter_wallets set limit_usd = ${limit} where email = ${email}`;
    await sql`
      update openrouter_topups set applied_at = now()
       where tx_hash in ${sql(pending.map(p => p.tx_hash))}`;
  });
}

/** The key, the first time it is asked for; null every time after. */
export async function revealWalletKey(email: string): Promise<string | null> {
  const [row] = await db()<{ encrypted_key: string }[]>`
    update openrouter_wallets set revealed_at = now()
     where email = ${email} and revealed_at is null
    returning encrypted_key`;
  return row ? decrypt(row.encrypted_key) : null;
}

/** A key's credit as OpenRouter reports it, in dollars. Null: no limit, or not reported. */
export type KeyCredit = { limit: number | null; usage: number | null; remaining: number | null };

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/**
 * The member's credit, read with the provisioning key: the key's own /key endpoint
 * can keep answering with the old limit for a while after a top-up.
 */
export async function walletCredit(email: string): Promise<KeyCredit | null> {
  try {
    const [row] = await db()<{ openrouter_hash: string }[]>`
      select openrouter_hash from openrouter_wallets where email = ${email}`;
    if (!row || !PROVISIONING_KEY) return null;
    const res = await fetch(`${OPENROUTER_API}/keys/${encodeURIComponent(row.openrouter_hash)}`, {
      headers: { Authorization: `Bearer ${PROVISIONING_KEY}` },
      cache: 'no-store',
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;
    const data = ((await res.json()) as { data?: Record<string, unknown> }).data ?? {};
    return { limit: num(data.limit), usage: num(data.usage), remaining: num(data.limit_remaining) };
  } catch {
    return null;
  }
}
