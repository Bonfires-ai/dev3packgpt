// Server-side only. The member's Clerk OAuth tokens, kept from sign-in so the Salts
// chat can act as them on their own agent (Salts accepts the access token on session
// routes; see lib/salts.ts). Stored encrypted in Supabase Postgres, see db/salts.sql.
import { type OAuthTokens, type TokenResponse, tokenRequest } from '@/lib/auth';
import { db, decrypt, encrypt } from '@/lib/db';

/** An access token this close to expiry is refreshed first, so it can't lapse mid-stream. */
const EXPIRY_MARGIN_MS = 2 * 60_000;
/** When the token endpoint gives no lifetime. */
const DEFAULT_LIFETIME_S = 60 * 60;

type Row = { client_id: string; encrypted_access: string; encrypted_refresh: string | null; expires_at: Date };

const expiresAt = (expiresIn?: number) => new Date(Date.now() + (expiresIn ?? DEFAULT_LIFETIME_S) * 1000);

/** Keep the tokens from a sign-in, replacing any earlier ones. */
export async function saveSaltsTokens(email: string, tokens: OAuthTokens) {
  await db()`
    insert into salts_oauth_tokens (email, client_id, encrypted_access, encrypted_refresh, expires_at)
    values (${email}, ${tokens.clientId}, ${encrypt(tokens.accessToken)},
            ${tokens.refreshToken ? encrypt(tokens.refreshToken) : null}, ${expiresAt(tokens.expiresIn)})
    on conflict (email) do update set
      client_id = excluded.client_id,
      encrypted_access = excluded.encrypted_access,
      encrypted_refresh = excluded.encrypted_refresh,
      expires_at = excluded.expires_at,
      updated_at = now()`;
}

export async function forgetSaltsTokens(email: string) {
  await db()`delete from salts_oauth_tokens where email = ${email}`;
}

/**
 * A live access token for the member, refreshed when it is about to expire; null when
 * there is none to be had and they must sign in again. A transaction-scoped advisory
 * lock per email keeps two requests from spending the same refresh token.
 */
export async function saltsAccessToken(email: string): Promise<string | null> {
  return db().begin(async sql => {
    await sql`select pg_advisory_xact_lock(hashtext(${`salts:${email}`}))`;
    const [row] = await sql<Row[]>`
      select client_id, encrypted_access, encrypted_refresh, expires_at
        from salts_oauth_tokens where email = ${email}`;
    if (!row) return null;
    if (row.expires_at.getTime() - Date.now() > EXPIRY_MARGIN_MS) return decrypt(row.encrypted_access);
    if (!row.encrypted_refresh) return null;

    const res = await tokenRequest({
      grant_type: 'refresh_token',
      refresh_token: decrypt(row.encrypted_refresh),
      client_id: row.client_id,
    });
    if (!res.ok) {
      // A refused refresh token is spent or revoked; an outage is not, so keep it then.
      if (res.status >= 400 && res.status < 500) {
        await sql`delete from salts_oauth_tokens where email = ${email}`;
        return null;
      }
      throw new Error(`token refresh ${res.status}`);
    }
    const fresh = (await res.json()) as TokenResponse;
    if (!fresh.access_token) return null;
    await sql`
      update salts_oauth_tokens set
        encrypted_access = ${encrypt(fresh.access_token)},
        encrypted_refresh = ${fresh.refresh_token ? encrypt(fresh.refresh_token) : row.encrypted_refresh},
        expires_at = ${expiresAt(fresh.expires_in)},
        updated_at = now()
       where email = ${email}`;
    return fresh.access_token;
  });
}
