// Card catalog: every Artifact and Spell that any rules version may put in its decks.
import type { Engine, GameState, LandState, Phase, PlayerState } from '../core/types.ts';
import { CARD_KIND, discard, ev, gainPower, loseTokens, pay, setOwner } from '../core/actions.ts';
import { effPower, inSet, logMsg, power } from '../core/state.ts';
import { exchangeOptions } from '../core/tokens.ts';

export interface ArtifactDef {
  id: string;
  name: string;
  text: (g: GameState) => string;
  /** Enemy spells cannot target this Land. */
  protects?: boolean;
  onVisit: (g: GameState, visitor: PlayerState, owner: PlayerState, land: LandState) => Engine;
}

export interface SpellDef {
  id: string;
  /** Played in another player's fight: 'help' adds to the fighter, 'hinder' adds to the monster. */
  reaction?: 'help' | 'hinder';
  name: string;
  text: (g: GameState) => string;
  phases: Phase[];
  /** Legal targets: player ids, cell indices, or [-1] for untargeted; [] = cannot cast. */
  targets: (g: GameState, p: PlayerState) => number[];
  apply: (g: GameState, p: PlayerState, target: number) => Engine;
}

// eslint-disable-next-line require-yield
function* nothing(): Engine {}

const P = (g: GameState, k: string) => g.rules.params[k] ?? 0;

export const ARTIFACTS: Record<string, ArtifactDef> = {
  tribute: {
    id: 'tribute', name: 'Дань',
    text: (g) => `Гость платит владельцу ${P(g, 'tribute')} мощи.`,
    onVisit: (g, v, o) => pay(g, v, P(g, 'tribute'), o.id, 'Дань'),
  },
  bigTribute: {
    id: 'bigTribute', name: 'Великая Дань',
    text: (g) => `Гость платит владельцу ${P(g, 'bigTribute')} мощи.`,
    onVisit: (g, v, o) => pay(g, v, P(g, 'bigTribute'), o.id, 'Великая Дань'),
  },
  trap: {
    id: 'trap', name: 'Капкан',
    text: (g) => `Гость теряет ${P(g, 'trapDamage') || 1} жетон(а).`,
    onVisit: (g, v, o) => loseTokens(g, v, P(g, 'trapDamage') || 1, 'Капкан', o.id),
  },
  pickpocket: {
    id: 'pickpocket', name: 'Карманник',
    text: () => 'Владелец забирает случайную карту из руки гостя.',
    *onVisit(g, v, o) {
      if (v.shield > 0) { v.shield--; ev(g, 'shieldBlock', v.id, 1, 'Карманник'); return; }
      if (!v.hand.length) return;
      const i = g.rng.int(v.hand.length);
      const [card] = v.hand.splice(i, 1);
      o.hand.push(card);
      logMsg(g, `${o.name} крадёт карту у ${v.name}`);
    },
  },
  shackles: {
    id: 'shackles', name: 'Оковы',
    text: () => 'Гость пропускает свой следующий ход.',
    *onVisit(g, v) {
      if (v.shield > 0) { v.shield--; ev(g, 'shieldBlock', v.id, 1, 'Оковы'); return; }
      v.skip += 1;
      logMsg(g, `${v.name} скован и пропустит ход`);
    },
  },
  exile: {
    id: 'exile', name: 'Изгнание',
    text: () => 'Гость переносится на Врата (без дохода).',
    *onVisit(g, v) {
      if (v.shield > 0) { v.shield--; ev(g, 'shieldBlock', v.id, 1, 'Изгнание'); return; }
      v.pos = 0;
      logMsg(g, `${v.name} изгнан на Врата`);
    },
  },
  guardian: {
    id: 'guardian', name: 'Страж',
    text: () => 'Чужие Заклятия не могут выбрать эту Землю целью.',
    protects: true,
    onVisit: () => nothing(),
  },
  // --- candidates introduced by later generations ---
  bastion: {
    id: 'bastion', name: 'Бастион',
    text: (g) => `Защита Земли от вызова +${P(g, 'bastion')}. Чужие Заклятия не могут выбрать эту Землю.`,
    protects: true,
    onVisit: () => nothing(),
  },
  toll: {
    id: 'toll', name: 'Пошлина',
    text: (g) => `Гость платит владельцу ${P(g, 'toll')} мощи за каждую Землю владельца в этом регионе.`,
    *onVisit(g, v, o, land) {
      let n = 0;
      for (const c of g.cells) if (c.land && c.land.owner === o.id && c.land.region === land.region) n++;
      yield* pay(g, v, P(g, 'toll') * n, o.id, 'Пошлина');
    },
  },
};

function otherAlive(g: GameState, p: PlayerState): number[] {
  const out: number[] = [];
  for (const q of g.players) if (q.alive && q.id !== p.id) out.push(q.id);
  return out;
}

const hasArtifact = (l: LandState) => l.artifact !== null;

function enemyLands(g: GameState, p: PlayerState, pred: (l: LandState) => boolean = () => true): number[] {
  const out: number[] = [];
  for (const c of g.cells) {
    const l = c.land;
    if (!l || l.owner < 0 || l.owner === p.id) continue;
    if (l.artifact && ARTIFACTS[l.artifact].protects) continue;
    if (g.rules.params.setProtect && inSet(g, l)) continue;
    // params.landSpellsNeedEmpty = 1: land-taking spells (Узурпация/Освобождение) only hit Lands WITHOUT an Artifact
    if (g.rules.params.landSpellsNeedEmpty && l.artifact && pred !== hasArtifact) continue;
    if (pred(l)) out.push(l.cell);
  }
  return out;
}

