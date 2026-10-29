// Server-side only. Sign-in mirrors the dev3pack MCP server: the Salts Clerk
// instance is the OAuth authorization server, and a user gets in only with a
// verified email that has an agent in the configured Salts fleet.
//
// Flow: /api/auth/login redirects to Clerk (authorization code + PKCE),
// /api/auth/callback trades the code for an access token, reads the email from
// userinfo, checks the fleet and sets a signed session cookie. The chat APIs
// call requireMember() before doing anything.
//
// The access token is asked for with resource=SALTS_OAUTH_RESOURCE (api.salts.dev), so
// Salts accepts it on the member's own agent sessions (see lib/salts.ts); it is kept,
// with its refresh token, by lib/salts-tokens.ts.
import { SignJWT, decodeJwt, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { createHash, randomBytes } from 'node:crypto';

export const OAUTH_ISSUER = (process.env.OAUTH_ISSUER ?? 'https://clerk.salts.dev').replace(/\/+$/, '');
const SALTS_API_URL = process.env.SALTS_API_URL ?? 'https://api.salts.dev';
const FLEET_ID = process.env.SALTS_FLEET_ID;
const FLEET_KEY = process.env.SALTS_FLEET_KEY;
const SESSION_SECRET = process.env.AUTH_SESSION_SECRET;
/** The audience Salts checks on access tokens: its own API origin. */
export const SALTS_RESOURCE = (process.env.SALTS_OAUTH_RESOURCE ?? SALTS_API_URL).replace(/\/+$/, '');

const SESSION_COOKIE = 'solene_session';
const FLOW_COOKIE = 'solene_oauth';
const SESSION_TTL = 12 * 60 * 60; // seconds
const FLOW_TTL = 10 * 60; // seconds
export const CALLBACK_PATH = '/api/auth/callback';
export const CLIENT_METADATA_PATH = '/oauth/client-metadata.json';

/** How long a fleet lookup is reused; also the delay before a fleet removal takes effect. */
const VERDICT_TTL = 60_000;
const verdicts = new Map<string, { agents: FleetAgent[]; until: number }>();

export type Member = { email: string };
/** A Salts fleet agent the member is on, as the fleet lookup lists it. */
export type FleetAgent = { id: string; name: string };
/** What the token endpoint answered, for lib/salts-tokens.ts to keep. */
export type OAuthTokens = { clientId: string; accessToken: string; refreshToken?: string; expiresIn?: number };
/** What the session cookie carries about the signed-in user. */
export type Profile = { email: string; name?: string; picture?: string };

function secret() {
  if (!SESSION_SECRET) throw new Error('AUTH_SESSION_SECRET is not defined');
  return new TextEncoder().encode(SESSION_SECRET);
}

/** This app's public origin; behind a proxy set AUTH_PUBLIC_URL. */
export const publicOrigin = (request: Request) =>
  (process.env.AUTH_PUBLIC_URL ?? new URL(request.url).origin).replace(/\/+$/, '');

/**
 * The OAuth client id. Clerk accepts a Client ID Metadata Document URL as the id,
 * so by default this app serves its own (see CLIENT_METADATA_PATH) and needs no
 * registration. Clerk must be able to fetch it over https, so local dev points
 * CLERK_OAUTH_CLIENT_ID at a deployed copy that lists the localhost callback.
 */
export const clientId = (origin: string) => process.env.CLERK_OAUTH_CLIENT_ID ?? `${origin}${CLIENT_METADATA_PATH}`;

/** Only same-site paths, so the login can't be used as an open redirect. */
export const safeReturnTo = (value: string | null | undefined) =>
  value && value.startsWith('/') && !value.startsWith('//') ? value : '/';

const base64url = (buf: Buffer) => buf.toString('base64url');

/** Starts a login: the Clerk authorize URL, with state + PKCE verifier kept in a short-lived signed cookie. */
export async function beginLogin(origin: string, returnTo: string) {
  const state = base64url(randomBytes(16));
  const verifier = base64url(randomBytes(32));
  const challenge = base64url(createHash('sha256').update(verifier).digest());

  const url = new URL(`${OAUTH_ISSUER}/oauth/authorize`);
  url.search = new URLSearchParams({
    response_type: 'code',
    client_id: clientId(origin),
    redirect_uri: `${origin}${CALLBACK_PATH}`,
    // offline_access: a refresh token, so the Salts chat outlives the access token.
    scope: 'openid email profile offline_access',
    resource: SALTS_RESOURCE,
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
  }).toString();

  const flow = await new SignJWT({ state, verifier, returnTo })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime(`${FLOW_TTL}s`)
    .sign(secret());
  return { url: url.toString(), flow };
}

export type LoginResult =
  | { ok: true; profile: Profile; tokens: OAuthTokens; returnTo: string }
  | { ok: false; error: string; returnTo: string };

/** Finishes a login from the callback's query and the flow cookie. */
export async function completeLogin(
  origin: string,
  params: URLSearchParams,
  flowCookie?: string
): Promise<LoginResult> {
  let flow: { state?: string; verifier?: string; returnTo?: string };
  try {
    ({ payload: flow } = await jwtVerify(flowCookie ?? '', secret(), { algorithms: ['HS256'] }));
  } catch {
    return { ok: false, error: 'expired', returnTo: '/' };
  }
  const returnTo = safeReturnTo(flow.returnTo);
  if (params.get('error')) return { ok: false, error: 'denied', returnTo };
  const code = params.get('code');
  if (!code || params.get('state') !== flow.state) return { ok: false, error: 'expired', returnTo };

  const tokenRes = await tokenRequest({
    grant_type: 'authorization_code',
    code,
    redirect_uri: `${origin}${CALLBACK_PATH}`,
    client_id: clientId(origin),
    code_verifier: flow.verifier ?? '',
  });
  if (!tokenRes.ok) {
    console.error('oauth token exchange failed', tokenRes.status, await tokenRes.text().catch(() => ''));
    return { ok: false, error: 'failed', returnTo };
  }
  const { access_token, id_token, refresh_token, expires_in } = (await tokenRes.json()) as TokenResponse;
  if (!access_token) return { ok: false, error: 'failed', returnTo };

  const infoRes = await fetch(`${OAUTH_ISSUER}/oauth/userinfo`, {
    headers: { Authorization: `Bearer ${access_token}` },
    cache: 'no-store',
    signal: AbortSignal.timeout(15_000),
  });
  if (!infoRes.ok) return { ok: false, error: 'failed', returnTo };
  type Claims = {
    email?: string;
    email_verified?: boolean;
    name?: string;
    given_name?: string;
    family_name?: string;
    picture?: string;
  };
  const info = (await infoRes.json()) as Claims;
  // The ID token came straight from the token endpoint, so its claims can fill in
  // name and picture when userinfo leaves them out.
  const idClaims: Claims = id_token ? (decodeJwt(id_token) as Claims) : {};
  console.log(
    `sign-in profile: userinfo=[${Object.keys(info).sort().join(', ')}] ` +
      `id_token=[${Object.keys(idClaims).sort().join(', ')}]`
  );
  const email = (info.email ?? '').trim().toLowerCase();
  if (!email || info.email_verified !== true) return { ok: false, error: 'unverified', returnTo };

  if (!(await inFleet(email))) return { ok: false, error: 'not_in_fleet', returnTo };
  const fullName = (c: Claims) => c.name?.trim() || [c.given_name, c.family_name].filter(Boolean).join(' ').trim();
  const name = fullName(info) || fullName(idClaims);
  const picture = uploadedPicture(info.picture) ?? uploadedPicture(idClaims.picture);
  return {
    ok: true,
    profile: { email, ...(name && { name }), ...(picture && { picture }) },
    tokens: {
      clientId: clientId(origin),
      accessToken: access_token,
      refreshToken: refresh_token,
      expiresIn: expires_in,
    },
    returnTo,
  };
}

export type TokenResponse = {
  access_token?: string;
  id_token?: string;
  refresh_token?: string;
  expires_in?: number;
};

/** A call to Clerk's token endpoint, always for the Salts resource. */
export function tokenRequest(params: Record<string, string>) {
  return fetch(`${OAUTH_ISSUER}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      ...params,
      resource: SALTS_RESOURCE,
      ...(process.env.CLERK_OAUTH_CLIENT_SECRET && { client_secret: process.env.CLERK_OAUTH_CLIENT_SECRET }),
    }),
    cache: 'no-store',
    signal: AbortSignal.timeout(15_000),
  });
}

/**
 * The user's own photo, or undefined. Clerk also returns a generated avatar for
 * users without one; its URL's last segment is base64 JSON with "type":"default".
 */
function uploadedPicture(url?: string): string | undefined {
  if (!url?.startsWith('https://')) return undefined;
  try {
    const segment = new URL(url).pathname.split('/').pop() ?? '';
    if (JSON.parse(Buffer.from(segment, 'base64url').toString()).type === 'default') return undefined;
  } catch {}
  return url;
}

export const signSession = (profile: Profile) =>
  new SignJWT(profile).setProtectedHeader({ alg: 'HS256' }).setExpirationTime(`${SESSION_TTL}s`).sign(secret());

const cookieOptions = (maxAge: number) => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge,
});
export const sessionCookie = (value: string) => ({ name: SESSION_COOKIE, value, ...cookieOptions(SESSION_TTL) });
export const flowCookie = (value: string) => ({ name: FLOW_COOKIE, value, ...cookieOptions(FLOW_TTL) });
export const FLOW_COOKIE_NAME = FLOW_COOKIE;
export const SESSION_COOKIE_NAME = SESSION_COOKIE;

/** The signed-in user from the session cookie, without the fleet check. */
export async function currentUser(): Promise<Profile | null> {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: ['HS256'] });
    if (typeof payload.email !== 'string') return null;
    const text = (v: unknown) => (typeof v === 'string' && v ? v : undefined);
    return { email: payload.email, name: text(payload.name), picture: text(payload.picture) };
  } catch {
    return null;
  }
}

/** The signed-in fleet member, or a 401/403 response to return as is. */
export async function requireMember(): Promise<Member | NextResponse> {
  const email = (await currentUser())?.email;
  if (!email) return NextResponse.json({ error: 'Sign in to chat with the agents.' }, { status: 401 });
  try {
    if (await inFleet(email)) return { email };
  } catch (err) {
    console.error('fleet check failed', err);
    return NextResponse.json({ error: 'Could not verify your access. Please try again.' }, { status: 503 });
  }
  return NextResponse.json({ error: `${email} is not authorized to chat with the agents.` }, { status: 403 });
}

export const inFleet = async (email: string) => (await fleetAgents(email)).length > 0;

/** The fleet's agents the member is on, oldest first; none means not a member. */
export async function fleetAgents(email: string): Promise<FleetAgent[]> {
  const now = Date.now();
  const hit = verdicts.get(email);
  if (hit && hit.until > now) return hit.agents;

  if (!FLEET_ID || !FLEET_KEY) throw new Error('SALTS_FLEET_ID and SALTS_FLEET_KEY are required for sign-in');
  const url = new URL(`${SALTS_API_URL}/api/fleets/${encodeURIComponent(FLEET_ID)}/agents`);
  url.searchParams.set('email', email);
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${FLEET_KEY}` },
    cache: 'no-store',
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`fleet lookup ${res.status}`);
  const body = (await res.json()) as { agents?: FleetAgent[] };
  const agents = Array.isArray(body.agents) ? body.agents.map(({ id, name }) => ({ id, name })) : [];

  verdicts.forEach((v, k) => v.until <= now && verdicts.delete(k));
  verdicts.set(email, { agents, until: now + VERDICT_TTL });
  return agents;
}
