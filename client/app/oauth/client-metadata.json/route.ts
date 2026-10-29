import { CALLBACK_PATH, CLIENT_METADATA_PATH, publicOrigin } from '@/lib/auth';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// OAuth Client ID Metadata Document: its URL is this app's client id at Clerk.
// AUTH_EXTRA_REDIRECT_URIS (comma-separated) adds callbacks for other hosts,
// e.g. http://localhost:3000/api/auth/callback so local dev can reuse this id.
export async function GET(request: Request) {
  const origin = publicOrigin(request);
  const extra = (process.env.AUTH_EXTRA_REDIRECT_URIS ?? '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
  return NextResponse.json({
    client_id: `${origin}${CLIENT_METADATA_PATH}`,
    client_name: 'Solène',
    client_uri: origin,
    redirect_uris: [`${origin}${CALLBACK_PATH}`, ...extra],
    grant_types: ['authorization_code'],
    response_types: ['code'],
    token_endpoint_auth_method: 'none',
    scope: 'openid email profile',
  });
}
