// Card catalog: every Artifact and Spell that any rules version may put in its decks.
import type { Engine, GameState, LandState, Phase, PlayerState } from '../core/types.ts';
import { CARD_KIND, discard, ev, gainPower, loseTokens, pay, setOwner } from '../core/actions.ts';
import { effPower, inSet, landsOf, logMsg, power } from '../core/state.ts';
import { exchangeOptions } from '../core/tokens.ts';

export interface ArtifactDef {
  id: string;
  name: string;
  text: (g: GameState) => string;
  /** Enemy spells cannot target this Land. */
  protects?: boolean;
  onVisit: (g: GameState, visitor: PlayerState, owner: PlayerState, land: LandState) => Engine;
}

/**
 * Engine entry points that card effects need (set by engine.ts at load — avoids a circular import).
 * resolveCell: a player arrives on a cell; encounter: a player meets the monster of a Land.
 */
export const ENGINE_HOOKS: {
  resolveCell?: (g: GameState, p: PlayerState) => Engine;
  encounter?: (g: GameState, p: PlayerState, land: LandState) => Engine;
} = {};

/** Зыбучие Пески chain guard (a visitor can sink through at most 4 Sands in one arrival). */
let sinkDepth = 0;

export interface SpellDef {
  id: string;
  /** Played in another player's fight: 'help' adds to the fighter, 'hinder' adds to the monster. */
  reaction?: 'help' | 'hinder';
  /**
   * v1.0.1 answer cards, played only when their moment comes (never in the main phase):
   *  'counter'   — cancel an enemy Spell aimed at you or your Land (Зеркало);
   *  'ambush'    — an enemy stops on your Land: he loses 1 token (Засада);
   *  'courage'   — your own fight: you win on 4–6 instead of 6 (Отвага);
   *  'intercept' — an enemy captures a Land from a monster: you take the reward token (Перехват).
   */
  trigger?: 'counter' | 'ambush' | 'courage' | 'intercept';
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
    text: (g) => (g.rules.payMode === 'sum' ? `Гость платит владельцу ${P(g, 'tribute')} мощи.` : 'Гость отдаёт владельцу 1 свой жетон (на свой выбор).'),
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
  outpost: {
    id: 'outpost', name: 'Застава',
    text: () => 'Гость выбирает: отдать владельцу 1 жетон ИЛИ пропустить свой следующий ход.',
    *onVisit(g, v, o) {
      const opts = [{ t: 'choose' as const, key: 'token' }, { t: 'choose' as const, key: 'skip' }];
      const idx = yield { kind: 'dilemma', player: v.id, options: opts, reason: `Застава ${o.name}: отдать жетон или пропустить ход?`, amount: o.id };
      if (opts[idx].key === 'skip') {
        v.skip += 1;
        logMsg(g, `${v.name} выбирает пропуск хода на Заставе`);
      } else {
        yield* pay(g, v, g.rules.params.tribute ?? 0, o.id, 'Застава');
      }
    },
  },
  bastion: {
    id: 'bastion', name: 'Бастион',
    text: (g) => `Защита Земли от вызова +${P(g, 'bastion')}. Чужие Заклятия не могут выбрать эту Землю.`,
    protects: true,
    onVisit: () => nothing(),
  },
  // --- v1.0.1 candidates (Gen 23+) ---
  envy: {
    id: 'envy', name: 'Зависть',
    text: () => 'Если у гостя больше Земель, чем у владельца, гость отдаёт владельцу 1 жетон.',
    *onVisit(g, v, o) {
      if (landsOf(g, v.id).length <= landsOf(g, o.id).length) { logMsg(g, `Зависть ${o.name}: у ${v.name} не больше Земель — ничего`); return; }
      yield* pay(g, v, P(g, 'tribute'), o.id, 'Зависть');
    },
  },
  quicksand: {
    id: 'quicksand', name: 'Зыбучие Пески',
    text: (g) => `Гость отступает на ${P(g, 'quicksand') || 3} клетки назад и выполняет новую клетку (без дохода Врат).`,
    *onVisit(g, v) {
      const n = g.cells.length;
      v.pos = (v.pos - (P(g, 'quicksand') || 3) + n) % n;
      ev(g, 'move', v.id, 0, v.pos);
      logMsg(g, `${v.name} тонет в Зыбучих Песках и отступает на клетку ${v.pos}`);
      sinkDepth++;
      try {
        if (sinkDepth <= 4 && ENGINE_HOOKS.resolveCell) yield* ENGINE_HOOKS.resolveCell(g, v);
      } finally {
        sinkDepth--;
      }
    },
  },
  mimic: {
    id: 'mimic', name: 'Сундук-Мимик',
    text: (g) => `Гость бросает кубик: 1–${P(g, 'mimicBite') || 4} — теряет 1 жетон; иначе берёт из банка жетон ${P(g, 'mimicGift') || 300}.`,
    *onVisit(g, v, o) {
      const roll = g.rng.d6();
      if (roll <= (P(g, 'mimicBite') || 4)) {
        logMsg(g, `Сундук-Мимик кусает ${v.name} (бросок ${roll})`);
        yield* loseTokens(g, v, 1, 'Сундук-Мимик', o.id);
      } else {
        logMsg(g, `${v.name} открывает Сундук-Мимик и находит сокровище (бросок ${roll})`);
        gainPower(g, v, P(g, 'mimicGift') || 300, 'Сундук-Мимик');
      }
    },
  },
  spy: {
    id: 'spy', name: 'Соглядатай',
    text: () => 'Гость отдаёт владельцу 1 карту с руки (на свой выбор).',
    *onVisit(g, v, o) {
      if (!v.hand.length) return;
      const distinct = [...new Set(v.hand)];
      let card = distinct[0];
      if (distinct.length > 1) {
        const opts = distinct.map((c) => ({ t: 'discard' as const, card: c }));
        const idx = yield { kind: 'discard', player: v.id, options: opts, reason: `Соглядатай ${o.name}: отдайте ему 1 карту` };
        card = opts[idx].card;
      }
      v.hand.splice(v.hand.indexOf(card), 1);
      o.hand.push(card);
      logMsg(g, `${v.name} отдаёт карту ${o.name} (Соглядатай)`);
    },
  },
  altar: {
    id: 'altar', name: 'Алтарь',
    text: () => 'Гость выбирает: потерять 1 жетон ИЛИ сбросить все карты с руки (без карт — теряет жетон).',
    *onVisit(g, v, o) {
      let lose = v.hand.length === 0;
      if (!lose) {
        const opts = [{ t: 'choose' as const, key: 'token' }, { t: 'choose' as const, key: 'hand' }];
        const idx = yield { kind: 'dilemma', player: v.id, options: opts, reason: `Алтарь ${o.name}: потерять жетон или сбросить все карты (${v.hand.length})?`, amount: o.id };
        lose = opts[idx].key === 'token';
      }
      if (lose) yield* loseTokens(g, v, 1, 'Алтарь', o.id);
      else {
        logMsg(g, `${v.name} сжигает на Алтаре все карты (${v.hand.length})`);
        for (const c of v.hand) discard(g, c);
        v.hand = [];
      }
    },
  },
  vein: {
    id: 'vein', name: 'Золотая Жила',
    text: (g) => `Пока Жила лежит на вашей Земле, на Вратах вы берёте жетон ${P(g, 'veinIncome') || 300} вместо ${g.rules.startIncome}. Гостю — ничего.`,
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
    text: (g) => (g.rules.payMode === 'sum' ? `Выбранный игрок платит вам ${P(g, 'drain')} мощи.` : 'Выбранный соперник отдаёт вам 1 свой жетон (на свой выбор).'),
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

export const NEXT_DENOM = (g: GameState, t: number): number => {
  const up = g.rules.denominations.filter((d) => d > t);
  return up.length ? up[up.length - 1] : 0;
};

/** The one player who owns strictly more Lands than everyone else (or null). */
export function landLeader(g: GameState): PlayerState | null {
  let best: PlayerState | null = null;
  let bestN = 0;
  let tie = false;
  for (const q of g.players) {
    if (!q.alive) continue;
    const n = landsOf(g, q.id).length;
    if (n > bestN) { best = q; bestN = n; tie = false; } else if (n === bestN) tie = true;
  }
  return best && !tie ? best : null;
}

/** First wild Land strictly ahead of `from` (clockwise), or -1. */
export function nextWildLand(g: GameState, from: number): number {
  const n = g.cells.length;
  for (let k = 1; k < n; k++) {
    const c = g.cells[(from + k) % n];
    if (c.land && c.land.owner === -1) return c.index;
  }
  return -1;
}

// --- v1.0.1 Spells (Gen 23+) ---
Object.assign(SPELLS, {
  secondWind: {
    id: 'secondWind', name: 'Второе Дыхание',
    text: (g) => `Играется, только если ни у кого нет меньше Земель, чем у вас. Возьмите из банка жетон ${P(g, 'secondWind') || 500}.`,
    phases: ['pre', 'post'],
    targets: (g, p) => {
      const mine = landsOf(g, p.id).length;
      return g.players.some((q) => q.alive && q.id !== p.id && landsOf(g, q.id).length < mine) ? [] : [-1];
    },
    *apply(g, p) { gainPower(g, p, P(g, 'secondWind') || 500, 'Второе Дыхание'); },
  },
  revolt: {
    id: 'revolt', name: 'Бунт',
    text: () => 'У игрока, у которого Земель больше, чем у каждого другого, одна его Земля (на ваш выбор) становится дикой. Артефакт с неё уходит в сброс.',
    phases: ['pre', 'post'],
    targets: (g, p) => {
      const L = landLeader(g);
      if (!L || L.id === p.id) return [];
      return landsOf(g, L.id).map((l) => l.cell);
    },
    *apply(g, _p, t) {
      const l = g.cells[t].land!;
      if (l.artifact) discard(g, l.artifact);
      l.artifact = null;
      setOwner(g, l, -1);
    },
  },
  swap: {
    id: 'swap', name: 'Подмена',
    text: () => 'Заберите у соперника его самый крупный жетон и отдайте ему свой самый мелкий.',
    phases: ['pre', 'post'],
    targets: (g, p) => {
      const mine = p.tokens[p.tokens.length - 1];
      return otherAlive(g, p).filter((id) => mine !== undefined && g.players[id].tokens[0] > mine);
    },
    *apply(g, p, t) {
      const q = g.players[t];
      const big = q.tokens.shift()!;
      const small = p.tokens.pop()!;
      p.tokens.push(big);
      q.tokens.push(small);
      p.tokens.sort((a, b) => b - a);
      q.tokens.sort((a, b) => b - a);
      ev(g, 'receive', p.id, big - small, 'Подмена');
      logMsg(g, `${p.name} подменяет жетоны: берёт ${big} у ${q.name}, отдаёт ${small}`);
    },
  },
  tailwind: {
    id: 'tailwind', name: 'Попутный Ветер',
    text: () => 'До броска: в этот ход бросьте кубик дважды и выберите, какой результат использовать.',
    phases: ['pre'],
    targets: (_g, p) => (p.teleportTo < 0 && !p.rollTwice ? [-1] : []),
    *apply(_g, p) { p.rollTwice = true; },
  },
  loot: {
    id: 'loot', name: 'Трофей',
    text: () => 'Заберите Артефакт с чужой Земли себе в руку.',
    phases: ['pre', 'post'],
    targets: (g, p) => enemyLands(g, p, hasArtifact),
    *apply(g, p, t) {
      const l = g.cells[t].land!;
      if (!l.artifact) return;
      p.hand.push(l.artifact);
      logMsg(g, `${p.name} забирает «${ARTIFACTS[l.artifact].name}» с ${l.name}`);
      l.artifact = null;
    },
  },
  luxuryTax: {
    id: 'luxuryTax', name: 'Налог на Роскошь',
    text: () => 'Каждый соперник, у которого Земель больше, чем у вас, отдаёт вам 1 жетон (на свой выбор).',
    phases: ['pre', 'post'],
    targets: (g, p) => {
      const mine = landsOf(g, p.id).length;
      return g.players.some((q) => q.alive && q.id !== p.id && landsOf(g, q.id).length > mine) ? [-1] : [];
    },
    *apply(g, p) {
      const mine = landsOf(g, p.id).length;
      const payers = g.players.filter((q) => q.alive && q.id !== p.id && landsOf(g, q.id).length > mine);
      for (const q of payers) yield* pay(g, q, P(g, 'tribute'), p.id, 'Налог на Роскошь');
    },
  },
  quake: {
    id: 'quake', name: 'Землетрясение',
    text: () => 'Каждый игрок, у которого 4 или 5 жетонов (и вы тоже), теряет 1 жетон.',
    phases: ['pre', 'post'],
    targets: (g, p) => (otherAlive(g, p).some((id) => g.players[id].tokens.length >= 4) ? [-1] : []),
    *apply(g, p) {
      const hit = g.players.filter((q) => q.alive && q.tokens.length >= 4);
      for (const q of hit) yield* loseTokens(g, q, 1, 'Землетрясение', q.id === p.id ? -1 : p.id);
    },
  },
  lure: {
    id: 'lure', name: 'Приманка',
    text: () => 'Выбранный соперник переносится на ближайшую впереди него дикую Землю и сразу встречает её монстра.',
    phases: ['pre', 'post'],
    targets: (g, p) => otherAlive(g, p).filter((id) => nextWildLand(g, g.players[id].pos) >= 0),
    *apply(g, p, t) {
      const q = g.players[t];
      const cell = nextWildLand(g, q.pos);
      if (cell < 0) return;
      q.pos = cell;
      ev(g, 'move', q.id, 0, cell);
      logMsg(g, `${p.name} заманивает ${q.name} на ${g.cells[cell].land!.name}`);
      if (ENGINE_HOOKS.encounter) yield* ENGINE_HOOKS.encounter(g, q, g.cells[cell].land!);
    },
  },
  forge: {
    id: 'forge', name: 'Кузня',
    text: () => 'Замените свой самый мелкий жетон на жетон следующего номинала (100→300→500→1000).',
    phases: ['pre', 'post'],
    targets: (g, p) => (p.tokens.length && NEXT_DENOM(g, p.tokens[p.tokens.length - 1]) ? [-1] : []),
    *apply(g, p) {
      const small = p.tokens[p.tokens.length - 1];
      const up = NEXT_DENOM(g, small);
      p.tokens[p.tokens.length - 1] = up;
      p.tokens.sort((a, b) => b - a);
      ev(g, 'upgrade', p.id, up - small, 'Кузня');
      ev(g, 'receive', p.id, up - small, 'Кузня');
      logMsg(g, `${p.name} перековывает жетон ${small} в ${up}`);
    },
  },
  hunt: {
    id: 'hunt', name: 'Охотничий Рог',
    text: () => 'До броска: вместо броска перейдите на ближайшую впереди дикую Землю (без дохода Врат).',
    phases: ['pre'],
    targets: (g, p) => {
      if (p.teleportTo >= 0 || p.rollTwice) return [];
      const c = nextWildLand(g, p.pos);
      return c >= 0 ? [c] : [];
    },
    *apply(_g, p, t) { p.teleportTo = t; },
  },
  mirror: {
    id: 'mirror', name: 'Зеркало', trigger: 'counter',
    text: () => 'В ЧУЖОЙ ход, когда соперник играет Заклятие против вас или вашей Земли: отмените его.',
    phases: [], targets: () => [], *apply() {},
  },
  ambush: {
    id: 'ambush', name: 'Засада', trigger: 'ambush',
    text: () => 'В ЧУЖОЙ ход, когда соперник останавливается на вашей Земле: он теряет 1 жетон.',
    phases: [], targets: () => [], *apply() {},
  },
  courage: {
    id: 'courage', name: 'Отвага', trigger: 'courage',
    text: (g) => `В свой бой, когда вы не сильнее монстра: деритесь — вы побеждаете на ${P(g, 'courageWinOn') || 4}–6 вместо 6. Не считается Заклятием хода.`,
    phases: [], targets: () => [], *apply() {},
  },
  intercept: {
    id: 'intercept', name: 'Перехват', trigger: 'intercept',
    text: () => 'В ЧУЖОЙ ход, когда соперник побеждает монстра: жетон-награду берёте вы, а не он (Земля всё равно его).',
    phases: [], targets: () => [], *apply() {},
  },
} satisfies Record<string, SpellDef>);

/** Victim of a targeted Spell (for Зеркало): a player id, or -1 if the Spell is not aimed at one player. */
export function spellVictim(g: GameState, card: string, target: number): number {
  if (target < 0) return -1;
  if (card === 'fireball' || card === 'drain' || card === 'swap' || card === 'lure') return target;
  if (card === 'usurp' || card === 'shatter' || card === 'loot' || card === 'revolt' || card === 'release') return g.cells[target]?.land?.owner ?? -1;
  return -1;
}

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
