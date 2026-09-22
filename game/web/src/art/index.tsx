// Illustration resolver. Any file dropped into src/art/custom/ named after an art key
// (e.g. custom/card-fireball.png, custom/land-meadow.webp) replaces the built-in SVG — see README.md.
import { useId } from 'react';
import { Backdrop, Frame, type Scene } from './kit.tsx';
import { MONSTERS, CELLS } from './monsters.tsx';
import { CARD_ART, CardBackArt } from './cards.tsx';
import { LAND_ART_KEY, cardFrame } from '../labels.ts';

const files = import.meta.glob('./custom/*.{png,jpg,jpeg,webp,avif,svg,gif}', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
const CUSTOM: Record<string, string> = {};
for (const [path, url] of Object.entries(files)) {
  const key = path.replace(/^.*\//, '').replace(/\.[^.]+$/, '').toLowerCase();
  CUSTOM[key] = url;
}

const REGION_SCENE: Scene[] = ['valley', 'forest', 'mountains', 'abyss'];
const FRAME_SCENE = { artifact: 'bronze', spell: 'arcane', help: 'green', hinder: 'crimson' } as const;

export type ArtRef =
  | { kind: 'land'; name: string; region: number }
  | { kind: 'cell'; type: string }
  | { kind: 'card'; id: string }
  | { kind: 'back'; deck: 'artifact' | 'spell' };

export function artKey(r: ArtRef): string {
  switch (r.kind) {
    case 'land': return `land-${LAND_ART_KEY[r.name] ?? r.name}`;
    case 'cell': return `cell-${r.type}`;
    case 'card': return `card-${r.id}`;
    case 'back': return `back-${r.deck}`;
  }
}

export function hasCustomArt(r: ArtRef): boolean {
  return artKey(r).toLowerCase() in CUSTOM;
}

/** Renders the illustration for a Land, special cell, card or card back. Fills its container. */
export function Art({ of, className = '' }: { of: ArtRef; className?: string }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const key = artKey(of);
  const url = CUSTOM[key.toLowerCase()];
  if (url) return <img className={`art-img ${className}`} src={url} alt="" draggable={false} />;
  let scene: Scene = 'road';
  let body = null;
  let label = '';
  if (of.kind === 'land') {
    scene = REGION_SCENE[of.region] ?? 'valley';
    body = MONSTERS[LAND_ART_KEY[of.name] ?? '']?.() ?? null;
    label = of.name;
  } else if (of.kind === 'cell') {
    scene = of.type === 'start' ? 'gate' : 'road';
    body = CELLS[of.type]?.() ?? null;
    label = of.type;
  } else if (of.kind === 'card') {
    scene = FRAME_SCENE[cardFrame(of.id)];
    body = CARD_ART[of.id]?.() ?? null;
    label = of.id;
  } else {
    scene = of.deck === 'artifact' ? 'bronze' : 'arcane';
    body = <CardBackArt kind={of.deck} />;
    label = 'рубашка';
  }
  return (
    <span className={`art ${className}`}>
      <Frame label={label}>
        <Backdrop scene={scene} uid={uid} />
        {body}
      </Frame>
    </span>
  );
}
