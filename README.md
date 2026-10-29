# SoleneGPT

An AI version of [Solène Daviaud](https://fr.linkedin.com/in/solene-daviaud/en) — founder of [Dev3pack](https://dev3pack.xyz) — that talks builders through their Web3 + AI projects in real-time voice. Pick a language, pay $0.20 USDC on Solana, and chat.

> Forked from [devfolioco/austingpt](https://github.com/devfolioco/austingpt) (Austin XBT) and rebranded for Dev3pack. Major divergences: bilingual UI, Solana x402 payment gate (replacing the EVM/Base flow), and the persona is Solène instead of Austin. Original architecture credit upstream.

### Choose your language

<table>
  <tr>
    <td width="50%" align="center">
      <h4>English</h4>
      <p>Chat with Solène in English.</p>
      <p>Solène, founder of Dev3pack, ready to talk through your project — in English.</p>
    </td>
    <td width="50%" align="center">
      <h4>Français</h4>
      <p>Discutez avec Solène en français.</p>
      <p>Solène, fondatrice de Dev3pack, prête à parler de ton projet — en français.</p>
    </td>
  </tr>
</table>

Same warm-founder persona either way — language is the only thing that switches between modes.

---

## Architecture

```
Browser (Phantom + LiveKit client)
   ↓ pay $0.20 USDC (Solana x402)
Next.js API route (Vercel)
   ↓ verify + settle via FacilitatorClient
Solana devnet / mainnet
   ↓ JWT minted on success
LiveKit room
   ↑ joined by long-running Python agent (Railway / LiveKit Cloud)
       ↓ Deepgram (STT) → OpenRouter LLM → ElevenLabs (TTS)
```

- **Agent (`agent/`)** — Python LiveKit Voice Agent. Deepgram for STT (per-language), OpenRouter (`gpt-4.1-mini`) for the LLM, ElevenLabs (`eleven_flash_v2_5`) with a voice clone of Solène (Spanish uses the English clone).
- **Client (`client/`)** — Next.js 14 App Router. UI, mood→language routing, Solana wallet adapter (Phantom/Solflare auto-detected), x402 payment flow, JWT-gated LiveKit room access.
- **Solana x402 payment** — partially-signed USDC SPL transfer with the facilitator as fee payer (so users don't need SOL). Self-hosted facilitator runs in-process by default; Coinbase CDP facilitator class also built and toggleable via env var.

## Getting Started

### Prerequisites

- Node.js 20+ and [pnpm](https://pnpm.io/) (for the client)
- Python 3.13+ and [uv](https://github.com/astral-sh/uv#installation) (for the agent)
- A [LiveKit Cloud](https://cloud.livekit.io/) project (or self-hosted LiveKit server)
- API keys for Deepgram, ElevenLabs, OpenRouter
- A Solana wallet (Phantom recommended) with devnet USDC
- A Solana keypair to use as facilitator with a tiny amount of devnet SOL

### Setup

#### 1. Agent

```sh
cd agent
cp .env.example .env
# Fill in: LIVEKIT_*, DEEPGRAM_API_KEY, ELEVEN_API_KEY,
#          ELEVEN_VOICE_ID_EN, ELEVEN_VOICE_ID_FR
make install
make download-files
```

#### 2. Client

```sh
cd client
cp .env.example .env.local
pnpm install

# Generate facilitator keypair + JWT secret in one shot:
node scripts/x402-setup.mjs
# Paste the output into .env.local, then fund the printed pubkey
# at https://faucet.solana.com (1 devnet SOL covers thousands of tx)

# Get devnet USDC for your buyer wallet:
# https://faucet.circle.com (pick Solana, paste your Phantom address)
```

### Running

```sh
# Terminal 1 — Agent
cd agent && make dev

# Terminal 2 — Client
cd client && pnpm dev
```

Open [http://localhost:3000](http://localhost:3000), pick a language, hit Connect Wallet, sign the USDC transfer, and start talking.

---

## Configuration

### Required env vars

**Agent (`agent/.env`)**

| Var | Purpose |
|---|---|
| `LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET` / `LIVEKIT_URL` | LiveKit Cloud project credentials |
| `DEEPGRAM_API_KEY` | Speech-to-text (per-language: en-US for English mode, es for Spanish mode) |
| `ELEVEN_API_KEY` | Text-to-speech |
| `ELEVEN_VOICE_ID_EN` / `ELEVEN_VOICE_ID_FR` | ElevenLabs voice clones for each language |
| `LIVEKIT_AGENT_NAME` | Optional, default `solene`. The agent only joins rooms the client dispatches it to, with the signed-in member's OpenRouter key; it has no key of its own. LLM is `z-ai/glm-5.3` by default (override with `LLM_MODEL`) |

**Client (`client/.env.local`)**

| Var | Purpose |
|---|---|
| `LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET` / `LIVEKIT_URL` | Same as agent — minting LiveKit tokens server-side |
| `NEXT_PUBLIC_PAYMENT_GATE` | `true` to require payment before voice session |
| `X402_FACILITATOR` | `self` (default) or `coinbase` |
| `NEXT_PUBLIC_SOLANA_NETWORK` | `devnet` or `mainnet` |
| `NEXT_PUBLIC_SOLANA_RPC_URL` / `SOLANA_RPC_URL` | RPC endpoint (use Helius or similar for mainnet) |
| `SOLANA_RECIPIENT_ADDRESS` | Where USDC payments land (your Solana wallet) |
| `FACILITATOR_KEYPAIR_SECRET` | Base58 secret key for the facilitator (pays Solana tx fees) |
| `VOICE_SESSION_JWT_SECRET` | HMAC secret for minting single-use session tokens |
| `DATABASE_URL` | Supabase Postgres connection string (pooler); run `client/db/wallet.sql` once |
| `OPENROUTER_PROVISIONING_KEY` | OpenRouter provisioning key: makes each fleet member's key on their first sign-in |
| `OPENROUTER_KEY_CREDIT_USD` | Credit limit on each member's key (default `0.5`) |
| `WALLET_ENCRYPTION_KEY` | Encrypts the stored keys (AES-256-GCM); `openssl rand -hex 32` |
| `LIVEKIT_AGENT_NAME` | Optional, default `solene`; must match the agent's |
| `NEXT_PUBLIC_PAYMENT_DEFAULT_AMOUNT` | Session price in USD (default `0.20`) |
| `NEXT_PUBLIC_DISABLE_X402` | `true` to disable wallet + payment entirely (free sessions; useful for demos / workshops). Default `false`. |

If using `X402_FACILITATOR=coinbase`, also set `CDP_API_KEY_ID` and `CDP_API_KEY_SECRET` from [portal.cdp.coinbase.com](https://portal.cdp.coinbase.com).

#### Free-session mode

Set `NEXT_PUBLIC_DISABLE_X402=true` to bypass x402 entirely. The payment gate becomes a single **Start Session** button — no wallet, no signing, no on-chain settlement. The server still mints a single-use JWT for the LiveKit gate so the rest of the flow is unchanged. Use this for hackathon demos, workshops, or pre-launch testing.

### Voice clones

The bundled voice IDs (`zRxvYA4eOiuajuPT5qca` EN, `O307ppei2t9uyQERBUcD` FR) point at Solène-flavored clones in a specific ElevenLabs account. To use your own, follow [ElevenLabs' voice cloning guide](https://elevenlabs.io/blog/how-to-clone-voice) and set `ELEVEN_VOICE_ID_EN` / `ELEVEN_VOICE_ID_FR` in `agent/.env`.

Voice prosody knobs live in [`agent/voice_agent/persona_config.py`](agent/voice_agent/persona_config.py): `VOICE_SPEED`, `VOICE_STABILITY`, `VOICE_SIMILARITY_BOOST`, `VOICE_STYLE`. Lower stability = more expressive (better punctuation pauses). Default is tuned for warm-mentor delivery.

---

## Solana x402 deep dive

The payment gate uses [Coinbase's x402 protocol](https://github.com/coinbase/x402) (HTTP `402 Payment Required`) on Solana with USDC. Two docs cover the implementation in depth:

- **[docs/solana-x402-guide.md](docs/solana-x402-guide.md)** — Field guide with sequence diagrams, the wire format, facilitator comparison (self-hosted vs Coinbase CDP), faucets, common pitfalls, and going-to-mainnet checklist. Written for humans.
- **[docs/solana-x402-agent-spec.md](docs/solana-x402-agent-spec.md)** — Imperative spec for coding agents to reproduce the same payment gate in another Next.js project. Self-contained file inventory + full source.

TL;DR of the runtime flow:
1. Browser hits `/api/paid/voice/session` with no payment → server returns `402` with payment requirements (USDC mint, amount, recipient, facilitator pubkey).
2. Browser builds a partially-signed Solana `VersionedTransaction` (`createATAIdempotent` → `transferChecked`), feePayer = facilitator. Phantom signs.
3. Browser posts the base64'd tx in an `X-PAYMENT` header.
4. Server (`SelfHostedFacilitator`) verifies signature/amount/mint, co-signs as feePayer, broadcasts to Solana, mints a single-use JWT.
5. Browser uses the JWT to get a LiveKit token from `/api/connection-details`. Agent dispatches into the room.

---

## Deployment

### Client (Vercel)

```sh
cd client
vercel link    # pick the team that owns your domain
vercel --prod
```

Add env vars via dashboard. Domain → `solene.dev3pack.xyz` (or your subdomain) → Settings → Domains → add → set the DNS record Vercel gives you.

### Agent (Railway recommended, LiveKit Cloud also works)

**Railway:**
1. New Project → Deploy from GitHub → pick this repo
2. Root Directory: `agent`
3. Builder auto-detects [`agent/Dockerfile`](agent/Dockerfile)
4. Paste env vars from `agent/.env`
5. Deploy. Watch for `registered worker` in logs.

**LiveKit Cloud:** see [`docs/deploy-livekit-cloud.md`](docs/deploy-livekit-cloud.md) for the `lk agent deploy` flow.

The agent doesn't need a public URL — it connects out to LiveKit Cloud as a worker.

---

## Customizing the persona

Single source of truth for persona is [`agent/voice_agent/persona_config.py`](agent/voice_agent/persona_config.py):

- `PERSONA_NAME` — who the agent claims to be
- `ENGLISH_PERSONA_INTRO` / `SPANISH_PERSONA_INTRO` — opening directives (including the language constraint)
- `ENGLISH_GREETINGS` / `SPANISH_GREETINGS` — randomly selected at session start
- `_WARM_TONE_GUIDELINES` — shared persona behaviour across both languages
- `STT_KEYWORDS` — Deepgram keyterm boosting (English-only by Deepgram limitation)

Client-side branding lives in [`client/config/persona.config.ts`](client/config/persona.config.ts) — page title, tagline, hero copy, share copies, footer links.

For a full how-to (and which images to swap), see [`docs/FORKING.md`](docs/FORKING.md) — most of it still applies, just substitute "Austin" → your persona.

---

## License

[MIT](LICENSE) — same as upstream AustinGPT.

## Credits

Built on top of [devfolioco/austingpt](https://github.com/devfolioco/austingpt) — credit to the original Devfolio team for the LiveKit-on-Next.js scaffolding and persona system. SoleneGPT swaps the persona, adds Solana x402 payments, and reframes the two-mood UI as a language selector.
