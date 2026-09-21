// Test helpers: scripted dice, scripted choices, quick game setup.
import type { GameState, Decision, Engine } from '../core/types.ts';
import { BASE_RULES, mergeRules, type RuleSet } from '../rules/ruleset.ts';
import { createGame } from '../core/state.ts';
import { Rng } from '../core/rng.ts';

export function rules(over: Record<string, unknown> = {}): RuleSet {
  return mergeRules(BASE_RULES, over);
}

export function game(r: RuleSet = rules(), n = 2, seed = 1): GameState {
  return createGame(r, Array.from({ length: n }, (_, i) => ({ name: `P${i + 1}`, bot: 'test' })), seed);
}

/** Replace RNG with scripted d6 results (other calls fall back to a real RNG). */
export function scriptDice(g: GameState, rolls: number[]): void {
  const real = new Rng(99);
  const stub = Object.create(real) as Rng;
  stub.d6 = () => {
    const v = rolls.shift();
    if (v === undefined) throw new Error('dice script exhausted');
    return v;
  };
  g.rng = stub;
}

/** Drive an engine generator, answering each decision with `pick` (default: first option). */
export function drive(it: Engine, pick: (d: Decision) => number = () => 0): Decision[] {
  const seen: Decision[] = [];
  let r = it.next();
  while (!r.done) {
    seen.push(r.value);
    r = it.next(pick(r.value));
  }
  return seen;
}

export function wildLand(g: GameState, monster: number): number {
  const c = g.cells.find((x) => x.land && x.land.monster === monster && x.land.owner === -1);
  if (!c) throw new Error(`no land with monster ${monster}`);
  return c.index;
}
