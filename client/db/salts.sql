-- Clerk OAuth tokens per member, for the Salts text chat (see lib/salts-tokens.ts).
-- Run once against the Supabase database, e.g. in the SQL editor.
create table if not exists salts_oauth_tokens (
  email text primary key,
  -- The OAuth client the tokens were issued to; a refresh must name the same one.
  client_id text not null,
  -- AES-256-GCM under WALLET_ENCRYPTION_KEY, as base64 iv.tag.ciphertext.
  encrypted_access text not null,
  encrypted_refresh text,
  expires_at timestamptz not null,
  updated_at timestamptz not null default now()
);

-- Only the server reaches this table, through DATABASE_URL; keep it off the public API.
alter table salts_oauth_tokens enable row level security;
