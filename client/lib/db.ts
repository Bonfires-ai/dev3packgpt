// Server-side only. The Supabase Postgres connection and the sealing of secrets
// stored in it (AES-256-GCM under WALLET_ENCRYPTION_KEY, as base64 iv.tag.ciphertext).
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import postgres from 'postgres';

// One client per server instance. Supabase's pooler (transaction mode) has no
// prepared statements.
let client: postgres.Sql | undefined;
export function db() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not defined');
  client ??= postgres(process.env.DATABASE_URL, { prepare: false, max: 5 });
  return client;
}

function encryptionKey() {
  const key = Buffer.from(process.env.WALLET_ENCRYPTION_KEY ?? '', 'hex');
  if (key.length !== 32) throw new Error('WALLET_ENCRYPTION_KEY must be 64 hex characters');
  return key;
}

export function encrypt(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), data].map(b => b.toString('base64')).join('.');
}

export function decrypt(sealed: string): string {
  const [iv, tag, data] = sealed.split('.').map(part => Buffer.from(part, 'base64'));
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}
