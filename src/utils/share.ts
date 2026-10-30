export type ShareOutcome = 'shared' | 'downloaded' | 'failed';

const MAX_WIDTH = 1600;

/**
 * Captures the game canvas with a caption band and shares it with the Web Share API,
 * falling back to a PNG download. The image is generated at runtime (no asset files).
 */
export async function shareScreenshot(source: HTMLCanvasElement, title: string, lines: readonly string[], text: string): Promise<ShareOutcome> {
  const scale = Math.min(1, MAX_WIDTH / Math.max(1, source.width));
  const w = Math.max(1, Math.round(source.width * scale));
  const h = Math.max(1, Math.round(source.height * scale));
  const band = Math.round(Math.max(90, h * 0.16));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h + band;
  const g = canvas.getContext('2d');
  if (!g) return 'failed';
  g.fillStyle = '#03050b';
  g.fillRect(0, 0, w, h + band);
  g.drawImage(source, 0, 0, w, h);
  const grad = g.createLinearGradient(0, h, 0, h + band);
  grad.addColorStop(0, '#0b1224');
  grad.addColorStop(1, '#020409');
  g.fillStyle = grad;
  g.fillRect(0, h, w, band);
  g.fillStyle = '#22d3ee';
  g.fillRect(0, h, w, 3);
  const pad = Math.round(band * 0.18);
  g.textBaseline = 'top';
  g.fillStyle = '#e0f2fe';
  g.font = `800 ${Math.round(band * 0.26)}px system-ui, sans-serif`;
  g.fillText(title, pad, h + pad);
  g.fillStyle = '#94a3b8';
  g.font = `600 ${Math.round(band * 0.17)}px system-ui, sans-serif`;
  lines.forEach((line, i) => g.fillText(line, pad, h + pad + band * 0.34 + i * band * 0.22));

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob) return 'failed';
  const file = new File([blob], 'astral-factory.png', { type: 'image/png' });
  const nav = navigator as Navigator & { canShare?: (data: ShareData) => boolean };
  if (nav.share && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], text, title });
      return 'shared';
    } catch (err) {
      // The user closing the share sheet is not an error worth reporting.
      if (err instanceof DOMException && err.name === 'AbortError') return 'shared';
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'astral-factory.png';
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
  return 'downloaded';
}
