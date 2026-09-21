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

export function score(mixed: Summary, mirror: Summary, denoms: number[], exploit?: Summary, landCount = 20): ScoreBreakdown {
  const pen: Record<string, number> = {};
  const val: Record<string, number> = {};
  // Q1
  val.timeoutRate = mixed.timeoutRate;
  pen.Q1_termination = 15 * clamp01(mixed.timeoutRate / 0.1);
  // Q2
  const med = mixed.medianRounds;
  val.medianRounds = med;
  const dist = med < 12 ? (12 - med) / 12 : med > 30 ? (med - 30) / 30 : 0;
  pen.Q2_length = 8 * clamp01(dist * 2);
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
  pen.Q9_cards = 5 * clamp01(ch.frac * 2);
  // Q10
  const weak = weakDenominations(mixed, denoms);
  val.weakDenoms = weak.length;
  pen.Q10_denoms = 4 * clamp01(weak.length / denoms.length);
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
  pen.Q13_integrity = 4 * clamp01(Math.max(0, mixed.changeHealPerGame - 0.2) / 1.8);
  const hardFail: string[] = [];
  if (mixed.timeoutRate > 0.05) hardFail.push('timeouts > 5%');
  const total = 100 - Object.values(pen).reduce((a, b) => a + b, 0);
  return { total, penalties: pen, values: val, hardFail };
}
