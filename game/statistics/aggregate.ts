// Mergeable aggregate statistics over many GameRecords + summary computation.
import type { GameRecord, PlayerStats } from './metrics.ts';
import { newPlayerStats } from './metrics.ts';

type Num = Record<string, number>;

export interface Agg {
  games: number;
  players: number;
  timeouts: number;
  noWinner: number;
  rounds: number[];          // histogram by rounds
  endReasons: Num;
  bot: Record<string, { apps: number; wins: number; stats: PlayerStats }>;
  seatGames: number[];
  seatWins: number[];
  leaderHalfWins: number;
  leaderQ1Wins: number;
  leaderQ3Wins: number;
  lastHalfWins: number;
  leadChanges: number;
  firstCapturerWins: number;
  firstCapturerGames: number;
  deadTurns: number;         // player-rounds spent eliminated
  playerRounds: number;
  cardDrawn: Num;
  cardPlayed: Num;
  cardPlayGames: Num;        // player-games where card was played >= 1
  cardPlayWins: Num;
  landCaptures: number[];
  landHeldByWinner: number[];
  landHeldAtEnd: number[];
  landMask: number[];
  denom: Num;
  powerByRound: number[];
  powerByRoundN: number[];
  choice: Num;
  hpLossBySource: Num;
  maxRepeat: number;
  repeatGames: number;       // games with >= 10 identical round-end states in a row
  anomalies: Array<{ seed: number; reason: string; bots: string[] }>;
}

export function newAgg(): Agg {
  return {
    games: 0, players: 0, timeouts: 0, noWinner: 0, rounds: [], endReasons: {}, bot: {},
    seatGames: [], seatWins: [], leaderHalfWins: 0, leaderQ1Wins: 0, leaderQ3Wins: 0, lastHalfWins: 0,
    leadChanges: 0, firstCapturerWins: 0, firstCapturerGames: 0, deadTurns: 0, playerRounds: 0,
    cardDrawn: {}, cardPlayed: {}, cardPlayGames: {}, cardPlayWins: {}, landCaptures: [], landHeldByWinner: [], landHeldAtEnd: [], landMask: [],
    denom: {}, powerByRound: [], powerByRoundN: [], choice: {}, hpLossBySource: {}, maxRepeat: 0, repeatGames: 0, anomalies: [],
  };
}

const inc = (m: Num, k: string | number, v = 1) => { m[k] = (m[k] ?? 0) + v; };
const incArr = (a: number[], i: number, v = 1) => { while (a.length <= i) a.push(0); a[i] += v; };

function addStats(a: PlayerStats, b: PlayerStats): void {
  for (const k of Object.keys(b) as Array<keyof PlayerStats>) a[k] += b[k];
}

export function addRecord(agg: Agg, r: GameRecord): void {
  const n = r.bots.length;
  agg.games++;
  agg.players = n;
  if (r.timeout) agg.timeouts++;
  if (r.winner < 0) agg.noWinner++;
  incArr(agg.rounds, r.rounds);
  inc(agg.endReasons, r.endReason);
  r.bots.forEach((b, i) => {
    const e = (agg.bot[b] ??= { apps: 0, wins: 0, stats: newPlayerStats() });
    e.apps++;
    if (r.winner === i) e.wins++;
    addStats(e.stats, r.players[i]);
    incArr(agg.seatGames, i);
    if (r.winner === i) incArr(agg.seatWins, i);
    const dead = r.players[i].deathRound >= 0 ? r.rounds - r.players[i].deathRound : 0;
    agg.deadTurns += dead;
    agg.playerRounds += r.rounds;
    const played = r.cardPlayed[i];
    for (const [c, k] of Object.entries(played)) {
      inc(agg.cardPlayed, c, k);
      inc(agg.cardPlayGames, c);
      if (r.winner === i) inc(agg.cardPlayWins, c);
    }
  });
  if (r.winner >= 0) {
    if (r.leaderAt[1] === r.winner) agg.leaderHalfWins++;
    if (r.leaderAt[0] === r.winner) agg.leaderQ1Wins++;
    if (r.leaderAt[2] === r.winner) agg.leaderQ3Wins++;
    if (r.lastAtHalf === r.winner) agg.lastHalfWins++;
  }
  agg.leadChanges += r.leadChanges;
  if (r.firstCapturer >= 0) {
    agg.firstCapturerGames++;
    if (r.firstCapturer === r.winner) agg.firstCapturerWins++;
  }
  for (const [c, k] of Object.entries(r.cardDrawn)) inc(agg.cardDrawn, c, k);
  r.landCaptures.forEach((k, i) => incArr(agg.landCaptures, i, k));
  r.landOwnerAtEnd.forEach((o, i) => {
    incArr(agg.landHeldAtEnd, i, o >= 0 ? 1 : 0);
    incArr(agg.landMask, i, o !== -2 ? 1 : 0);
    incArr(agg.landHeldByWinner, i, o >= 0 && o === r.winner ? 1 : 0);
  });
  for (const [d, k] of Object.entries(r.denomCounts)) inc(agg.denom, d, k);
  r.powerByRound.forEach((p, i) => { incArr(agg.powerByRound, i, p); incArr(agg.powerByRoundN, i); });
  for (const [c, k] of Object.entries(r.choice)) inc(agg.choice, c, k);
  for (const [c, k] of Object.entries(r.hpLossBySource)) inc(agg.hpLossBySource, c, k);
  if (r.maxRepeat > agg.maxRepeat) agg.maxRepeat = r.maxRepeat;
  if (r.maxRepeat >= 10) agg.repeatGames++;
}

