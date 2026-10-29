import { personaConfig } from '@/config/persona.config';
import { AgentMoodEnum } from '@/types/agent';
import { Metadata } from 'next';
import { headers } from 'next/headers';
import { RedirectHome } from './RedirectHome';

type Props = { searchParams: { lang?: string } };

/**
 * The link shared on X. X reads this page's tags and shows the session card
 * (public/share-cards/session-<mood>.png, from scripts/render-share-cards.mjs) as
 * a large preview; people who click through land on the home page.
 */
export function generateMetadata({ searchParams }: Props): Metadata {
  const mood = searchParams.lang === AgentMoodEnum.FRENCH ? 'french' : 'english';
  const card = personaConfig.moods[mood].endCard;

  // Absolute URLs from this request's host, so the preview works wherever the app is deployed.
  const h = headers();
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? '';
  const proto = h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https');
  const origin = `${proto}://${host}`;
  const image = { url: `${origin}/share-cards/session-${mood}.png`, width: 1200, height: 628, alt: card.title };
  const title = `${card.title} · ${personaConfig.appName}`;

  return {
    title,
    description: card.body,
    openGraph: { type: 'website', url: `${origin}/share?lang=${mood}`, title, description: card.body, images: [image] },
    twitter: { card: 'summary_large_image', title, description: card.body, images: [image] },
  };
}

export default function SharePage() {
  return <RedirectHome />;
}
