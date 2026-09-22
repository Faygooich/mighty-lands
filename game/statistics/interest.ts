// Interest Index (R4, v1.0.1) — a finer instrument for "which version plays more interestingly".
// The official quality score (score.ts) is saturated at 100 since Gen 10, so it can only act as a
// gate. The Interest Index measures the same qualities with targets set ABOVE the Q-thresholds.
// Fixed before Generation 23; not tuned per generation. See docs/quality_criteria.md § R4.
import type { Summary } from './aggregate.ts';
import { STYLE } from './score.ts';

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

export interface InterestBreakdown {
  total: number;
  parts: Record<string, number>;
  values: Record<string, number>;
}

/** Effective number of distinct cards actually played (exp of entropy of the play distribution). */
export function cardVariety(s: Summary): number {
  const counts: number[] = [];
  for (const [k, v] of Object.entries(s.choice)) {
    const t = k.split(':')[1];
    if (t === 'spell' || t === 'artifact' || t === 'react') counts.push(v);
  }
  const tot = counts.reduce((a, b) => a + b, 0);
  if (!tot) return 0;
  let h = 0;
  for (const c of counts) if (c) h -= (c / tot) * Math.log(c / tot);
  return Math.exp(h);
}

export const INTEREST_WEIGHTS: Record<string, number> = {
  decisions: 15, interaction: 10, outOfTurn: 10, tension: 10, lastPlace: 15, earlyLead: 10, variety: 10, skill: 10, balance: 10,
};

export function interestIndex(S: Record<string, Summary>): InterestBreakdown {
  const m = S.mixed4;
  const f = m.feel;
  const values: Record<string, number> = {};
  const parts: Record<string, number> = {};
  values.effectiveDecisions = m.effectiveDecisionsPerTurn;
  parts.decisions = clamp01(m.effectiveDecisionsPerTurn / 2.5);
  values.interactionPerTurn = f.takeThatPerTurn + f.artifactHitsPerTurn;
  parts.interaction = clamp01(values.interactionPerTurn / 1.0);
  values.reactionsPerGame = f.reactionsPerGame;
  parts.outOfTurn = clamp01(f.reactionsPerGame / 10);
  values.leadChanges = m.leadChangesPerGame;
  parts.tension = clamp01(m.leadChangesPerGame / 8);
  values.lastHalfWin = m.lastHalfWinRate;
  parts.lastPlace = clamp01(m.lastHalfWinRate / 0.15);
  const el = S.earlyLead?.seatWinRate[0] ?? 0.6;
  values.earlyLeaderWin = el;
  parts.earlyLead = clamp01((1 - el) / 0.6);
  values.cardVariety = cardVariety(m);
  parts.variety = clamp01(values.cardVariety / 20);
  const fair = 1 / m.players;
  values.skill = ((m.winRate.tactical ?? fair) - (m.winRate.random ?? fair)) / fair;
  parts.skill = clamp01(values.skill / 1.5);
  let dom = 0;
  for (const b of STYLE) if (m.winRate[b] !== undefined) dom = Math.max(dom, m.winRate[b] / fair - 1);
  values.styleDominance = dom;
  let duelTop = 0.5;
  if (S.duel) for (const b of STYLE) duelTop = Math.max(duelTop, S.duel.winRate[b] ?? 0);
  values.duelTop = duelTop;
  parts.balance = 0.5 * (1 - clamp01((dom - 0.1) / 0.3)) + 0.5 * (1 - clamp01((duelTop - 0.55) / 0.15));
  let total = 0;
  for (const [k, w] of Object.entries(INTEREST_WEIGHTS)) total += w * (parts[k] ?? 0);
  // table-time guard: every minute outside 30–60 min (4 players) costs 0.5, arithmetic above 2.5 op/turn costs 5 per op
  values.tableMinutes = m.tableMinutes;
  const off = m.tableMinutes < 30 ? 30 - m.tableMinutes : m.tableMinutes > 60 ? m.tableMinutes - 60 : 0;
  total -= 0.5 * off + 5 * Math.max(0, m.arithPerTurn - 2.5);
  return { total, parts, values };
}

/** Per-card health for R4 gates: dead (< 15% played) or mandatory (Δ win > +20 p.p., same bar as Q9). */
export function cardGate(s: Summary, cards: string[]): { dead: string[]; swingy: string[] } {
  const dead: string[] = [];
  const swingy: string[] = [];
  for (const c of cards) {
    if ((s.cardPlayRate[c] ?? 0) < 0.15) dead.push(c);
    if ((s.cardWinDelta[c] ?? 0) > 0.2) swingy.push(c);
  }
  return { dead, swingy };
}
