// v1.0.0 vs v1.0.1: side-by-side on FRESH seeds (never used for any decision).
//   node game/balancing/compare.ts v015 v0NN   → docs/v1.0.1_comparison_data.md (+ console summary)
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadRules } from '../rules/load.ts';
import { rulesComplexity, type RuleSet } from '../rules/ruleset.ts';
import { Pool } from '../simulation/pool.ts';
import { evaluate, type Evaluation } from './suite.ts';
import { detect } from '../statistics/detect.ts';
import { interestIndex, INTEREST_WEIGHTS } from '../statistics/interest.ts';
import { cardName } from '../cards/catalog.ts';

const FRESH = 12_000_000;
const pct = (x: number | undefined) => (x === undefined ? '—' : `${(x * 100).toFixed(1)}%`);
const f = (x: number | undefined, d = 2) => (x === undefined ? '—' : x.toFixed(d));

function cardTypes(r: RuleSet): number {
  let n = 0;
  for (const d of [r.decks.artifacts, r.decks.spells]) for (const v of Object.values(d)) if (v > 0) n++;
  return n;
}

async function main(): Promise<void> {
  const [va, vb] = process.argv.slice(2);
  const A = loadRules(va);
  const B = loadRules(vb);
  const pool = new Pool();
  const ea = await evaluate(pool, A, FRESH, { scale: 1 });
  const eb = await evaluate(pool, B, FRESH, { scale: 1 });
  await pool.close();
  const ia = interestIndex(ea.summaries);
  const ib = interestIndex(eb.summaries);
  const out: string[] = [];
  out.push(`# Сравнение на свежих seeds: ${va} (v1.0.0) против ${vb} (v1.0.1)`, '');
  out.push(`Seeds ${FRESH}+ не использовались ни в одном решении эволюции. Партий: ${ea.games.toLocaleString('ru-RU')} + ${eb.games.toLocaleString('ru-RU')}. Сгенерировано \`game/balancing/compare.ts\`.`, '');
  out.push('## Сводка', '', `| Метрика | v1.0.0 (${va}) | v1.0.1 (${vb}) |`, '|---|---|---|');
  const row = (name: string, a: string, b: string) => out.push(`| ${name} | ${a} | ${b} |`);
  row('**Interest Index (R4)**', `**${ia.total.toFixed(1)}**`, `**${ib.total.toFixed(1)}**`);
  row('Официальный скор качества (R3)', ea.score.total.toFixed(1), eb.score.total.toFixed(1));
  row('Типов карт в игре', String(cardTypes(A)), String(cardTypes(B)));
  row('Сложность правил (rulesComplexity)', String(rulesComplexity(A)), String(rulesComplexity(B)));
  const ma = ea.summaries.mixed4;
  const mb = eb.summaries.mixed4;
  row('Решений с учётом энтропии / ход', f(ma.effectiveDecisionsPerTurn), f(mb.effectiveDecisionsPerTurn));
  row('Решений с ≥ 2 вариантами / ход', f(ma.meaningfulPerTurn), f(mb.meaningfulPerTurn));
  row('Прямых влияний на соперников / ход', f(ma.feel.takeThatPerTurn + ma.feel.artifactHitsPerTurn), f(mb.feel.takeThatPerTurn + mb.feel.artifactHitsPerTurn));
  row('Карт в чужой ход / партию', f(ma.feel.reactionsPerGame, 1), f(mb.feel.reactionsPerGame, 1));
  row('Смен лидера / партию', f(ma.leadChangesPerGame, 1), f(mb.leadChangesPerGame, 1));
  row('Камбэк (победитель не лидер середины)', pct(ma.comebackRate), pct(mb.comebackRate));
  row('Последний в середине → победа (честно 25%)', pct(ma.lastHalfWinRate), pct(mb.lastHalfWinRate));
  row('Comeback-тест: лидер старта побеждает', pct(ea.summaries.earlyLead?.seatWinRate[0]), pct(eb.summaries.earlyLead?.seatWinRate[0]));
  row('Разнообразие сыгранных карт (эфф. число)', f(ia.values.cardVariety, 1), f(ib.values.cardVariety, 1));
  row('Мастерство (Tactical − Random) / доля', f(ia.values.skill), f(ib.values.skill));
  row('Доминирование стиля 4p', pct(ia.values.styleDominance), pct(ib.values.styleDominance));
  row('Лучший стиль в дуэли', pct(ia.values.duelTop), pct(ib.values.duelTop));
  row('ExploitBot против 3 Tactical (честно 25%)', pct(ea.summaries.exploit?.winRate.exploit), pct(eb.summaries.exploit?.winRate.exploit));
  row('Места 4p (зеркало)', ea.summaries.mirror4.seatWinRate.map(pct).join(' / '), eb.summaries.mirror4.seatWinRate.map(pct).join(' / '));
  row('Места 2p (зеркало)', ea.summaries.mirror2.seatWinRate.map(pct).join(' / '), eb.summaries.mirror2.seatWinRate.map(pct).join(' / '));
  row('Медиана раундов 4p (p10 / p90)', `${ma.medianRounds} (${ma.p10Rounds} / ${ma.p90Rounds})`, `${mb.medianRounds} (${mb.p10Rounds} / ${mb.p90Rounds})`);
  for (const [k, n] of [['duel', 2], ['three', 3], ['mixed4', 4], ['five', 5], ['six', 6], ['seven', 7]] as const) {
    row(`⏱ Время партии ${n}p (p90)`, `${ea.summaries[k].tableMinutes.toFixed(0)} мин (${ea.summaries[k].tableMinutesP90.toFixed(0)})`, `${eb.summaries[k].tableMinutes.toFixed(0)} мин (${eb.summaries[k].tableMinutesP90.toFixed(0)})`);
  }
  row('🧮 Арифметика / ход', f(ma.arithPerTurn), f(mb.arithPerTurn));
  row('Секунд на ход за столом', f(ma.secPerTurn, 0), f(mb.secPerTurn, 0));
  row('Рост мощи (пик / старт)', `×${f(ma.feel.growth)}`, `×${f(mb.feel.growth)}`);
  row('Доля игроков, доживших до 1 HP', pct(ma.feel.hp1Share), pct(mb.feel.hp1Share));
  row('Отнятых Земель / партию', f(ma.feel.landsTakenPerGame, 1), f(mb.feel.landsTakenPerGame, 1));
  row('Подмог / Помех за партию', `${f(ma.feel.helpsPerGame, 1)} / ${f(ma.feel.hindersPerGame, 1)}`, `${f(mb.feel.helpsPerGame, 1)} / ${f(mb.feel.hindersPerGame, 1)}`);
  row('Месть (доля атак на обидчика)', pct(ma.feel.revengeShare), pct(mb.feel.revengeShare));
  row('Кингмейкинг (атаки последнего места)', pct(ma.feel.kingmakerShare), pct(mb.feel.kingmakerShare));
  out.push('', '## Interest Index по компонентам', '', '| Компонент (вес) | v1.0.0 | v1.0.1 |', '|---|---|---|');
  for (const [k, w] of Object.entries(INTEREST_WEIGHTS)) out.push(`| ${k} (${w}) | ${(w * ia.parts[k]).toFixed(1)} | ${(w * ib.parts[k]).toFixed(1)} |`);
  const probs = (e: Evaluation, r: RuleSet) => detect(e, r.denominations).filter((x) => x.severity !== 'OK');
  out.push('', '## Открытые проблемы детектора', '');
  for (const [name, e, r] of [['v1.0.0', ea, A], ['v1.0.1', eb, B]] as const) {
    out.push(`**${name}:**`, '', '| Severity | Проблема | Значение |', '|---|---|---|');
    for (const p of probs(e, r)) out.push(`| ${p.severity} | ${p.title} | ${p.value} |`);
    out.push('');
  }
  out.push('## Карты v1.0.1 (смешанные партии 4p)', '', '| Карта | Копий | Разыграно из полученных | Δ win rate при розыгрыше |', '|---|---|---|---|');
  for (const [id, n] of [...Object.entries(B.decks.artifacts), ...Object.entries(B.decks.spells)]) {
    if (!n) continue;
    out.push(`| ${cardName(id)} | ${n} | ${pct(mb.cardPlayRate[id])} | ${((mb.cardWinDelta[id] ?? 0) * 100).toFixed(1)} п.п. |`);
  }
  writeFileSync(join(import.meta.dirname, '..', '..', 'docs', 'v1.0.1_comparison_data.md'), out.join('\n') + '\n');
  writeFileSync(join(import.meta.dirname, '..', '..', 'results', `compare_${va}_${vb}.json`), JSON.stringify({ a: ea, b: eb }));
  console.log(out.slice(0, 50).join('\n'));
}

await main();