export function mergeAgg(a: Agg, b: Agg): Agg {
  a.games += b.games;
  a.players = b.players || a.players;
  a.timeouts += b.timeouts;
  a.noWinner += b.noWinner;
  b.rounds.forEach((v, i) => incArr(a.rounds, i, v));
  for (const [k, v] of Object.entries(b.endReasons)) inc(a.endReasons, k, v);
  for (const [k, v] of Object.entries(b.bot)) {
    const e = (a.bot[k] ??= { apps: 0, wins: 0, stats: newPlayerStats() });
    e.apps += v.apps; e.wins += v.wins; addStats(e.stats, v.stats);
  }
  b.seatGames.forEach((v, i) => incArr(a.seatGames, i, v));
  b.seatWins.forEach((v, i) => incArr(a.seatWins, i, v));
  for (const k of ['leaderHalfWins', 'leaderQ1Wins', 'leaderQ3Wins', 'lastHalfWins', 'leadChanges', 'firstCapturerWins', 'firstCapturerGames', 'deadTurns', 'playerRounds', 'repeatGames'] as const) a[k] += b[k];
  for (const k of ['cardDrawn', 'cardPlayed', 'cardPlayGames', 'cardPlayWins', 'denom', 'choice', 'hpLossBySource'] as const) for (const [c, v] of Object.entries(b[k])) inc(a[k], c, v);
  for (const k of ['landCaptures', 'landHeldByWinner', 'landHeldAtEnd', 'landMask', 'powerByRound', 'powerByRoundN'] as const) b[k].forEach((v, i) => incArr(a[k], i, v));
  a.maxRepeat = Math.max(a.maxRepeat, b.maxRepeat);
  a.anomalies.push(...b.anomalies.slice(0, Math.max(0, 50 - a.anomalies.length)));
  return a;
}

// ---- Summary -----------------------------------------------------------------

export interface Summary {
  games: number;
  players: number;
  timeoutRate: number;
  noWinnerRate: number;
  medianRounds: number;
  meanRounds: number;
  p10Rounds: number;
  p90Rounds: number;
  winRate: Record<string, number>;
  apps: Record<string, number>;
  seatWinRate: number[];
  leaderHalfWinRate: number;
  comebackRate: number;
  lastHalfWinRate: number;
  leadChangesPerGame: number;
  firstCapturerWinRate: number;
  deadFraction: number;
  meaningfulPerTurn: number;
  /** Entropy-weighted decisions per turn (trivial choices count ~0). */
  effectiveDecisionsPerTurn: number;
  decisionEntropy: Record<string, number>;
  cardPlayRate: Record<string, number>;
  cardWinDelta: Record<string, number>;
  denomShare: Record<string, number>;
  perBot: Record<string, Record<string, number>>;
  endReasons: Record<string, number>;
  landCaptureRate: number[];
  landWinnerShare: number[];
  landIsLand: boolean[];
  powerCurve: number[];
  hpLossBySource: Record<string, number>;
  changeHealPerGame: number;
  repeatGameRate: number;
  choice: Record<string, number>;
}

function quantile(hist: number[], q: number): number {
  const total = hist.reduce((s, v) => s + v, 0);
  let acc = 0;
  for (let i = 0; i < hist.length; i++) {
    acc += hist[i];
    if (acc >= q * total) return i;
  }
  return hist.length - 1;
}

