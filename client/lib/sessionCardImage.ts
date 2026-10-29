/**
 * Draws the session-complete card as a PNG for sharing. Ported from
 * PersonaFrame's canvas drawing on main (same layout, colours and fonts),
 * with session copy in place of the idea. 1200x628 is X's large-card size.
 *
 * No imports, so scripts/render-share-cards can compile and run this file
 * outside Next to produce the link-preview images in public/share-cards/.
 */

const WIDTH = 1200;
const HEIGHT = 628;
// PersonaFrame drew at 650x340; scale its measurements up.
const S = WIDTH / 650;

const PURPLE = '#A15EED';
const BG = '#FAFAFA';
const TEXT_DARK = '#111111';
const TEXT_MID = '#6B7280';

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

export async function renderSessionCard({
  label,
  motif,
  title,
  fonts,
  logoSrc = '/dev3pack-logo.jpg',
}: {
  label: string;
  motif: string;
  title: string;
  // CSS font-family names for Druk Condensed Super and Inconsolata.
  fonts: { display: string; mono: string };
  logoSrc?: string;
}): Promise<Blob> {
  const mono = `${fonts.mono}, monospace`;
  const display = fonts.display;
  // The fonts are loaded by the page already; make sure before drawing.
  await Promise.all([document.fonts.load(`900 64px ${display}`), document.fonts.load(`500 12px ${mono}`)]);

  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas not supported');
  ctx.scale(S, S);
  const w = 650;
  const h = 340;

  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.06)';
  for (let x = 9; x < w; x += 18) {
    for (let y = 9; y < h; y += 18) {
      ctx.beginPath();
      ctx.arc(x, y, 0.8, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Top-left label and accent bar
  ctx.textAlign = 'left';
  ctx.fillStyle = PURPLE;
  ctx.font = `500 12px ${mono}`;
  ctx.fillText(label.toUpperCase(), 36, 44);
  ctx.fillRect(36, 54, 24, 2);

  // Motif line
  ctx.textAlign = 'center';
  ctx.fillStyle = TEXT_MID;
  ctx.font = `400 16px ${mono}`;
  ctx.fillText(motif, w / 2, h / 2 - 30);

  // Title, scaled down to fit, with the purple underline
  const upper = title.toUpperCase();
  ctx.font = `900 64px ${display}`;
  const fit = Math.min(1, 460 / ctx.measureText(upper).width);
  ctx.font = `900 ${64 * fit}px ${display}`;
  const titleWidth = ctx.measureText(upper).width;
  const titleY = h / 2 + 30;
  ctx.fillStyle = TEXT_DARK;
  ctx.fillText(upper, w / 2, titleY);
  ctx.fillStyle = PURPLE;
  ctx.fillRect(w / 2 - (titleWidth + 16) / 2, titleY + 12, titleWidth + 16, 4);

  // Bottom branding
  try {
    const logo = await loadImage(logoSrc);
    const logoH = 28;
    const logoW = logoH * (logo.width / logo.height);
    ctx.drawImage(logo, w - 32 - logoW, h - 32, logoW, logoH);
  } catch {
    // The card still works without the logo.
  }
  ctx.fillStyle = PURPLE;
  ctx.fillRect(36, h - 32, 16, 2);
  ctx.font = `400 9px ${mono}`;
  ctx.fillStyle = '#B0B7BC';
  ctx.textAlign = 'left';
  ctx.fillText('dev3pack.xyz', 36, h - 18);

  return new Promise((resolve, reject) =>
    canvas.toBlob(blob => (blob ? resolve(blob) : reject(new Error('Could not render the card'))), 'image/png')
  );
}
