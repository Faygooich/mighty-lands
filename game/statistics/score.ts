// Quality score — implementation of docs/quality_criteria.md. Do not tune per generation.
import type { Summary } from './aggregate.ts';

export const STYLE = ['aggressive', 'defensive', 'economic', 'survival'];

export interface ScoreBreakdown {
  total: number;
  penalties: Record<string, number>;
  values: Record<string, number>;
  hardFail: string[];
}

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

export function styleDominance(s: Summary): number {
  const fair = 1 / s.players;
  let best = 0;
  for (const b of STYLE) if (s.winRate[b] !== undefined) best = Math.max(best, s.winRate[b] / fair - 1);
  return best;
}

export function skillExpression(s: Summary): number {
  const fair = 1 / s.players;
  return ((s.winRate.tactical ?? fair) - (s.winRate.random ?? fair)) / fair;
}

export function seatDeviation(mirror: Summary): number {
  const fair = 1 / mirror.players;
  let dev = 0;
  for (const w of mirror.seatWinRate) dev = Math.max(dev, Math.abs(w - fair) / fair);
  return dev;
}

export function cardHealth(s: Summary): { dead: string[]; mandatory: string[]; frac: number } {
  const dead: string[] = [];
  const mandatory: string[] = [];
  const cards = Object.keys(s.cardPlayRate);
  for (const c of cards) {
    if (s.cardPlayRate[c] < 0.1) dead.push(c);
    if (s.cardWinDelta[c] > 0.2) mandatory.push(c);
  }
  return { dead, mandatory, frac: cards.length ? new Set([...dead, ...mandatory]).size / cards.length : 0 };
}

export function weakDenominations(s: Summary, denoms: number[]): number[] {
  return denoms.filter((d) => (s.denomShare[String(d)] ?? 0) < 0.03);
}

export function neverCapturedLands(s: Summary, threshold = 0.1): number {
  let n = 0;
  s.landCaptureRate.forEach((v, i) => { if (s.landIsLand[i] && v < threshold) n++; });
  return n;
}

/** Q15 components, each 0..1 (1 = feeling clearly present). Fixed in quality_criteria.md (R3). */
export function gameFeelComponents(s: Summary): Record<string, number> {
  const f = s.feel;
  const hp1 = f.hp1Share;
  return {
    growth: clamp01((f.growth - 1) / 1),                 // peak/start power >= 2.0
    bigMoment: clamp01(f.bigGameShare / 0.6),             // someone reaches 2500+ in 60% of games
    danger: hp1 < 0.3 ? clamp01(hp1 / 0.3) : hp1 > 0.8 ? clamp01(1 - (hp1 - 0.8) / 0.2) : 1,
    brokeMyPlans: clamp01(f.landsTakenPerGame / 1.5),     // lands taken away by others
    interaction: clamp01(f.takeThatPerTurn / 0.35),       // active take-that per turn
    revenge: clamp01(f.revengeShare / 0.15),
    outOfTurn: clamp01(f.reactionsPerGame / 2),           // Munchkin: cards played in others' turns
    noKingmaking: f.kingmakerShare <= 0.25 ? 1 : clamp01(1 - (f.kingmakerShare - 0.25) / 0.25),
  };
}

export function score(mixed: Summary, mirror: Summary, denoms: number[], exploit?: Summary, landCount = 20): ScoreBreakdown {
  const pen: Record<string, number> = {};
  const val: Record<string, number> = {};
  // Q1
  val.timeoutRate = mixed.timeoutRate;
  pen.Q1_termination = 12 * clamp01(mixed.timeoutRate / 0.1);
  // Q2
  const med = mixed.medianRounds;
  val.medianRounds = med;
  const dist = med < 12 ? (12 - med) / 12 : med > 30 ? (med - 30) / 30 : 0;
  pen.Q2_length = 6 * clamp01(dist * 2);
  // Q3
  val.seatDeviation = seatDeviation(mirror);
  pen.Q3_seat = 8 * clamp01(Math.max(0, val.seatDeviation - 0.15) / 0.35);
  // Q4
  val.styleDominance = styleDominance(mixed);
  pen.Q4_dominance = 10 * clamp01(Math.max(0, val.styleDominance - 0.3) / 0.7);
  // Q5
  val.skill = skillExpression(mixed);
  pen.Q5_skill = 8 * clamp01(1 - val.skill);
  // Q6
  val.comebackRate = mixed.comebackRate;
  const cb = mixed.comebackRate;
  pen.Q6_comeback = 8 * clamp01(cb < 0.25 ? (0.25 - cb) / 0.25 : cb > 0.5 ? (cb - 0.5) / 0.3 : 0);
  // Q7
  val.deadFraction = mixed.deadFraction;
  pen.Q7_elimination = 8 * clamp01(Math.max(0, mixed.deadFraction - 0.15) / 0.25);
  // Q8 (entropy-weighted decisions)
  val.effectiveDecisions = mixed.effectiveDecisionsPerTurn;
  pen.Q8_decisions = 10 * clamp01(1 - mixed.effectiveDecisionsPerTurn / 1.0);
  // Q9
  const ch = cardHealth(mixed);
  val.cardUnhealthy = ch.frac;
  pen.Q9_cards = 4 * clamp01(ch.frac * 2);
  // Q10
  const weak = weakDenominations(mixed, denoms);
  val.weakDenoms = weak.length;
  pen.Q10_denoms = 3 * clamp01(weak.length / denoms.length);
  // Q11 territory
  const never = neverCapturedLands(mixed);
  val.neverCapturedLands = never;
  pen.Q11_territory = 6 * clamp01(never / (landCount * 0.4));
  // Q12 exploit
  const ew = exploit ? (exploit.winRate.exploit ?? 0) / 0.25 - 1 : 0;
  val.exploitEdge = ew;
  pen.Q12_exploit = 6 * clamp01(Math.max(0, ew - 0.2) / 0.8);
  // Q13 change-healing integrity
  val.changeHeal = mixed.changeHealPerGame;
  pen.Q13_integrity = 3 * clamp01(Math.max(0, mixed.changeHealPerGame - 0.2) / 1.8);
  // Q14 Human Table Test: real-table duration and arithmetic load
  const mins = mixed.tableMinutes;
  val.tableMinutes = mins;
  val.arithPerTurn = mixed.arithPerTurn;
  const md = mins < 30 ? (30 - mins) / 30 : mins > 75 ? (mins - 75) / 75 : 0;
  pen.Q14_table = 4 * clamp01(md * 2) + 4 * clamp01(Math.max(0, mixed.arithPerTurn - 3) / 5);
  // --- R3: all Q1..Q14 scaled by 0.85, Q15 Game Feel (weight 15)
  for (const k of Object.keys(pen)) pen[k] *= 0.85;
  const f = mixed.feel;
  const comp = gameFeelComponents(mixed);
  for (const [k, v] of Object.entries(comp)) val[`feel_${k}`] = v;
  const meanC = Object.values(comp).reduce((a, b) => a + b, 0) / Object.values(comp).length;
  pen.Q15_gameFeel = 15 * (1 - meanC);
  val.growth = f.growth;
  const hardFail: string[] = [];
  if (mixed.timeoutRate > 0.05) hardFail.push('timeouts > 5%');
  const total = 100 - Object.values(pen).reduce((a, b) => a + b, 0);
  return { total, penalties: pen, values: val, hardFail };
}
