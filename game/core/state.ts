// Game creation and helpers shared by engine, bots and UI.
import type { RuleSet } from '../rules/ruleset.ts';
import type { Cell, GameState, Hooks, LandState, PlayerState } from './types.ts';
import { Rng } from './rng.ts';
import { sortDesc, sum } from './tokens.ts';

export interface PlayerSetup {
  name: string;
  bot: string;
}

function buildDeck(spec: Record<string, number>, rng: Rng): string[] {
  const deck: string[] = [];
  for (const [id, n] of Object.entries(spec)) for (let i = 0; i < n; i++) deck.push(id);
  return rng.shuffle(deck);
}

export function createGame(rules: RuleSet, setups: PlayerSetup[], seed: number, hooks: Hooks | null = null, log = false): GameState {
  const rng = new Rng(seed);
  const regionIdx = new Map<number, number>();
  const cells: Cell[] = rules.board.map((c, index) => {
    let land: LandState | null = null;
    if (c.type === 'land') {
      const reg = c.region ?? 0;
      const k = regionIdx.get(reg) ?? 0;
      regionIdx.set(reg, k + 1);
      const m = rules.regionMonsters?.[reg]?.[k] ?? c.monster ?? 0;
      const reward = rules.regionRewards?.[reg] ?? c.reward ?? 0;
      land = {
        cell: index,
        name: c.name ?? `Земля ${index}`,
        region: c.region ?? 0,
        baseMonster: m,
        monster: m,
        reward,
        owner: -1,
        artifact: null,
      };
    }
    return { index, type: c.type, land };
  });
  const players: PlayerState[] = setups.map((s, id) => ({
    id,
    name: s.name,
    bot: s.bot,
    tokens: sortDesc(rules.startTokens.slice()),
    hand: [],
    pos: 0,
    alive: true,
    skip: 0,
    tempPower: 0,
    spellsThisTurn: 0,
    teleportTo: -1,
    shield: 0,
    fightMod: 0,
    eliminatedRound: -1,
    laps: 0,
  }));
  const artDeck = buildDeck(rules.decks.artifacts, rng);
  const spellDeck = buildDeck(rules.decks.spells, rng);
  // seat compensation (later seats)
  players.forEach((p, seat) => {
    for (const t of rules.seatBonusTokens?.[seat] ?? []) if (p.tokens.length < rules.maxSlots) p.tokens.push(t);
    sortDesc(p.tokens);
    for (let i = 0; i < (rules.seatBonusCards?.[seat] ?? 0); i++) { const c = spellDeck.pop(); if (c) p.hand.push(c); }
  });
  return {
    rules,
    rng,
    seed,
    players,
    cells,
    artDeck,
    artDiscard: [],
    spellDeck,
    spellDiscard: [],
    round: 1,
    turn: 0,
    current: 0,
    phase: 'none',
    over: false,
    winner: -1,
    timeout: false,
    endReason: '',
    hooks,
    log: log ? [] : null,
  };
}

export const power = (p: PlayerState): number => sum(p.tokens);
export const effPower = (p: PlayerState): number => sum(p.tokens) + p.tempPower;
export const hp = (p: PlayerState): number => p.tokens.length;

export function landsOf(g: GameState, pid: number): LandState[] {
  const out: LandState[] = [];
  for (const c of g.cells) if (c.land && c.land.owner === pid) out.push(c.land);
  return out;
}

/** Number of Lands `pid` owns in `region`. */
export function regionCount(g: GameState, pid: number, region: number): number {
  let n = 0;
  for (const c of g.cells) if (c.land && c.land.owner === pid && c.land.region === region) n++;
  return n;
}

/** «Набор цвета»: owner holds at least params.setSize Lands of this Land's region. */
export function inSet(g: GameState, l: LandState): boolean {
  const k = g.rules.params.setSize ?? 0;
  return k > 0 && l.owner >= 0 && regionCount(g, l.owner, l.region) >= k;
}

export function alivePlayers(g: GameState): PlayerState[] {
  return g.players.filter((p) => p.alive);
}

export function handLimit(g: GameState, p: PlayerState): number {
  return g.rules.handLimit === 'hp' ? p.tokens.length : g.rules.handLimit;
}

/** Fixed "standing" estimate from docs/quality_criteria.md (used for leader tracking only). */
export function standing(g: GameState, p: PlayerState): number {
  if (!p.alive) return -1;
  let land = 0;
  for (const l of landsOf(g, p.id)) land += l.baseMonster;
  return power(p) + 250 * hp(p) + 0.3 * land;
}

/** Victory points: owned lands + region bonus (used when win.vpTarget > 0). */
export function victoryPoints(g: GameState, p: PlayerState): number {
  const r = g.rules;
  let vp = 0;
  const byRegion = new Map<number, number>();
  const regionSize = new Map<number, number>();
  for (const c of g.cells) {
    if (!c.land) continue;
    regionSize.set(c.land.region, (regionSize.get(c.land.region) ?? 0) + 1);
    if (c.land.owner === p.id) {
      vp += 1 + (r.params.vpPerRegionTier ?? 0) * c.land.region;
      byRegion.set(c.land.region, (byRegion.get(c.land.region) ?? 0) + 1);
    }
  }
  const bonus = r.params.vpRegionBonus ?? 0;
  for (const [reg, n] of byRegion) if (n === regionSize.get(reg)) vp += bonus;
  vp += Math.floor(power(p) / (r.params.vpPowerDivisor || Infinity));
  return vp;
}

export function logMsg(g: GameState, msg: string): void {
  if (g.log) g.log.push(`[р${g.round}] ${msg}`);
}

export function cloneState(g: GameState): GameState {
  const { rng, hooks, rules, ...rest } = g;
  const copy = structuredClone(rest) as Omit<GameState, 'rng' | 'hooks' | 'rules'>;
  return { ...copy, rules, hooks: null, rng: Rng.fromState(rng.state()) } as GameState;
}

export function distance(g: GameState, from: number, to: number): number {
  const n = g.cells.length;
  return (to - from + n) % n;
}
