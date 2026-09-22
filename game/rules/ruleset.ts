// RuleSet: every rule of the game as data. Versions live in /rules/vNNN.json and are
// deep-merged over BASE_RULES (the literal v001 reading), so old versions stay runnable.
import type { CellType } from '../core/types.ts';

export interface CellDef {
  type: CellType;
  name?: string;
  region?: number;
  monster?: number;
  reward?: number;
}

export interface WinRules {
  lastStanding: boolean;
  /** Win immediately when owning this many Lands (0 = off). */
  landsTarget: number;
  /** Win immediately when owning every Land of one region (false = off). */
  regionWin: boolean;
  /** Win immediately at this total power (0 = off). */
  powerTarget: number;
  /** Victory points: win when reaching this many VP (0 = off). */
  vpTarget: number;
  /** The game ends as soon as any player is eliminated; best standing (lands, then power, then HP) wins. */
  firstDeathEnds: boolean;
}

export interface RuleSet {
  version: string;
  parent: string | null;
  title: string;
  denominations: number[];
  maxSlots: number;
  startTokens: number[];
  board: CellDef[];
  moveDice: number;
  /** Flee succeeds on d6 >= fleeMin. */
  fleeMin: number;
  /** Equal power counts as stronger. */
  tieWins: boolean;
  /** Capture pays this fraction of monster power to the bank (0 = free). */
  captureCostFrac: number;
  /** Weaker player chooses: fight (roll) or flee (roll). */
  encounterChoice: boolean;
  /** Fight: roll d6, add rollStep*roll to power; win if > monster. */
  fightRollStep: number;
  /** Which token is lost on damage. */
  lossChoice: 'player' | 'smallest' | 'largest' | 'random';
  /** Power granted when passing/landing on Start. */
  startIncome: number;
  /** Extra start income per owned Land. */
  incomePerLand: number;
  /** Payment returns change. */
  change: boolean;
  /**
   * How payments work physically:
   *  'sum'   — hand over tokens worth >= amount (change per `change`)  [v001]
   *  'token' — hand over ONE token of your choice, amount ignored (no arithmetic)
   *  'atLeast' — hand over ONE token worth >= amount; if none, your largest token
   */
  payMode: 'sum' | 'token' | 'atLeast';
  /** Voluntary exchange with bank during main phase (equal value, slot-limited). */
  exchange: boolean;
  /** When a visitor may try to flee an Artifact. */
  artifactFlee: 'stronger' | 'always' | 'never' | 'weaker';
  spellsPerTurn: number;
  drawArtifacts: number;
  drawSpells: number;
  handLimit: 'hp' | number;
  /** Artifacts are discarded after triggering. */
  artifactsSingleUse: boolean;
  /** Visitor landing on an enemy Land may challenge it: if stronger than owner's land defence, capture it. */
  landChallenge: boolean;
  /** Land defence = monster power * this factor (when owned). */
  ownedDefenceFrac: number;
  /** Dead players' tokens/lands: 'wild' returns lands to monsters. */
  deathLands: 'wild' | 'killer';
  /** Catch-up: the player with fewest HP draws +N extra cards. */
  catchUpDraw: number;
  /** Monster power per region (overrides board), e.g. [[200,300,...],...]; null = board as is. */
  regionMonsters: number[][] | null;
  /** Reward token value for defeating a monster, per region (printed on the Land). null = none. */
  regionRewards: number[] | null;
  /** When a token is gained with no free slot, it replaces your smallest token if larger ("upgrade"). */
  upgradeWhenFull: boolean;
  /** Seat compensation: extra Spell cards dealt at setup, by seat (0 = first player). */
  seatBonusCards: number[];
  /** Seat compensation: extra tokens at setup, by seat. */
  seatBonusTokens: number[][];
  /** The first player does not draw cards on their first turn. */
  firstTurnNoDraw: boolean;
  /** BANG!-style return: losing the last token does not eliminate — lose Lands and hand, restart at Start with these tokens. [] = eliminated. */
  respawnTokens: number[];
  /** Max round count before forced end. */
  roundCap: number;
  win: WinRules;
  decks: { artifacts: Record<string, number>; spells: Record<string, number> };
  params: Record<string, number>;
}

const REGIONS: Array<{ name: string; monsters: number[]; lands: string[] }> = [
  { name: 'Долина', monsters: [200, 300, 300, 400, 500], lands: ['Тихий Луг', 'Ручьи', 'Мельница', 'Овечий Холм', 'Старый Мост'] },
  { name: 'Лес', monsters: [600, 700, 800, 800, 900], lands: ['Опушка', 'Грибная Чаща', 'Волчья Тропа', 'Дуб Шептун', 'Сердце Леса'] },
  { name: 'Горы', monsters: [1000, 1200, 1300, 1500, 1600], lands: ['Перевал', 'Рудники', 'Орлиное Гнездо', 'Ледник', 'Пик Грома'] },
  { name: 'Бездна', monsters: [1800, 2000, 2300, 2600, 3000], lands: ['Пепельный Край', 'Чёрный Провал', 'Трон Костей', 'Кипящее Озеро', 'Око Бездны'] },
];

