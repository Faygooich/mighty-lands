// Automatic problem detection over an Evaluation. Each check has a stable key; the evolution
// driver maps keys to BUG-NNN ids on first detection and re-checks all of them every generation.
import type { Evaluation } from '../balancing/suite.ts';
import { neverCapturedLands, cardHealth, seatDeviation, skillExpression, styleDominance, weakDenominations, STYLE } from './score.ts';
import { cardName } from '../cards/catalog.ts';

export type Severity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'OK';

export interface Finding {
  key: string;
  title: string;
  severity: Severity;
  value: string;
  detail: string;
}

const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
const sev = (v: number, levels: Array<[number, Severity]>): Severity => {
  for (const [th, s] of levels) if (v >= th) return s;
  return 'OK';
};

export function detect(e: Evaluation, denoms: number[]): Finding[] {
  const S = e.summaries;
  const m = S.mixed4;
  const out: Finding[] = [];
  const add = (key: string, title: string, severity: Severity, value: string, detail = '') => out.push({ key, title, severity, value, detail });

  add('termination', 'Партии не завершаются (таймауты)', sev(m.timeoutRate, [[0.05, 'CRITICAL'], [0.01, 'HIGH'], [0.003, 'LOW']]), pct(m.timeoutRate),
    `mixed4 таймауты ${pct(m.timeoutRate)}, stall ${S.stall ? pct(S.stall.timeoutRate) : '—'}`);
  if (S.stall) add('stalling', 'Пассивные стратегии затягивают игру', sev(S.stall.timeoutRate, [[0.1, 'HIGH'], [0.02, 'MEDIUM'], [0.005, 'LOW']]), pct(S.stall.timeoutRate),
    `медиана раундов ${S.stall.medianRounds}, p90 ${S.stall.p90Rounds}`);
  const med = m.medianRounds;
  add('length', 'Длительность партии вне цели 12–30 раундов', med < 8 || med > 45 ? 'HIGH' : med < 12 || med > 30 ? 'MEDIUM' : 'OK', `${med}`, `p10 ${m.p10Rounds}, p90 ${m.p90Rounds}`);
  const sd = seatDeviation(S.mirror4);
  add('seat4', 'Преимущество места (4 игрока)', sev(sd, [[0.3, 'HIGH'], [0.15, 'MEDIUM'], [0.08, 'LOW']]), pct(sd), `win rate мест: ${S.mirror4.seatWinRate.map(pct).join(' / ')}`);
  if (S.mirror2) {
    const sd2 = seatDeviation(S.mirror2);
    add('seat2', 'Преимущество первого хода (2 игрока)', sev(sd2, [[0.3, 'HIGH'], [0.15, 'MEDIUM'], [0.08, 'LOW']]), pct(sd2), `win rate мест: ${S.mirror2.seatWinRate.map(pct).join(' / ')}`);
  }
  const dom = styleDominance(m);
  const top = STYLE.reduce((a, b) => ((m.winRate[b] ?? 0) > (m.winRate[a] ?? 0) ? b : a));
  add('dominance', 'Доминирующий стиль игры', sev(dom, [[0.6, 'HIGH'], [0.3, 'MEDIUM'], [0.15, 'LOW']]), `${top} +${pct(dom)}`,
    Object.entries(m.winRate).map(([b, w]) => `${b} ${pct(w)}`).join(', '));
  const sk = skillExpression(m);
  add('luck', 'Результат слабо зависит от решений (удача)', sk < 0.5 ? 'HIGH' : sk < 1 ? 'MEDIUM' : 'OK', sk.toFixed(2), `Tactical ${pct(m.winRate.tactical ?? 0)} vs Random ${pct(m.winRate.random ?? 0)}`);
  const cb = m.comebackRate;
  add('snowball', 'Snowball: лидер середины партии почти всегда побеждает', cb < 0.15 ? 'HIGH' : cb < 0.25 ? 'MEDIUM' : 'OK', `камбэк ${pct(cb)}`, `лидер в середине выигрывает ${pct(m.leaderHalfWinRate)}, последний в середине выигрывает ${pct(m.lastHalfWinRate)}`);
  if (cb > 0.6) add('chaos', 'Преимущество ничего не значит (хаос)', 'MEDIUM', pct(cb), '');
  if (S.earlyLead) {
    const w0 = S.earlyLead.seatWinRate[0] ?? 0;
    add('comeback', 'Нет возврата после раннего отставания', sev(w0, [[0.8, 'HIGH'], [0.6, 'MEDIUM'], [0.45, 'LOW']]), `лидер старта ${pct(w0)}`, 'Место 1 начинает с 5 жетонами и 3 Землями');
  }
  add('elimination', 'Долгое ожидание выбывших игроков', sev(m.deadFraction, [[0.3, 'HIGH'], [0.15, 'MEDIUM'], [0.08, 'LOW']]), pct(m.deadFraction), 'доля раундов, проведённых выбывшим');
  add('decisions', 'Мало содержательных решений', m.meaningfulPerTurn < 0.8 ? 'HIGH' : m.meaningfulPerTurn < 1.5 ? 'MEDIUM' : 'OK', m.meaningfulPerTurn.toFixed(2), 'решений с ≥2 вариантами на ход');
  const ch = cardHealth(m);
  add('deadCards', 'Мёртвые карты (разыгрываются < 10%)', ch.dead.length >= 3 ? 'MEDIUM' : ch.dead.length ? 'LOW' : 'OK', ch.dead.map(cardName).join(', ') || '—',
    ch.dead.map((c) => `${cardName(c)} ${pct(m.cardPlayRate[c])}`).join(', '));
  add('mandatoryCards', 'Обязательные карты (+20 п.п. к win rate)', ch.mandatory.length ? 'MEDIUM' : 'OK', ch.mandatory.map(cardName).join(', ') || '—',
    Object.entries(m.cardWinDelta).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([c, d]) => `${cardName(c)} ${d >= 0 ? '+' : ''}${(d * 100).toFixed(1)}`).join(', '));
  const weak = weakDenominations(m, denoms);
  add('denoms', 'Номиналы не используются', weak.length >= 2 ? 'MEDIUM' : weak.length ? 'LOW' : 'OK', weak.join(', ') || '—',
    Object.entries(m.denomShare).map(([d, s]) => `${d}: ${pct(s)}`).join(', '));
  if (S.exploit) {
    const fair = 1 / 4;
    const ew = S.exploit.winRate.exploit ?? 0;
    add('exploit', 'ExploitBot систематически обыгрывает TacticalBot', sev(ew / fair, [[2, 'HIGH'], [1.4, 'MEDIUM'], [1.15, 'LOW']]), pct(ew), '');
  }
  add('changeHeal', 'Оплата со сдачей лечит (HP из сдачи)', sev(m.changeHealPerGame, [[2, 'HIGH'], [0.5, 'MEDIUM'], [0.1, 'LOW']]), m.changeHealPerGame.toFixed(2), 'HP, полученных через сдачу, за партию');
  add('loops', 'Повторяющиеся состояния (циклы)', sev(m.repeatGameRate, [[0.05, 'HIGH'], [0.01, 'MEDIUM'], [0.002, 'LOW']]), pct(m.repeatGameRate), '≥10 одинаковых состояний подряд');
  add('firstCapture', 'Первый захват решает партию', sev(m.firstCapturerWinRate, [[0.55, 'HIGH'], [0.4, 'MEDIUM'], [0.33, 'LOW']]), pct(m.firstCapturerWinRate), '');
  const pc = m.powerCurve;
  if (pc.length > 10) {
    const ratio = pc[Math.min(pc.length - 1, 15)] / Math.max(1, pc[0]);
    add('deflation', 'Экономика: суммарная мощь', ratio < 0.5 ? 'MEDIUM' : ratio > 4 ? 'MEDIUM' : 'OK', `×${ratio.toFixed(2)} к раунду 15`, 'отношение суммарной мощи живых к стартовой');
  }
  const never = neverCapturedLands(m);
  add('territory', 'Земли, которые почти никогда не захватывают (<0.1 захвата за партию)', never >= 5 ? 'MEDIUM' : never ? 'LOW' : 'OK', `${never} из 20`, m.landCaptureRate.map((v, i) => (m.landIsLand[i] ? v.toFixed(2) : null)).filter((x) => x !== null).join(' '));
  add('trivialDecisions', 'Тривиальные решения (энтропия выбора ≈ 0)', m.effectiveDecisionsPerTurn < 0.5 ? 'HIGH' : m.effectiveDecisionsPerTurn < 1 ? 'MEDIUM' : 'OK', m.effectiveDecisionsPerTurn.toFixed(2), Object.entries(m.decisionEntropy).map(([k, v]) => `${k} ${v.toFixed(2)}`).join(', '));
  if (S.lowHp) add('lowHp', 'Low-HP сценарий', sev(S.lowHp.timeoutRate, [[0.05, 'HIGH'], [0.01, 'MEDIUM']]), `таймаут ${pct(S.lowHp.timeoutRate)}, медиана ${S.lowHp.medianRounds}`);
  if (S.extremeEconomy) add('extremeEconomy', 'Extreme economy сценарий', sev(S.extremeEconomy.timeoutRate, [[0.05, 'HIGH'], [0.01, 'MEDIUM']]), `таймаут ${pct(S.extremeEconomy.timeoutRate)}, медиана ${S.extremeEconomy.medianRounds}`);
  if (S.lateGame) add('lateGame', 'Late-game сценарий', sev(S.lateGame.timeoutRate, [[0.05, 'HIGH'], [0.01, 'MEDIUM']]), `таймаут ${pct(S.lateGame.timeoutRate)}, медиана ${S.lateGame.medianRounds}`);
  if (m.noWinnerRate > 0) add('noWinner', 'Партии без победителя', sev(m.noWinnerRate, [[0.02, 'HIGH'], [0.005, 'MEDIUM'], [0.0001, 'LOW']]), pct(m.noWinnerRate));
  return out;
}

export const SEV_ORDER: Severity[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'OK'];
