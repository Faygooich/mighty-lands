// Core data model. Pure data: no methods, so states can be cloned/serialised.
import type { RuleSet } from '../rules/ruleset.ts';
import type { Rng } from './rng.ts';

export type CardKind = 'artifact' | 'spell';

export interface PlayerState {
  id: number;
  name: string;
  bot: string;
  /** Power tokens, kept sorted descending. length = HP. */
  tokens: number[];
  hand: string[];
  pos: number;
  alive: boolean;
  /** Turns to skip. */
  skip: number;
  /** Temporary power bonus until end of own turn. */
  tempPower: number;
  spellsThisTurn: number;
  /** Cell chosen by Teleport for this turn's movement, -1 if none. */
  teleportTo: number;
  /** Power bonus/penalty from reaction cards in the current fight. */
  fightMod: number;
  /** Shield charges (ignore next harmful effect). */
  shield: number;
  eliminatedRound: number;
  /** Consecutive failed flees / generic per-player counter used by some rules. */
  laps: number;
  /** «Попутный Ветер Славы»: roll two dice this turn and pick one. */
  rollTwice: boolean;
}

export interface LandState {
  cell: number;
  name: string;
  region: number;
  /** Base monster power (restored when land becomes wild). */
  baseMonster: number;
  monster: number;
  /** Reward for defeating the monster (0 = none). */
  reward: number;
  /** -1 = wild (monster holds it). */
  owner: number;
  artifact: string | null;
}

export type CellType = 'start' | 'land' | 'crossroad' | 'altar' | 'rift' | 'market';

export interface Cell {
  index: number;
  type: CellType;
  land: LandState | null;
}

export type Phase = 'pre' | 'post' | 'none';

export interface GameState {
  rules: RuleSet;
  rng: Rng;
  seed: number;
  players: PlayerState[];
  cells: Cell[];
  artDeck: string[];
  artDiscard: string[];
  spellDeck: string[];
  spellDiscard: string[];
  round: number;
  turn: number;
  current: number;
  phase: Phase;
  over: boolean;
  winner: number;
  timeout: boolean;
  endReason: string;
  hooks: Hooks | null;
  log: string[] | null;
}

// ---- Decisions ---------------------------------------------------------------

export type Option =
  | { t: 'done' }
  | { t: 'spell'; card: string; target: number }
  | { t: 'artifact'; card: string; land: number }
  | { t: 'capture' }
  | { t: 'pass' }
  | { t: 'fight' }
  | { t: 'flee' }
  | { t: 'token'; value: number }
  | { t: 'pay'; tokens: number[] }
  | { t: 'discard'; card: string }
  | { t: 'exchange'; give: number; take: number[] }
  | { t: 'react'; card: string }
  | { t: 'choose'; key: string };

export type DecisionKind =
  | 'main'
  | 'capture'
  | 'encounter'
  | 'lose'
  | 'pay'
  | 'discard'
  | 'react'
  | 'dilemma'
  /** A card that answers another player's action (Зеркало Самолюбования, Засада в Кустах, Перехват Славы). */
  | 'trigger';

export interface Decision {
  kind: DecisionKind;
  player: number;
  options: Option[];
  /** Human-readable reason, used by UI and logs. */
  reason: string;
  /** Extra info (e.g. amount to pay). */
  amount?: number;
  /** Context for 'trigger' decisions: the card/effect being answered. */
  card?: string;
}

export type Engine = Generator<Decision, void, number>;

// ---- Event hooks (metrics / UI) ---------------------------------------------

export type EventType =
  | 'turn' | 'skip' | 'draw' | 'move' | 'income'
  | 'encounter' | 'capture' | 'pass' | 'fleeOk' | 'fleeFail' | 'fightWin' | 'fightLose'
  | 'hpLoss' | 'hpGain' | 'death'
  | 'pay' | 'receive' | 'burn' | 'change'
  | 'artifactPlace' | 'artifactTrigger' | 'artifactFleeOk' | 'artifactFleeFail'
  | 'spell' | 'discard' | 'decision' | 'landLost' | 'round' | 'end' | 'exchange' | 'reshuffle' | 'shieldBlock' | 'upgrade' | 'react' | 'respawn';

export interface Hooks {
  ev(type: EventType, player: number, a: number, b: string | number | null): void;
}