export function summarize(a: Agg): Summary {
  const G = Math.max(1, a.games);
  const winRate: Record<string, number> = {};
  const apps: Record<string, number> = {};
  const perBot: Record<string, Record<string, number>> = {};
  let totalTurns = 0;
  let totalMeaningful = 0;
  let changeHeal = 0;
  for (const [b, e] of Object.entries(a.bot)) {
    winRate[b] = e.wins / Math.max(1, e.apps);
    apps[b] = e.apps;
    const per: Record<string, number> = {};
    for (const [k, v] of Object.entries(e.stats)) per[k] = v / Math.max(1, e.apps);
    perBot[b] = per;
    totalTurns += e.stats.turns - e.stats.skips;
    totalMeaningful += e.stats.meaningful;
    changeHeal += e.stats.changeHeal;
  }
  const won = Math.max(1, G - a.noWinner);
  const cardPlayRate: Record<string, number> = {};
  const cardWinDelta: Record<string, number> = {};
  const fair = 1 / Math.max(1, a.players);
  for (const [c, d] of Object.entries(a.cardDrawn)) {
    cardPlayRate[c] = (a.cardPlayed[c] ?? 0) / d;
    const pg = a.cardPlayGames[c] ?? 0;
    cardWinDelta[c] = pg >= 30 ? (a.cardPlayWins[c] ?? 0) / pg - fair : 0;
  }
  const denomTotal = Object.values(a.denom).reduce((s, v) => s + v, 0) || 1;
  const denomShare: Record<string, number> = {};
  for (const [d, v] of Object.entries(a.denom)) denomShare[d] = v / denomTotal;
  let totalRounds = 0;
  a.rounds.forEach((v, i) => (totalRounds += v * i));
  const endReasons: Record<string, number> = {};
  for (const [k, v] of Object.entries(a.endReasons)) endReasons[k] = v / G;
  const hpLoss: Record<string, number> = {};
  for (const [k, v] of Object.entries(a.hpLossBySource)) hpLoss[k] = v / G;
  // decision entropy per kind: normalised Shannon entropy of chosen option labels
  const byKind: Record<string, Record<string, number>> = {};
  for (const [k, v] of Object.entries(a.choice)) {
    const i = k.indexOf(':');
    const kind = k.slice(0, i);
    (byKind[kind] ??= {})[k.slice(i + 1)] = v;
  }
  const decisionEntropy: Record<string, number> = {};
  let effective = 0;
  for (const [kind, m] of Object.entries(byKind)) {
    const vals = Object.values(m);
    const tot = vals.reduce((x, y) => x + y, 0);
    let h = 0;
    for (const v of vals) if (v) h -= (v / tot) * Math.log(v / tot);
    const hn = vals.length > 1 ? h / Math.log(vals.length) : 0;
    decisionEntropy[kind] = hn;
    effective += tot * hn;
  }
  return {
    games: a.games,
    effectiveDecisionsPerTurn: effective / Math.max(1, totalTurns),
    decisionEntropy,
    players: a.players,
    timeoutRate: a.timeouts / G,
    noWinnerRate: a.noWinner / G,
    medianRounds: quantile(a.rounds, 0.5),
    meanRounds: totalRounds / G,
    p10Rounds: quantile(a.rounds, 0.1),
    p90Rounds: quantile(a.rounds, 0.9),
    winRate,
    apps,
    seatWinRate: a.seatGames.map((g, i) => (a.seatWins[i] ?? 0) / Math.max(1, g)),
    leaderHalfWinRate: a.leaderHalfWins / won,
    comebackRate: 1 - a.leaderHalfWins / won,
    lastHalfWinRate: a.lastHalfWins / won,
    leadChangesPerGame: a.leadChanges / G,
    firstCapturerWinRate: a.firstCapturerWins / Math.max(1, a.firstCapturerGames),
    deadFraction: a.deadTurns / Math.max(1, a.playerRounds),
    meaningfulPerTurn: totalMeaningful / Math.max(1, totalTurns),
    cardPlayRate,
    cardWinDelta,
    denomShare,
    perBot,
    endReasons,
    landCaptureRate: a.landCaptures.map((v) => v / G),
    landWinnerShare: a.landHeldByWinner.map((v) => v / G),
    landIsLand: a.landMask.map((v) => v > 0),
    powerCurve: a.powerByRound.map((v, i) => v / Math.max(1, a.powerByRoundN[i])),
    hpLossBySource: hpLoss,
    changeHealPerGame: changeHeal / G,
    repeatGameRate: a.repeatGames / G,
    choice: a.choice,
  };
}
