-- OpenRouter wallet: one provisioned key per fleet member (see lib/wallet.ts).
-- Run once against the Supabase database, e.g. in the SQL editor.
create table if not exists openrouter_wallets (
  email text primary key,
  -- AES-256-GCM under WALLET_ENCRYPTION_KEY, as base64 iv.tag.ciphertext.
  encrypted_key text not null,
  -- OpenRouter's id for the key, to manage it with the provisioning key.
  openrouter_hash text not null unique,
  limit_usd numeric not null,
  created_at timestamptz not null default now(),
  -- Set when the key was shown to its owner; it is never shown again.
  revealed_at timestamptz
);

-- Only the server reaches this table, through DATABASE_URL; keep it off the public API.
alter table openrouter_wallets enable row level security;

-- Credit bought with x402, one row per settled payment. A row is pending until its
-- credit is on the key at OpenRouter; pending rows are retried (lib/wallet.ts).
create table if not exists openrouter_topups (
  -- The Solana transaction signature: a payment counts once.
  tx_hash text primary key,
  email text not null references openrouter_wallets (email),
  paid_usd numeric not null,
  credit_usd numeric not null,
  created_at timestamptz not null default now(),
  applied_at timestamptz
);

alter table openrouter_topups enable row level security;