export const REGION_NAMES = REGIONS.map((r) => r.name);

export function buildBoard(regions = REGIONS): CellDef[] {
  const cells: CellDef[] = [{ type: 'start', name: 'Врата' }];
  regions.forEach((r, ri) => {
    r.monsters.forEach((m, i) => cells.push({ type: 'land', name: r.lands[i], region: ri, monster: m }));
    if (ri < regions.length - 1) cells.push({ type: 'crossroad', name: 'Перекрёсток' });
  });
  return cells;
}

export const BASE_RULES: RuleSet = {
  version: 'v001',
  parent: null,
  title: 'Буквальное прочтение исходных правил',
  denominations: [1000, 500, 300, 100],
  maxSlots: 5,
  startTokens: [500, 300, 100],
  board: buildBoard(),
  moveDice: 1,
  fleeMin: 5,
  tieWins: false,
  captureCostFrac: 0,
  encounterChoice: false,
  fightRollStep: 0,
  lossChoice: 'player',
  startIncome: 100,
  incomePerLand: 0,
  change: true,
  payMode: 'sum',
  exchange: false,
  artifactFlee: 'stronger',
  spellsPerTurn: 1,
  drawArtifacts: 1,
  drawSpells: 1,
  handLimit: 'hp',
  artifactsSingleUse: false,
  landChallenge: false,
  ownedDefenceFrac: 1,
  deathLands: 'wild',
  catchUpDraw: 0,
  regionMonsters: null,
  regionRewards: null,
  upgradeWhenFull: false,
  seatBonusCards: [],
  seatBonusTokens: [],
  firstTurnNoDraw: false,
  respawnTokens: [],
  roundCap: 120,
  win: { lastStanding: true, landsTarget: 0, regionWin: false, powerTarget: 0, vpTarget: 0, firstDeathEnds: false },
  decks: {
    artifacts: { tribute: 8, bigTribute: 3, trap: 5, pickpocket: 4, shackles: 4, exile: 3, guardian: 3 },
    spells: { fireball: 5, heal: 5, shatter: 4, usurp: 3, teleport: 3, fury: 4, release: 3, drain: 3 },
  },
  params: {
    tribute: 300,
    bigTribute: 700,
    drain: 300,
    fury: 1000,
    heal: 100,
    trapDamage: 1,
    fireballDamage: 1,
    aid: 500,
    aidReward: 300,
    hex: 500,
  },
};

export type RuleOverrides = { [K in keyof RuleSet]?: RuleSet[K] extends object ? Partial<RuleSet[K]> | RuleSet[K] : RuleSet[K] };

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Deep-merge overrides; arrays and deck/param maps replace wholesale where given. */
export function mergeRules(base: RuleSet, over: Record<string, unknown>): RuleSet {
  const out = structuredClone(base) as unknown as Record<string, unknown>;
  for (const [k, v] of Object.entries(over)) {
    if (k === 'decks' && isPlainObject(v)) {
      const d = out.decks as Record<string, unknown>;
      for (const [dk, dv] of Object.entries(v)) d[dk] = structuredClone(dv);
    } else if (isPlainObject(v) && isPlainObject(out[k])) {
      out[k] = { ...(out[k] as object), ...structuredClone(v) };
    } else {
      out[k] = structuredClone(v);
    }
  }
  return out as unknown as RuleSet;
}

/**
 * Rulebook complexity of a ruleset (used only as the tie-break "prefer the simpler game", R3.1):
 * distinct card types + active mechanics + active win conditions.
 */
export function rulesComplexity(r: RuleSet): number {
  let n = 0;
  for (const d of [r.decks.artifacts, r.decks.spells]) for (const v of Object.values(d)) if (v > 0) n++;
  const flags = [
    r.encounterChoice, r.upgradeWhenFull, r.landChallenge, r.exchange, r.artifactsSingleUse, r.firstTurnNoDraw,
    r.catchUpDraw > 0, r.seatBonusCards.some((x) => x > 0), r.seatBonusTokens.some((x) => x.length > 0),
    !!r.regionRewards, r.artifactFlee !== 'never', r.payMode === 'sum' && r.change, r.incomePerLand > 0,
    r.captureCostFrac > 0, (r.params.crown ?? 0) > 0, r.tieWins, r.handLimit === 'hp', r.respawnTokens.length > 0, (r.params.setTribute ?? 0) > 0, (r.params.setProtect ?? 0) > 0,
  ];
  n += flags.filter(Boolean).length;
  const w = r.win;
  n += [w.lastStanding, w.landsTarget > 0, w.regionWin, w.powerTarget > 0, w.vpTarget > 0, w.firstDeathEnds].filter(Boolean).length;
  return n;
}

export function landCount(r: RuleSet): number {
  return r.board.filter((c) => c.type === 'land').length;
}