export const SPELLS: Record<string, SpellDef> = {
  fireball: {
    id: 'fireball', name: 'Огненный шар',
    text: (g) => `Выбранный игрок теряет ${P(g, 'fireballDamage') || 1} жетон.`,
    phases: ['pre', 'post'],
    targets: otherAlive,
    apply: (g, p, t) => loseTokens(g, g.players[t], P(g, 'fireballDamage') || 1, 'Огненный шар', p.id),
  },
  heal: {
    id: 'heal', name: 'Исцеление',
    text: (g) => `Получите жетон ${P(g, 'heal')}.`,
    phases: ['pre', 'post'],
    targets: (g, p) => (p.tokens.length < g.rules.maxSlots ? [-1] : []),
    *apply(g, p) { gainPower(g, p, P(g, 'heal'), 'Исцеление'); },
  },
  shatter: {
    id: 'shatter', name: 'Разрушение',
    text: () => 'Уничтожьте Артефакт на чужой Земле.',
    phases: ['pre', 'post'],
    targets: (g, p) => enemyLands(g, p, hasArtifact),
    *apply(g, _p, t) {
      const l = g.cells[t].land!;
      if (l.artifact) discard(g, l.artifact);
      l.artifact = null;
    },
  },
  usurp: {
    id: 'usurp', name: 'Узурпация',
    text: (g) => (g.rules.params.usurpAny ? 'Заберите любую чужую Землю. Артефакт на ней уничтожается.' : 'Заберите чужую Землю, если ваша мощь больше мощи её владельца. Артефакт на ней уничтожается.'),
    phases: ['pre', 'post'],
    // params.usurpAny = 1: no power comparison (tabletop simplification)
    targets: (g, p) => enemyLands(g, p, (l) => (g.rules.params.usurpAny ? true : effPower(p) > power(g.players[l.owner]))),
    *apply(g, p, t) {
      const l = g.cells[t].land!;
      if (l.artifact) discard(g, l.artifact);
      l.artifact = null;
      setOwner(g, l, p.id);
      ev(g, 'capture', p.id, t, 'usurp');
    },
  },
  teleport: {
    id: 'teleport', name: 'Телепорт',
    text: () => 'Вместо броска кубика встаньте на любую клетку (без дохода Врат).',
    phases: ['pre'],
    targets: (g, p) => g.cells.map((c) => c.index).filter((i) => i !== p.pos),
    *apply(_g, p, t) { p.teleportTo = t; },
  },
  fury: {
    id: 'fury', name: 'Ярость',
    text: (g) => `+${P(g, 'fury')} к вашей мощи до конца хода.`,
    phases: ['pre'],
    targets: () => [-1],
    *apply(g, p) { p.tempPower += P(g, 'fury'); },
  },
  release: {
    id: 'release', name: 'Освобождение',
    text: () => 'Чужая Земля снова становится дикой (монстр возвращается), Артефакт уничтожается.',
    phases: ['pre', 'post'],
    targets: (g, p) => enemyLands(g, p),
    *apply(g, _p, t) {
      const l = g.cells[t].land!;
      if (l.artifact) discard(g, l.artifact);
      l.artifact = null;
      setOwner(g, l, -1);
    },
  },
  drain: {
    id: 'drain', name: 'Вытягивание',
    text: (g) => `Выбранный игрок платит вам ${P(g, 'drain')} мощи.`,
    phases: ['pre', 'post'],
    targets: otherAlive,
    apply: (g, p, t) => pay(g, g.players[t], P(g, 'drain'), p.id, 'Вытягивание'),
  },
  // --- candidates introduced by later generations ---
  aid: {
    id: 'aid', name: 'Подмога', reaction: 'help',
    text: (g) => `В ЧУЖОЙ ход, когда игрок встречает монстра: +${P(g, 'aid')} к его мощи в этом бою. Если он победил — возьмите из банка жетон ${P(g, 'aidReward')}.`,
    phases: [],
    targets: () => [],
    *apply() {},
  },
  hex: {
    id: 'hex', name: 'Помеха', reaction: 'hinder',
    text: (g) => `В ЧУЖОЙ ход, когда игрок встречает монстра: +${P(g, 'hex')} к мощи монстра в этом бою.`,
    phases: [],
    targets: () => [],
    *apply() {},
  },
  ward: {
    id: 'ward', name: 'Оберег',
    text: () => 'Следующий вредный эффект против вас отменяется.',
    phases: ['pre', 'post'],
    targets: (_g, p) => (p.shield === 0 ? [-1] : []),
    *apply(_g, p) { p.shield = 1; },
  },
  transmute: {
    id: 'transmute', name: 'Алхимия',
    text: () => 'Разменяйте один свой жетон на меньшие того же номинала или соберите мелкие в один крупный.',
    phases: ['pre', 'post'],
    targets: (g, p) => exchangeOptions(p.tokens, g.rules).map((_, i) => i),
    *apply(g, p, t) {
      const o = exchangeOptions(p.tokens, g.rules)[t];
      if (!o) return;
      applyExchange(g, p, o);
    },
  },
};

export function applyExchange(g: GameState, p: PlayerState, o: { give: number; take: number[] }): void {
  if (o.give > 0) {
    const i = p.tokens.indexOf(o.give);
    p.tokens.splice(i, 1);
    p.tokens.push(...o.take);
  } else {
    for (const t of o.take) p.tokens.splice(p.tokens.indexOf(t), 1);
    p.tokens.push(-o.give);
  }
  p.tokens.sort((a, b) => b - a);
  ev(g, 'exchange', p.id, p.tokens.length, null);
}

for (const id of Object.keys(ARTIFACTS)) CARD_KIND[id] = 'artifact';
for (const id of Object.keys(SPELLS)) CARD_KIND[id] = 'spell';

export function cardName(id: string): string {
  return ARTIFACTS[id]?.name ?? SPELLS[id]?.name ?? id;
}
