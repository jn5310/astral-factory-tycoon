import { createEnemy } from '../entities/Enemy';
import type { EnemyType } from '../data/enemies';
import { drawEnemy } from '../core/renderUnits';

const cache = new Map<EnemyType, string>();

/** Portrait of an alien drawn with the in-game renderer (for the codex). */
export function enemyIconUrl(type: EnemyType): string {
  const hit = cache.get(type);
  if (hit) return hit;
  const px = 96;
  const canvas = document.createElement('canvas');
  canvas.width = px;
  canvas.height = px;
  const g = canvas.getContext('2d');
  if (g) {
    const e = createEnemy(0, type, 0, 0);
    e.angle = -Math.PI / 4;
    e.anim = 0.3;
    // Leviathans are huge and trail a long body; zoom out for them.
    const span = type === 'leviathan' ? 7.5 : Math.max(2.2, e.radius * 5);
    const scale = px / span;
    g.setTransform(scale, 0, 0, scale, px * (type === 'leviathan' ? 0.62 : 0.5), px * (type === 'leviathan' ? 0.4 : 0.5));
    drawEnemy(g, e, 0.4, true);
  }
  const url = canvas.toDataURL();
  cache.set(type, url);
  return url;
}
