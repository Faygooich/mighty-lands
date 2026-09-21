// Bot registry. makeBot(type, seed) -> chooser function.
import type { Decision, GameState } from '../../core/types.ts';
import type { Chooser } from '../../core/engine.ts';
import { Rng } from '../../core/rng.ts';
import { HeuristicBot, PROFILES, type Weights } from './heuristic.ts';

export const BOT_TYPES = ['random', 'aggressive', 'defensive', 'economic', 'tactical', 'survival', 'exploit'] as const;
export type BotType = (typeof BOT_TYPES)[number] | string;
export const STYLE_BOTS = ['aggressive', 'defensive', 'economic', 'survival'];

/** ExploitBot genome: the current best exploit found by balancing/exploitSearch.ts (per ruleset). */
let exploitGenome: Partial<Weights> = {
  // default exploit: abuse change-healing, hoard, never waste spells, strike to kill only
  payLargest: 50, attack: 0.3, kill: 5000, hp: 500, spellThreshold: 150, lookahead: 1, leaderFocus: 0,
};

export function setExploitGenome(genome: Partial<Weights>): void {
  exploitGenome = genome;
}
export function getExploitGenome(): Partial<Weights> {
  return exploitGenome;
}

export function randomChooser(rng: Rng): Chooser {
  return (_g: GameState, d: Decision) => rng.int(d.options.length);
}

export function makeBot(type: BotType, seed: number, genome?: Partial<Weights>): Chooser {
  const rng = new Rng(seed ^ 0x5bd1e995);
  if (type === 'random') return randomChooser(rng);
  if (type === 'exploit') return new HeuristicBot('exploit', genome ?? exploitGenome, rng).choose;
  if (type.startsWith('genome:')) return new HeuristicBot(type, genome ?? {}, rng).choose;
  const prof = PROFILES[type];
  if (!prof) throw new Error(`Unknown bot type ${type}`);
  return new HeuristicBot(type, prof, rng).choose;
}

export const BOT_LABEL: Record<string, string> = {
  random: 'RandomBot', aggressive: 'AggressiveBot', defensive: 'DefensiveBot', economic: 'EconomicBot',
  tactical: 'TacticalBot', survival: 'SurvivalBot', exploit: 'ExploitBot',
};
