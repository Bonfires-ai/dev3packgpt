import { AgentMoodEnum, type AgentMoodI } from '@/types/agent';
import { NextResponse } from 'next/server';

// The most recently ingested YouTube video in a language's bonfire, for the
// quick-option chip that asks the agent about it. Each language has its own
// bonfire (dev3pack / dev3pack_es); its read key stays on the server.
const API_URL = process.env.BONFIRES_API_URL ?? 'https://api.bonfires.ai';
const KEYS: Record<AgentMoodI, string | undefined> = {
  [AgentMoodEnum.ENGLISH]: process.env.BONFIRES_KEY_EN,
  [AgentMoodEnum.SPANISH]: process.env.BONFIRES_KEY_ES,
};

// New videos are rare; one lookup per language every few minutes is plenty.
const CACHE_SECONDS = 300;

interface BonfireDocument {
  title?: string | null;
  source_uri: string;
  status: string;
  created_at: string;
}

// Titles can carry a language flag ("… + Wallets 🇬🇧"); the chip and the
// question use the plain title.
// Built from a string: the tsconfig target (es5) rejects the `u` flag in a literal.
const EMOJI = new RegExp('[\\u{1F1E6}-\\u{1F1FF}\\p{Extended_Pictographic}\\uFE0F\\u200D]', 'gu');
const plainTitle = (title: string) =>
  title
    .replace(EMOJI, '')
    .replace(/\s+/g, ' ')
    .trim();

const isYouTube = (uri: string) => /^https?:\/\/(www\.|m\.)?(youtube\.com|youtu\.be)\//i.test(uri);

async function bonfires<T>(path: string, key: string): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { Authorization: `Bearer ${key}` },
    next: { revalidate: CACHE_SECONDS },
  });
  if (!res.ok) throw new Error(`Bonfires ${path} returned ${res.status}`);
  return res.json();
}

export async function GET(request: Request) {
  const lang = new URL(request.url).searchParams.get('lang');
  const key = lang ? KEYS[lang as AgentMoodI] : undefined;
  if (!key) return NextResponse.json({ video: null });

  try {
    // A key is bound to one bonfire, so the listing names it.
    const { bonfires: list } = await bonfires<{ bonfires: { id: string }[] }>('/v1/bonfires', key);
    const bonfireId = list[0]?.id;
    if (!bonfireId) return NextResponse.json({ video: null });

    const { documents } = await bonfires<{ documents: BonfireDocument[] }>(
      `/v1/bonfires/${encodeURIComponent(bonfireId)}/documents`,
      key
    );
    const latest = documents
      .filter(doc => isYouTube(doc.source_uri) && doc.title && doc.status !== 'failed')
      .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))[0];

    return NextResponse.json(
      { video: latest?.title ? { title: plainTitle(latest.title), url: latest.source_uri } : null },
      { headers: { 'Cache-Control': `public, s-maxage=${CACHE_SECONDS}` } }
    );
  } catch (err) {
    console.error('Could not look up the latest video', err);
    return NextResponse.json({ video: null });
  }
}
